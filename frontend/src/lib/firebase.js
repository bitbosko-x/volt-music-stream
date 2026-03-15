import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBqateQ2CZIRqdPGo8dPoyf5TJB6gIz-UY",
  authDomain: "volt-db-22bc5.firebaseapp.com",
  projectId: "volt-db-22bc5",
  storageBucket: "volt-db-22bc5.firebasestorage.app",
  messagingSenderId: "268867457520",
  appId: "1:268867457520:web:01987e3e3d2f4aed920d35",
  measurementId: "G-NDVPQ3BFNP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Firestore
export const db = getFirestore(app);

export default app;
