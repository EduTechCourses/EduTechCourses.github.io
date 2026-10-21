// EduTechCourses — lógica de autenticación con Firebase
//
// Centraliza las funciones de registro, login, logout y recuperación de
// contraseña. Cada página que necesite autenticación importa desde acá
// en vez de llamar directamente al SDK de Firebase.
//
// NOTA PARA EL EQUIPO: este archivo va a ir creciendo issue por issue.
// Evitemos que dos personas lo editen al mismo tiempo en ramas distintas.

import { auth, db, googleProvider } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Traduce los códigos de error de Firebase a mensajes comprensibles.
function traducirErrorAuth(error) {
  const mensajes = {
    "auth/email-already-in-use": "Ese correo ya está registrado. Probá iniciar sesión.",
    "auth/invalid-email": "El correo ingresado no es válido.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/user-not-found": "No encontramos una cuenta con ese correo.",
    "auth/wrong-password": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Esperá unos minutos y volvé a intentar.",
    "auth/missing-email": "Ingresá un correo electrónico.",
    "auth/popup-closed-by-user": "Se cerró la ventana de Google antes de completar el acceso.",
    "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permití las ventanas emergentes e intentá de nuevo.",
    "auth/cancelled-popup-request": "Se cerró la ventana de Google antes de completar el acceso.",
    "auth/network-request-failed": "No hay conexión. Revisá tu internet e intentá de nuevo.",
    "auth/account-exists-with-different-credential": "Ese correo ya está registrado con otro método. Ingresá con tu correo y contraseña.",
  };
  return mensajes[error.code] || "Ocurrió un error inesperado. Intentá nuevamente.";
}

// Registra un nuevo usuario con correo y contraseña, guarda su nombre
// completo como displayName en Authentication, y crea su documento de
// perfil en Firestore (colección "usuarios", identificado con su UID).
async function registrarUsuario(nombre, apellido, email, password) {
  try {
    const credencial = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credencial.user, { displayName: nombre + " " + apellido });

    await setDoc(doc(db, "usuarios", credencial.user.uid), {
      nombre: nombre,
      apellido: apellido,
      email: email,
      telefono: "",
      rol: "estudiante",
      fechaRegistro: new Date().toISOString(),
    });

    return { exito: true };
  } catch (error) {
    return { exito: false, mensaje: traducirErrorAuth(error) };
  }
}

// Inicia sesión con correo y contraseña.
async function iniciarSesion(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { exito: true };
  } catch (error) {
    return { exito: false, mensaje: traducirErrorAuth(error) };
  }
}

// NUEVO: Inicia sesión o registra automáticamente al usuario mediante Google.
async function iniciarSesionConGoogle() {
  try {
    const credencial = await signInWithPopup(auth, googleProvider);
    const user = credencial.user;

    // Verificamos si ya existe su documento en Firestore
    const userDocRef = doc(db, "usuarios", user.uid);
    const userDoc = await getDoc(userDocRef);

    // Si es su primera vez, creamos su perfil automáticamente
    if (!userDoc.exists()) {
      const partesNombre = (user.displayName || "").split(" ");
      const nombre = partesNombre[0] || "Usuario";
      const apellido = partesNombre.slice(1).join(" ") || "";

      await setDoc(userDocRef, {
        nombre: nombre,
        apellido: apellido,
        email: user.email,
        telefono: "",
        rol: "estudiante",
        fechaRegistro: new Date().toISOString(),
      });
    }

    return { exito: true };
  } catch (error) {
    return { exito: false, mensaje: traducirErrorAuth(error) };
  }
}

// Cierra la sesión activa.
async function cerrarSesion() {
  try {
    await signOut(auth);
    return { exito: true };
  } catch (error) {
    return { exito: false, mensaje: traducirErrorAuth(error) };
  }
}

// Envía un correo de recuperación de contraseña.
async function recuperarContrasena(email) {
  const actionCodeSettings = {
    url: window.location.origin + "/login.html",
  };
  try {
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
    return { exito: true };
  } catch (error) {
    return { exito: false, mensaje: traducirErrorAuth(error) };
  }
}

export { registrarUsuario, iniciarSesion, iniciarSesionConGoogle, cerrarSesion, recuperarContrasena };