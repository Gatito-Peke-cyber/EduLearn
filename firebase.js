// =====================================================
// EduLearn — firebase.js
// Versión Firebase: 12.10.0
// =====================================================

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

const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;