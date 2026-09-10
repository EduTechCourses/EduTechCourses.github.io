// EduTechCourses — lógica de autenticación con Firebase
//
// Centraliza las funciones de registro, login, logout y recuperación de
// contraseña. Cada página que necesite autenticación importa desde acá
// en vez de llamar directamente al SDK de Firebase.
//
// NOTA PARA EL EQUIPO: este archivo va a ir creciendo issue por issue
// (registro, login, logout, recuperación, detección de sesión). Evitemos
// que dos personas lo editen al mismo tiempo en ramas distintas.
 
import { auth } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
 
// Traduce los códigos de error de Firebase a mensajes comprensibles.
// (Se va a completar/mejorar en la issue #35; por ahora cubre los casos
// más comunes de registro y login para no mostrar errores técnicos crudos).
function traducirErrorAuth(error) {
  const mensajes = {
    "auth/email-already-in-use": "Ese correo ya está registrado. Probá iniciar sesión.",
    "auth/invalid-email": "El correo ingresado no es válido.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/user-not-found": "No encontramos una cuenta con ese correo.",
    "auth/wrong-password": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Esperá unos minutos y volvé a intentar.",
  };
  return mensajes[error.code] || "Ocurrió un error inesperado. Intentá nuevamente.";
}
 
// Registra un nuevo usuario con correo y contraseña, y guarda su nombre
// como displayName del perfil de Firebase.
async function registrarUsuario(nombre, email, password) {
  try {
    const credencial = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credencial.user, { displayName: nombre });
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
 
export { registrarUsuario, iniciarSesion };