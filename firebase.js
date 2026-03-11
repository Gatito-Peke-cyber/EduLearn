/* =====================================================
   EduLearn — firebase.js  v4.0
   NOTA: Si hay errores de importación, cambia la
   versión "12.10.0" a "11.6.0" en TODOS los archivos
   (firebase.js, auth.js, database.js)
   ===================================================== */

import { initializeApp }  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { getAnalytics }   from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAWJqUatXBVia4aGKLYcYVi67dr3zoikqI",
  authDomain:        "edulearn-d7ca8.firebaseapp.com",
  projectId:         "edulearn-d7ca8",
  storageBucket:     "edulearn-d7ca8.firebasestorage.app",
  messagingSenderId: "976260050565",
  appId:             "1:976260050565:web:c6b9a6f8268f348d6303ec",
  measurementId:     "G-LCQPJGQS8K"
};

const app = initializeApp(firebaseConfig);

// Analytics solo en producción (evita errores en localhost)
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (_) {}

export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;