/* =====================================================
   EduLearn — database.js  v4.4
   FIXES v4.4:
   - NUEVO: _deduplicateEnrollments() — elimina cursos
     duplicados que aparecen cuando un mismo curso se
     inscribió desde dos rutas distintas (catálogo vs
     página del curso), generando dos doc IDs distintos
     en Firestore pero para el mismo curso.
   - getUserEnrollments: aplica deduplicación al retornar
   - syncAllToLocalStorage: aplica deduplicación antes de
     escribir en localStorage (fuente principal del bug)
   ===================================================== */

import { db } from './firebase.js';
import {
  doc, getDoc, setDoc, updateDoc,
  collection, query, where, getDocs,
  orderBy, limit, serverTimestamp,
  increment, arrayUnion,
} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';

/* ═══════════════════════════════════════════════════
   USUARIOS  — colección "usuarios"
   ═══════════════════════════════════════════════════ */

export async function createUserProfile(uid, data) {
  try {
    await setDoc(doc(db, 'usuarios', uid), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { error: null };
  } catch (err) {
    console.error('[DB] createUserProfile:', err);
    return { error: err.message };
  }
}

export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid: snap.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      lastVisit: data.lastVisit?.toDate?.()?.toISOString() || data.lastVisit,
    };
  } catch (err) {
    console.error('[DB] getUserProfile:', err);
    return null;
  }
}

export async function updateUserProfile(uid, data) {
  try {
    await updateDoc(doc(db, 'usuarios', uid), {
      ...data,
      updatedAt: serverTimestamp(),
    });

    try {
      const local = JSON.parse(localStorage.getItem('perfil_usuario') || '{}');
      localStorage.setItem('perfil_usuario', JSON.stringify({ ...local, ...data }));
    } catch (_) {}

    return { error: null };
  } catch (err) {
    console.error('[DB] updateUserProfile:', err);
    return { error: err.message };
  }
}

export async function addXP(uid, amount) {
  try {
    await updateDoc(doc(db, 'usuarios', uid), {
      xp:        increment(amount),
      updatedAt: serverTimestamp(),
    });
    try {
      const local = JSON.parse(localStorage.getItem('perfil_usuario') || '{}');
      local.xp = (local.xp || 0) + amount;
      localStorage.setItem('perfil_usuario', JSON.stringify(local));
    } catch (_) {}
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

export async function updateStreak(uid, racha) {
  try {
    await updateDoc(doc(db, 'usuarios', uid), {
      racha,
      lastVisit: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    try {
      const local = JSON.parse(localStorage.getItem('perfil_usuario') || '{}');
      local.racha = racha;
      localStorage.setItem('perfil_usuario', JSON.stringify(local));
    } catch (_) {}
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

/* ═══════════════════════════════════════════════════
   INSCRIPCIONES — colección "inscripciones"
   ID de documento: "{uid}_{cursoId}"

   FIX v4.3: enrollCourse ya no sobreescribe nota_final
   ni aprobado si el documento ya existe.
   ═══════════════════════════════════════════════════ */

export async function enrollCourse(uid, curso) {
  try {
    const cursoId = curso.id || curso.cursoId;
    const docId   = `${uid}_${cursoId}`;
    const docRef  = doc(db, 'inscripciones', docId);

    /* Verificar si el documento ya existe para no pisar la nota */
    const existing = await getDoc(docRef);
    const isNew    = !existing.exists();

    /* Datos base que siempre se actualizan */
    const baseData = {
      uid,
      cursoId,
      nombre:    curso.nombre   || curso.name  || '',
      area:      curso.area     || '',
      grado:     curso.grado    || '',
      tipo:      curso.tipo     || 'permanente',
      horas:     curso.horas    || curso.duracionHoras || 0,
      img:       curso.img      || '',
      link:      curso.link     || '#',
      updatedAt: serverTimestamp(),
    };

    /* Solo añadir campos de estado/nota en documentos NUEVOS. */
    if (isNew) {
      Object.assign(baseData, {
        estado:     'en_progreso',
        nota_final: null,
        aprobado:   null,
        enrolledAt: serverTimestamp(),
      });
    }

    await setDoc(docRef, baseData, { merge: true });

    /* Actualizar localStorage sin pisar la nota */
    _updateEnrollmentLocal(cursoId, baseData, isNew);

    return { error: null };
  } catch (err) {
    console.error('[DB] enrollCourse:', err);
    return { error: err.message };
  }
}

/* Alias para compatibilidad con módulos que importan enrollCourseDB */
export const enrollCourseDB = enrollCourse;

/* ═══════════════════════════════════════════════════
   FIX v4.3: updateExamResult usa setDoc+merge
   ═══════════════════════════════════════════════════ */
export async function updateExamResult(uid, cursoId, nota_final, aprobado) {
  try {
    const docId  = `${uid}_${cursoId}`;
    const docRef = doc(db, 'inscripciones', docId);

    await setDoc(docRef, {
      uid,
      cursoId,
      nota_final,
      aprobado,
      estado:    aprobado ? 'completado' : 'en_progreso',
      updatedAt: serverTimestamp(),
    }, { merge: true });

    /* Sincronizar localStorage */
    try {
      const list = JSON.parse(localStorage.getItem('inscripciones') || '[]');
      const idx  = list.findIndex(c => c.id === cursoId || c.cursoId === cursoId);
      if (idx >= 0) {
        const prevNota = list[idx].nota_final;
        if (typeof prevNota !== 'number' || nota_final >= prevNota) {
          list[idx].nota_final = nota_final;
        }
        if (aprobado || list[idx].aprobado !== true) {
          list[idx].aprobado = aprobado;
        }
        list[idx].estado = aprobado ? 'completado' : 'en_progreso';
        localStorage.setItem('inscripciones', JSON.stringify(list));
      }
    } catch (_) {}

    return { error: null };
  } catch (err) {
    console.error('[DB] updateExamResult:', err);
    return { error: err.message };
  }
}

/* Alias para compatibilidad */
export const updateExamResultDB = updateExamResult;

/* ═══════════════════════════════════════════════════
   FIX v4.4: getUserEnrollments aplica deduplicación.
   Cuando un mismo curso fue inscrito desde dos rutas
   distintas (generando dos doc IDs en Firestore), el
   query devolvía dos entradas. Ahora se fusionan en una,
   conservando el mejor estado (nota más alta, completado).
   ═══════════════════════════════════════════════════ */
export async function getUserEnrollments(uid) {
  try {
    const q    = query(collection(db, 'inscripciones'), where('uid', '==', uid));
    const snap = await getDocs(q);
    const raw  = snap.docs.map(d => {
      const data = d.data();
      const toISO = (val) => {
        if (!val) return null;
        if (typeof val.toDate === 'function') return val.toDate().toISOString();
        if (typeof val === 'string') return val;
        return null;
      };
      return {
        ...data,
        id:         data.cursoId,
        enrolledAt: toISO(data.enrolledAt),
        updatedAt:  toISO(data.updatedAt),
      };
    });

    /* ── FIX v4.4: eliminar duplicados antes de retornar ── */
    return _deduplicateEnrollments(raw);
  } catch (err) {
    console.error('[DB] getUserEnrollments:', err);
    return [];
  }
}

/* ═══════════════════════════════════════════════════
   MISIONES — colección "misiones_estado" / doc uid
   ═══════════════════════════════════════════════════ */

export async function getMisionesEstado(uid) {
  try {
    const snap = await getDoc(doc(db, 'misiones_estado', uid));
    return snap.exists() ? snap.data() : {};
  } catch (_) { return {}; }
}

export async function saveMisionesEstado(uid, estado) {
  try {
    await setDoc(doc(db, 'misiones_estado', uid), {
      ...estado,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    localStorage.setItem('misiones_estado_v4', JSON.stringify(estado));
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

/* ═══════════════════════════════════════════════════
   TIMELINE — colección "timeline/{uid}/eventos"
   ═══════════════════════════════════════════════════ */

export async function addTimelineEventDB(uid, evento) {
  try {
    const colRef = collection(db, 'timeline', uid, 'eventos');
    await setDoc(doc(colRef), { ...evento, fecha: serverTimestamp() });
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

export async function getTimelineDB(uid) {
  try {
    const q    = query(
      collection(db, 'timeline', uid, 'eventos'),
      orderBy('fecha', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      ...d.data(),
      id:    d.id,
      fecha: d.data().fecha?.toDate?.()?.toISOString() || new Date().toISOString(),
    }));
  } catch (_) { return []; }
}

/* ═══════════════════════════════════════════════════
   BUZÓN — colección "buzon_estado" / doc uid
   ═══════════════════════════════════════════════════ */

export async function getBuzonEstado(uid) {
  try {
    const snap = await getDoc(doc(db, 'buzon_estado', uid));
    return snap.exists() ? snap.data() : {};
  } catch (_) { return {}; }
}

export async function saveBuzonEstado(uid, estado) {
  try {
    await setDoc(doc(db, 'buzon_estado', uid), {
      ...estado,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    localStorage.setItem('buzon_estado', JSON.stringify(estado));
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

/* ═══════════════════════════════════════════════════
   INSIGNIAS — colección "insignias_ganadas" / doc uid
   ═══════════════════════════════════════════════════ */

export async function getInsigniasGanadas(uid) {
  try {
    const snap = await getDoc(doc(db, 'insignias_ganadas', uid));
    return snap.exists() ? (snap.data().ids || []) : [];
  } catch (_) { return []; }
}

export async function addInsignia(uid, badgeId) {
  try {
    await setDoc(doc(db, 'insignias_ganadas', uid), {
      ids:       arrayUnion(badgeId),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

/* ═══════════════════════════════════════════════════
   SINCRONIZACIÓN COMPLETA  Firebase → localStorage
   Firebase es la FUENTE DE VERDAD.

   FIX v4.4: aplica _deduplicateEnrollments antes de
   escribir en localStorage para que el perfil no muestre
   el mismo curso dos veces.
   ═══════════════════════════════════════════════════ */
export async function syncAllToLocalStorage(uid) {
  try {
    const [profile, enrollments, misiones, buzon, timeline] = await Promise.all([
      getUserProfile(uid),
      getUserEnrollments(uid),   // ya viene deduplicado (fix v4.4)
      getMisionesEstado(uid),
      getBuzonEstado(uid),
      getTimelineDB(uid),
    ]);

    /* ── PERFIL ── */
    if (profile && Object.keys(profile).length > 1) {
      const clean = { ...profile };
      delete clean.createdAt;
      delete clean.updatedAt;
      localStorage.setItem('perfil_usuario', JSON.stringify(clean));
    }

    /* ── INSCRIPCIONES ── */
    if (Array.isArray(enrollments) && enrollments.length > 0) {
      /* FIX v4.4: deduplicar también contra lo que ya hay en
         localStorage (puede haber entradas de otras páginas
         que aún no se subieron a Firebase) */
      let merged = enrollments;
      try {
        const localRaw = localStorage.getItem('inscripciones');
        if (localRaw) {
          const localList = JSON.parse(localRaw);
          if (Array.isArray(localList) && localList.length > 0) {
            /* Firebase tiene prioridad: va primero en el merge */
            merged = _deduplicateEnrollments([...enrollments, ...localList]);
          }
        }
      } catch (_) {}
      localStorage.setItem('inscripciones', JSON.stringify(merged));

    } else if (enrollments.length === 0) {
      const localRaw = localStorage.getItem('inscripciones');
      if (localRaw) {
        try {
          const localList = JSON.parse(localRaw);
          if (Array.isArray(localList) && localList.length > 0) {
            console.log('[Sync] Subiendo inscripciones locales a Firebase...');
            const uploadPromises = localList.map(curso =>
              enrollCourse(uid, { ...curso, id: curso.id || curso.cursoId })
            );
            await Promise.allSettled(uploadPromises);
          }
        } catch (_) {}
      }
    }

    /* ── MISIONES ── */
    const misionesKeys = Object.keys(misiones).filter(k => k !== 'updatedAt');
    if (misionesKeys.length > 0) {
      const { updatedAt: _u, ...misionesClean } = misiones;
      localStorage.setItem('misiones_estado_v4', JSON.stringify(misionesClean));
    }

    /* ── BUZÓN ── */
    const buzonKeys = Object.keys(buzon).filter(k => k !== 'updatedAt');
    if (buzonKeys.length > 0) {
      const { updatedAt: _u, ...buzonClean } = buzon;
      localStorage.setItem('buzon_estado', JSON.stringify(buzonClean));
    }

    /* ── TIMELINE ── */
    if (Array.isArray(timeline) && timeline.length > 0) {
      localStorage.setItem('timeline_events', JSON.stringify(timeline));
    }

    return { error: null };
  } catch (err) {
    console.error('[DB] syncAllToLocalStorage:', err);
    return { error: err.message };
  }
}

export async function saveFullProfile(uid, profileData) {
  return updateUserProfile(uid, profileData);
}

/* ═══════════════════════════════════════════════════
   HELPERS PRIVADOS
   ═══════════════════════════════════════════════════ */

/**
 * FIX v4.4 — Elimina entradas duplicadas de un arreglo
 * de inscripciones.
 *
 * Lógica:
 *  · La clave de deduplicación es cursoId › id › nombre (normalizado).
 *  · Cuando hay dos entradas con la misma clave, se FUSIONAN
 *    conservando el mejor estado:
 *      - nota_final más alta
 *      - aprobado = true si alguna lo tiene
 *      - estado = 'completado' si alguna lo tiene
 *  · El arreglo de entrada debe tener los elementos con mayor
 *    prioridad (Firebase) al principio para que el merge les dé
 *    preferencia en los campos de metadata (nombre, área, etc.).
 */
function _deduplicateEnrollments(list) {
  const seen = new Map();

  for (const item of list) {
    /* Clave: cursoId tiene prioridad sobre id, luego nombre */
    const rawKey = item.cursoId || item.id || item.nombre || '';
    const key    = String(rawKey).toLowerCase().trim();
    if (!key) continue;

    if (!seen.has(key)) {
      seen.set(key, { ...item });
    } else {
      const prev = seen.get(key);

      /* nota_final: conservar la más alta */
      const prevNota = typeof prev.nota_final === 'number' ? prev.nota_final : -1;
      const itemNota = typeof item.nota_final === 'number' ? item.nota_final : -1;
      if (itemNota > prevNota) prev.nota_final = item.nota_final;

      /* aprobado: conservar true si alguno lo tiene */
      if (item.aprobado === true) prev.aprobado = true;

      /* estado: conservar 'completado' si alguno lo tiene */
      if (item.estado === 'completado') prev.estado = 'completado';

      /* ids: preservar si faltan */
      if (!prev.cursoId && item.cursoId) prev.cursoId = item.cursoId;
      if (!prev.id && item.id)           prev.id      = item.id;
    }
  }

  return Array.from(seen.values());
}

/**
 * Actualiza localStorage para la inscripción indicada.
 * Para documentos nuevos añade la entrada; para existentes
 * solo actualiza campos no-resultado para no pisar la nota.
 */
function _updateEnrollmentLocal(cursoId, data, isNew) {
  try {
    const list = JSON.parse(localStorage.getItem('inscripciones') || '[]');
    const idx  = list.findIndex(c => c.id === cursoId || c.cursoId === cursoId);

    if (isNew || idx === -1) {
      const entry = {
        ...data,
        id:         cursoId,
        enrolledAt: new Date().toISOString(),
        updatedAt:  new Date().toISOString(),
      };
      if (idx === -1) {
        list.push(entry);
      } else {
        list[idx] = entry;
      }
    } else {
      /* Existente: actualizar solo metadatos, NO nota ni aprobado */
      const keep = {
        nombre:    data.nombre,
        area:      data.area,
        grado:     data.grado,
        tipo:      data.tipo,
        horas:     data.horas,
        img:       data.img,
        link:      data.link,
        updatedAt: new Date().toISOString(),
      };
      Object.assign(list[idx], keep);
    }

    /* FIX v4.4: deduplicar antes de guardar */
    localStorage.setItem('inscripciones', JSON.stringify(_deduplicateEnrollments(list)));
  } catch (_) {}
}

/* Función legacy — mantenida por compatibilidad */
function _addEnrollmentLocal(curso) {
  try {
    const list   = JSON.parse(localStorage.getItem('inscripciones') || '[]');
    const exists = list.find(c => c.id === curso.id || c.cursoId === curso.cursoId);
    if (!exists) {
      list.push(curso);
      localStorage.setItem('inscripciones', JSON.stringify(list));
    }
  } catch (_) {}
}