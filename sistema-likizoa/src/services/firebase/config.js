import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyANoIt4-tmYSBgfzloXwqqvLsdNMZ72H0o",
  authDomain: "sistema-likizoa.firebaseapp.com",
  projectId: "sistema-likizoa",
  storageBucket: "sistema-likizoa.firebasestorage.app",
  messagingSenderId: "162405564961",
  appId: "1:162405564961:web:39f0d7a665f1067309d960",
  measurementId: "G-WMNVW2FHWJ"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");

export default app;