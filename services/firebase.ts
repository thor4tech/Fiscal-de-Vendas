import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile,
  signOut 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyACe_m-hjCyb9Yu-y7baXuzHyUmxatuj34",
  authDomain: "fiscal-de-venda.firebaseapp.com",
  projectId: "fiscal-de-venda",
  storageBucket: "fiscal-de-venda.firebasestorage.app",
  messagingSenderId: "147520991992",
  appId: "1:147520991992:web:fe40632ed9ac10984b010d",
  measurementId: "G-4JBV7PF7PH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // Inicializando Storage
export const googleProvider = new GoogleAuthProvider();

export { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile, 
  signOut 
};