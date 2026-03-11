// Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyAWJqUatXBVia4aGKLYcYVi67dr3zoikqI",
    authDomain: "edulearn-d7ca8.firebaseapp.com",
    projectId: "edulearn-d7ca8",
    storageBucket: "edulearn-d7ca8.firebasestorage.app",
    messagingSenderId: "976260050565",
    appId: "1:976260050565:web:c6b9a6f8268f348d6303ec",
    measurementId: "G-LCQPJGQS8K"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);