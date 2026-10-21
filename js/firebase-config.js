// EduTechCourses — configuración e inicialización de Firebase
//
// Este archivo inicializa la conexión con el proyecto de Firebase y expone
// las instancias de `auth` y `db` (Firestore) para que las usen otros
// módulos (auth.js, etc.). Debe cargarse con type="module" en el HTML,
// ANTES que cualquier script que dependa de él (también con type="module").
//
// NOTA PARA EL EQUIPO: no editar este archivo salvo que cambie la
// configuración del proyecto Firebase.
 
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
 
const firebaseConfig = {
  apiKey: "AIzaSyDwUjhXC1mHsvYziX2nLLgkSKadfRmVjaQ",
  authDomain: "edutechcourses-e8f3c.firebaseapp.com",
  projectId: "edutechcourses-e8f3c",
  storageBucket: "edutechcourses-e8f3c.firebasestorage.app",
  messagingSenderId: "670475181572",
  appId: "1:670475181572:web:7c7a861723871f6126df51"
};
 
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
 
export { app, auth, db, googleProvider };