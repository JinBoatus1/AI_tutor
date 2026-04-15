// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC2hXZgLkuyGPJNszyc6NQGdIB-rOcpGm0",
  authDomain: "ai-tutor-9bbfc.firebaseapp.com",
  projectId: "ai-tutor-9bbfc",
  storageBucket: "ai-tutor-9bbfc.firebasestorage.app",
  messagingSenderId: "884173441167",
  appId: "1:884173441167:web:dcfd34ad5469017be588fa",
  measurementId: "G-Z5025V4213"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);