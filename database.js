/* =====================================================
   EduLearn — database.js  v4.0
   FIXES:
   - syncAllToLocalStorage: no sobreescribe con datos vacíos
   - getUserEnrollments: mejor manejo de Timestamps
   - Todos los errores se propagan correctamente
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
    // Convertir Timestamps a ISO string para compatibilidad
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
    // Reflejar en localStorage
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
      nombre:     curso.nombre,
      area:       curso.area   || '',
      tipo:       curso.tipo   || 'permanente',
      horas:      curso.horas  || 0,
      img:        curso.img    || '',
      link:       curso.link   || '#',
      estado:     'en_progreso',
      nota_final: null,
      aprobado:   null,
      enrolledAt: serverTimestamp(),
      updatedAt:  serverTimestamp(),
    };
    await setDoc(doc(db, 'inscripciones', docId), data);
    _addEnrollmentLocal({ ...data, id: curso.id, enrolledAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return { error: null };
  } catch (err) {
    console.error('[DB] enrollCourse:', err);
    return { error: err.message };
  }
}

export async function getUserEnrollments(uid) {
  try {
    const q    = query(collection(db, 'inscripciones'), where('uid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      // FIX: conversión segura de Timestamps de Firestore
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
    return { error: err.message };
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
   FIX: solo sobreescribe cada clave si Firestore
   devolvió datos reales (no objetos vacíos / null)
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

    // Perfil: solo sobreescribir si Firestore tiene datos reales
    if (profile && Object.keys(profile).length > 1) {
      const clean = { ...profile };
      delete clean.createdAt;
      delete clean.updatedAt;
      localStorage.setItem('perfil_usuario', JSON.stringify(clean));
    }

    // Inscripciones: guardar aunque sea array vacío (es válido)
    if (Array.isArray(enrollments)) {
      localStorage.setItem('inscripciones', JSON.stringify(enrollments));
    }

    // Misiones: solo sobreescribir si hay misiones guardadas
    if (misiones && Object.keys(misiones).filter(k => k !== 'updatedAt').length > 0) {
      // Limpiar el campo de control updatedAt antes de guardar
      const { updatedAt: _u, ...misionesClean } = misiones;
      localStorage.setItem('misiones_estado_v4', JSON.stringify(misionesClean));
    }

    // Buzón: solo sobreescribir si hay mensajes leídos registrados
    if (buzon && Object.keys(buzon).filter(k => k !== 'updatedAt').length > 0) {
      const { updatedAt: _u, ...buzonClean } = buzon;
      localStorage.setItem('buzon_estado', JSON.stringify(buzonClean));
    }

    // Timeline: solo sobreescribir si hay eventos reales
    if (Array.isArray(timeline) && timeline.length > 0) {
      localStorage.setItem('timeline_events', JSON.stringify(timeline));
    }

    return { error: null };
  } catch (err) {
    console.error('[DB] syncAllToLocalStorage:', err);
    return { error: err.message };
  }
}

/* ═══════════════════════════════════════════════════
   GUARDAR PERFIL COMPLETO (desde perfil.js)
   ═══════════════════════════════════════════════════ */
export async function saveFullProfile(uid, profileData) {
  return updateUserProfile(uid, profileData);
}

/* ═══════════════════════════════════════════════════
   HELPERS PRIVADOS
   ═══════════════════════════════════════════════════ */
function _addEnrollmentLocal(curso) {
  try {
    const list = JSON.parse(localStorage.getItem('inscripciones') || '[]');
    if (!list.find(c => c.id === curso.id || c.cursoId === curso.cursoId)) {
      list.push(curso);
      localStorage.setItem('inscripciones', JSON.stringify(list));
    }
  } catch (_) {}
}