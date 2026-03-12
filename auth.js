/* =====================================================
   EduLearn — auth.js  v4.0
   FIXES:
   - Google login: popup → redirect fallback (compatibilidad total)
   - Bug crítico: usuario existente de Google ya no se sobreescribe
   - loginWithEmail: sync más robusto con reintentos
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
  signInWithRedirect,
  getRedirectResult,
} from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';

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
   FIX: sync robusto — garantiza que localStorage
   se llene aunque haya errores parciales en Firestore
   ═══════════════════════════════════════════════ */
export async function loginWithEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user  = cred.user;

    // Primer intento de sync
    let syncResult = await syncAllToLocalStorage(user.uid);

    // Si falló, reintentar una vez (puede ser problema de red momentáneo)
    if(syncResult?.error) {
      console.warn('[AUTH] Reintentando sync...');
      await new Promise(r => setTimeout(r, 1000));
      syncResult = await syncAllToLocalStorage(user.uid);
    }

    if(syncResult?.error) {
      console.warn('[AUTH] Sync con advertencia:', syncResult.error);
    }

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
   FIX 1: try popup → si falla, usa redirect
   FIX 2: no sobreescribir datos si getUserProfile falla
   ═══════════════════════════════════════════════ */
export async function loginWithGoogle() {
  // Intentar popup primero (funciona en escritorio/Chrome)
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return await _processGoogleUser(result.user);

  } catch (err) {
    // Errores que significan "popup no soportado en este entorno"
    const needsRedirect = [
      'auth/popup-blocked',
      'auth/popup-cancelled',
      'auth/operation-not-supported-in-this-environment',
      'auth/cancelled-popup-request',
    ].includes(err.code);

    if (needsRedirect) {
      // Guardar flag para saber que venimos de un redirect
      sessionStorage.setItem('google_redirect_pending', '1');
      try {
        await signInWithRedirect(auth, googleProvider);
        // La página se recarga — el resultado se maneja en handleGoogleRedirect()
        return { user: null, isNew: false, error: null, redirecting: true };
      } catch (redirectErr) {
        sessionStorage.removeItem('google_redirect_pending');
        return { user: null, isNew: false, error: translateError(redirectErr.code) };
      }
    }

    console.error('[AUTH] loginWithGoogle error:', err.code);
    return { user: null, isNew: false, error: translateError(err.code) };
  }
}

/* ═══════════════════════════════════════════════
   MANEJAR RESULTADO DE REDIRECT DE GOOGLE
   Llamar esta función al inicio de login.js
   para capturar el resultado después del redirect
   ═══════════════════════════════════════════════ */
export async function handleGoogleRedirect() {
  // Solo procesar si veníamos de un redirect intencional
  // (getRedirectResult puede tardar aunque no haya redirect)
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;

    sessionStorage.removeItem('google_redirect_pending');
    return await _processGoogleUser(result.user);
  } catch (err) {
    sessionStorage.removeItem('google_redirect_pending');
    if (err.code === 'auth/credential-already-in-use') {
      return { user: null, error: translateError(err.code) };
    }
    // No había redirect pendiente o fue cancelado — ignorar
    return null;
  }
}

/* ═══════════════════════════════════════════════
   HELPER INTERNO: procesar usuario de Google
   FIX CRÍTICO: si getUserProfile falla (error de red
   o reglas de Firestore), NO asumir que es usuario nuevo
   ═══════════════════════════════════════════════ */
async function _processGoogleUser(user) {
  try {
    let existingProfile = null;
    let profileError    = false;

    try {
      existingProfile = await getUserProfile(user.uid);
    } catch (profileErr) {
      // Si no podemos consultar Firestore, asumir que existe
      // para NO sobreescribir datos del usuario
      console.warn('[AUTH] No se pudo verificar perfil existente:', profileErr);
      profileError = true;
    }

    const isNew = !profileError && !existingProfile;

    if (isNew) {
      // Usuario genuinamente nuevo → crear perfil
      const profileData = {
        nombre:    user.displayName || 'Estudiante',
        email:     user.email || '',
        avatar:    '🎓',
        xp: 150, nivel: 1, racha: 0, horas: 0, completos: 0,
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
      // Usuario existente (o no se pudo verificar) → sincronizar datos
      await syncAllToLocalStorage(user.uid);
    }

    return { user, isNew, error: null };

  } catch (err) {
    console.error('[AUTH] _processGoogleUser:', err);
    // Aun así devolver el usuario para que pueda acceder
    return { user, isNew: false, error: null };
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
    sessionStorage.removeItem('google_redirect_pending');
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
    'auth/account-exists-with-different-credential': 'ESA CUENTA YA EXISTE CON OTRO MÉTODO DE ACCESO',
    'auth/user-disabled':           'ESTA CUENTA HA SIDO DESHABILITADA',
    'auth/credential-already-in-use': 'CREDENCIAL YA EN USO POR OTRA CUENTA',
    'auth/unauthorized-domain':     'DOMINIO NO AUTORIZADO — CONTACTA AL ADMINISTRADOR',
    'auth/operation-not-supported-in-this-environment': 'REDIRIGIENDO A GOOGLE...',
  };
  return MAP[code] || `ERROR: ${code}`;
}