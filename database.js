/* =====================================================
   EduLearn — database.js  v3.0
   CRUD completo con Firestore
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
    return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
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
    // Actualizar localStorage
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

    // Sincronizar al localStorage
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
      return {
        ...data,
        id: data.cursoId,
        // Convertir Timestamp a ISO string para localStorage
        enrolledAt: data.enrolledAt?.toDate?.()?.toISOString() || data.enrolledAt,
        updatedAt:  data.updatedAt?.toDate?.()?.toISOString()  || data.updatedAt,
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
    // Actualizar localStorage
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
    await setDoc(doc(colRef), {
      ...evento,
      fecha: serverTimestamp(),
    });
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
      id: d.id,
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
   ═══════════════════════════════════════════════════ */
export async function syncAllToLocalStorage(uid) {
  try {
    const [profile, enrollments, misiones, buzon] = await Promise.all([
      getUserProfile(uid),
      getUserEnrollments(uid),
      getMisionesEstado(uid),
      getBuzonEstado(uid),
    ]);

    if (profile) {
      // Limpiar campos Timestamp de Firestore que no se serializan bien
      const clean = { ...profile };
      delete clean.createdAt;
      delete clean.updatedAt;
      localStorage.setItem('perfil_usuario', JSON.stringify(clean));
    }
    if (enrollments) localStorage.setItem('inscripciones',       JSON.stringify(enrollments));
    if (misiones)    localStorage.setItem('misiones_estado_v4',  JSON.stringify(misiones));
    if (buzon)       localStorage.setItem('buzon_estado',        JSON.stringify(buzon));

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