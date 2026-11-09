// Inicialización de Firebase (SDK modular cargado desde el CDN oficial).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signInWithPopup, signInWithRedirect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, push, runTransaction,
  query, orderByChild, equalTo, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  getStorage, ref as sRef, uploadBytes, getDownloadURL, deleteObject, updateMetadata
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

export const configLista =
  typeof firebaseConfig.apiKey === "string" && !firebaseConfig.apiKey.startsWith("PEGA_");

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = "es";
export const db = configLista ? getDatabase(app) : null;
export const storage = configLista ? getStorage(app) : null;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export {
  onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signInWithPopup, signInWithRedirect,
  ref, get, set, update, push, runTransaction, query, orderByChild, equalTo, serverTimestamp,
  sRef, uploadBytes, getDownloadURL, deleteObject, updateMetadata
};
