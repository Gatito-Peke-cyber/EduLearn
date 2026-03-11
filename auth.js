/* =====================================================
   EduLearn — auth.js  v3.0
   Autenticación real con Firebase Auth
   ===================================================== */

import { auth } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

import {
  createUserProfile,
  getUserProfile,
  syncAllToLocalStorage,
} from './database.js';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/* ═══════════════════════════════════════════════
   REGISTRO CON EMAIL
   ═══════════════════════════════════════════════ */
export async function registerWithEmail(nombre, email, password, avatar = '🎓') {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user  = cred.user;

    await updateProfile(user, { displayName: nombre });
    await sendEmailVerification(user);

    const profileData = {
      nombre,
      email,
      avatar,
      xp:        150,
      nivel:     1,
      racha:     0,
      horas:     0,
      completos: 0,
      joinDate:  new Date().toISOString(),
      lastVisit: new Date().toISOString(),
    };

    await createUserProfile(user.uid, profileData);

    // Sincronizar a localStorage para compatibilidad con perfil.js
    localStorage.setItem('perfil_usuario', JSON.stringify(profileData));
    localStorage.setItem('inscripciones', JSON.stringify([]));
    localStorage.setItem('timeline_events', JSON.stringify([
      { icon:'🌟', title:'¡Cuenta creada!', detail:'+150 XP de bienvenida', fecha: new Date().toISOString() },
      { icon:'🌱', title:'Insignia "Primer Paso" desbloqueada', detail:'+30 XP', fecha: new Date().toISOString() },
    ]));

    return { user, error: null };
  } catch (err) {
    return { user: null, error: translateError(err.code) };
  }
}

/* ═══════════════════════════════════════════════
   LOGIN CON EMAIL
   ═══════════════════════════════════════════════ */
export async function loginWithEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user  = cred.user;

    // Traer todos los datos de Firestore al localStorage
    await syncAllToLocalStorage(user.uid);

    // Actualizar lastVisit en local
    try {
      const p = JSON.parse(localStorage.getItem('perfil_usuario') || '{}');
      p.lastVisit = new Date().toISOString();
      localStorage.setItem('perfil_usuario', JSON.stringify(p));
    } catch (_) {}

    return { user, error: null };
  } catch (err) {
    return { user: null, error: translateError(err.code) };
  }
}

/* ═══════════════════════════════════════════════
   LOGIN CON GOOGLE
   ═══════════════════════════════════════════════ */
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user   = result.user;
    const isNew  = result._tokenResponse?.isNewUser ?? false;

    if (isNew) {
      const profileData = {
        nombre:   user.displayName || 'Estudiante',
        email:    user.email,
        avatar:   '🎓',
        xp:       150, nivel: 1, racha: 0, horas: 0, completos: 0,
        joinDate:  new Date().toISOString(),
        lastVisit: new Date().toISOString(),
      };
      await createUserProfile(user.uid, profileData);
      localStorage.setItem('perfil_usuario',  JSON.stringify(profileData));
      localStorage.setItem('inscripciones',   JSON.stringify([]));
      localStorage.setItem('timeline_events', JSON.stringify([
        { icon:'🌟', title:'¡Cuenta creada con Google!', detail:'+150 XP', fecha: new Date().toISOString() },
      ]));
    } else {
      await syncAllToLocalStorage(user.uid);
    }

    return { user, isNew, error: null };
  } catch (err) {
    return { user: null, isNew: false, error: translateError(err.code) };
  }
}

/* ═══════════════════════════════════════════════
   CERRAR SESIÓN
   ═══════════════════════════════════════════════ */
export async function logout() {
  try {
    await signOut(auth);
    ['perfil_usuario','inscripciones','misiones_estado_v4',
     'timeline_events','buzon_estado','insignias_celebradas_v4'].forEach(k => {
      localStorage.removeItem(k);
    });
    return { error: null };
  } catch (err) {
    return { error: translateError(err.code) };
  }
}

/* ═══════════════════════════════════════════════
   RECUPERAR CONTRASEÑA
   ═══════════════════════════════════════════════ */
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (err) {
    return { error: translateError(err.code) };
  }
}

/* ═══════════════════════════════════════════════
   OBSERVER + HELPERS
   ═══════════════════════════════════════════════ */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

/* ═══════════════════════════════════════════════
   TRADUCIR ERRORES FIREBASE → ESPAÑOL
   ═══════════════════════════════════════════════ */
function translateError(code) {
  const MAP = {
    'auth/email-already-in-use':    'ESE CORREO YA ESTÁ REGISTRADO',
    'auth/invalid-email':           'CORREO ELECTRÓNICO INVÁLIDO',
    'auth/weak-password':           'CONTRASEÑA DEMASIADO DÉBIL (mín. 6 car.)',
    'auth/user-not-found':          'NO EXISTE UNA CUENTA CON ESE CORREO',
    'auth/wrong-password':          'CONTRASEÑA INCORRECTA',
    'auth/invalid-credential':      'CORREO O CONTRASEÑA INCORRECTOS',
    'auth/too-many-requests':       'DEMASIADOS INTENTOS — ESPERA UN MOMENTO',
    'auth/network-request-failed':  'ERROR DE RED — VERIFICA TU CONEXIÓN',
    'auth/popup-closed-by-user':    'VENTANA CERRADA — INTENTA DE NUEVO',
    'auth/cancelled-popup-request': 'OPERACIÓN CANCELADA',
    'auth/account-exists-with-different-credential': 'ESA CUENTA YA EXISTE CON OTRO MÉTODO',
    'auth/user-disabled':           'ESTA CUENTA HA SIDO DESHABILITADA',
  };
  return MAP[code] || `ERROR: ${code}`;
}