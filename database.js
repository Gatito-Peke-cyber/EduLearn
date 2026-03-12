/* =====================================================
   EduLearn — database.js  v4.2
   FIXES v4.2 (cross-device sync):
   - syncAllToLocalStorage: siempre sobreescribe con datos
     de Firebase como fuente de verdad (source of truth)
   - enrollCourseDB: alias exportado para compatibilidad
   - updateUserProfile: ya no pisa datos frescos de Firebase
   - Timestamps convertidos correctamente en todos los métodos
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
    // Guardar en Firestore primero
    await updateDoc(doc(db, 'usuarios', uid), {
      ...data,
      updatedAt: serverTimestamp(),
    });

    // Actualizar localStorage sólo con los campos enviados (merge)
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
   ═══════════════════════════════════════════════════ */

export async function enrollCourse(uid, curso) {
  try {
    const docId = `${uid}_${curso.id}`;
    const data = {
      uid,
      cursoId:    curso.id,
      nombre:     curso.nombre   || curso.name  || '',
      area:       curso.area     || '',
      grado:      curso.grado    || '',
      tipo:       curso.tipo     || 'permanente',
      horas:      curso.horas    || curso.duracionHoras || 0,
      img:        curso.img      || '',
      link:       curso.link     || '#',
      estado:     'en_progreso',
      nota_final: null,
      aprobado:   null,
      enrolledAt: serverTimestamp(),
      updatedAt:  serverTimestamp(),
    };
    await setDoc(doc(db, 'inscripciones', docId), data, { merge: true });

    _addEnrollmentLocal({
      ...data,
      id:         curso.id,
      enrolledAt: new Date().toISOString(),
      updatedAt:  new Date().toISOString(),
    });

    return { error: null };
  } catch (err) {
    console.error('[DB] enrollCourse:', err);
    return { error: err.message };
  }
}

/* Alias para compatibilidad con módulos que importan enrollCourseDB */
export const enrollCourseDB = enrollCourse;

export async function updateExamResult(uid, cursoId, nota_final, aprobado) {
  try {
    const docId = `${uid}_${cursoId}`;
    await updateDoc(doc(db, 'inscripciones', docId), {
      nota_final,
      aprobado,
      estado:    aprobado ? 'completado' : 'en_progreso',
      updatedAt: serverTimestamp(),
    });
    try {
      const list = JSON.parse(localStorage.getItem('inscripciones') || '[]');
      const idx  = list.findIndex(c => c.id === cursoId || c.cursoId === cursoId);
      if (idx >= 0) {
        list[idx].nota_final = nota_final;
        list[idx].aprobado   = aprobado;
        list[idx].estado     = aprobado ? 'completado' : 'en_progreso';
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

export async function getUserEnrollments(uid) {
  try {
    const q    = query(collection(db, 'inscripciones'), where('uid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
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
   v4.2: Firebase es la FUENTE DE VERDAD.
   Siempre sobreescribe localStorage con datos de Firebase.
   Si Firebase devuelve vacío, conserva los datos locales
   como fallback para no perder datos offline.
   ═══════════════════════════════════════════════════ */
export async function syncAllToLocalStorage(uid) {
  try {
    const [profile, enrollments, misiones, buzon, timeline] = await Promise.all([
      getUserProfile(uid),
      getUserEnrollments(uid),
      getMisionesEstado(uid),
      getBuzonEstado(uid),
      getTimelineDB(uid),
    ]);

    /* ── PERFIL ── */
    if (profile && Object.keys(profile).length > 1) {
      const clean = { ...profile };
      delete clean.createdAt;
      delete clean.updatedAt;
      // Firebase es fuente de verdad: sobreescribir completamente
      localStorage.setItem('perfil_usuario', JSON.stringify(clean));
    }
    // Si profile es null, conservar localStorage como fallback (modo offline)

    /* ── INSCRIPCIONES ── */
    if (Array.isArray(enrollments) && enrollments.length > 0) {
      // Firebase tiene datos → sobreescribir como fuente de verdad
      localStorage.setItem('inscripciones', JSON.stringify(enrollments));
    } else if (enrollments.length === 0) {
      // Firebase devuelve vacío: puede ser usuario nuevo o error de red.
      // Verificar si hay inscripciones locales pendientes de sync.
      const localRaw = localStorage.getItem('inscripciones');
      if (localRaw) {
        try {
          const localList = JSON.parse(localRaw);
          if (Array.isArray(localList) && localList.length > 0) {
            // Hay datos locales sin sincronizar → subirlos a Firebase
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
      // Firebase es fuente de verdad: sobreescribir
      localStorage.setItem('misiones_estado_v4', JSON.stringify(misionesClean));
    }
    // Si está vacío en Firebase, conservar localStorage como fallback

    /* ── BUZÓN ── */
    const buzonKeys = Object.keys(buzon).filter(k => k !== 'updatedAt');
    if (buzonKeys.length > 0) {
      const { updatedAt: _u, ...buzonClean } = buzon;
      // Firebase es fuente de verdad: sobreescribir
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
function _addEnrollmentLocal(curso) {
  try {
    const list = JSON.parse(localStorage.getItem('inscripciones') || '[]');
    const exists = list.find(c => c.id === curso.id || c.cursoId === curso.cursoId);
    if (!exists) {
      list.push(curso);
      localStorage.setItem('inscripciones', JSON.stringify(list));
    }
  } catch (_) {}
}