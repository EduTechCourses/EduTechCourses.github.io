// EduTechCourses — acceso a la colección "adquisiciones" de Firestore
//
// Registra y consulta las adquisiciones de cursos. El pago es SIMULADO:
// no se piden ni se guardan datos de tarjetas ni de ningún medio de pago.
//
// Estructura del documento adquisiciones/{uid}_{cursoId}:
//   uid, cursoId, cursoNombre, importe, metodoPago ("simulado"),
//   estado ("confirmada" o "cancelada"), fecha (hora del servidor)
//
// El id combina usuario y curso, por eso Firestore impide registrar dos
// veces la misma adquisición. Las reglas de seguridad (ver README) validan
// que el importe y el nombre coincidan con los datos reales del curso, así
// que lo que se envía desde acá no puede alterarse a favor del usuario.
//
// Las funciones usan auth.currentUser: deben llamarse después de que la
// página haya resuelto la sesión (por ejemplo, desde el clic de un botón).
// obtenerNivelAcceso es la excepción: espera por sí misma a que se resuelva
// la sesión, así que puede llamarse apenas carga la página.
//
// Panel administrativo: obtenerTodasLasAdquisiciones y cambiarEstadoAdquisicion
// las usa la sección "Adquisiciones" del panel. Las reglas de Firestore solo se
// las permiten al administrador, y este solo puede modificar el campo "estado".

import { auth, db } from "../firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

function idAdquisicion(uid, cursoId) {
  return uid + "_" + cursoId;
}

function fallo(codigo, mensaje) {
  return { exito: false, codigo: codigo, mensaje: mensaje };
}

// Traduce los errores de Firestore a mensajes comprensibles.
function traducirErrorFirestore(error) {
  if (error.code === "permission-denied") {
    return fallo(
      "permiso-denegado",
      "No pudimos registrar la adquisición. Es posible que el curso ya no esté disponible o que su precio haya cambiado. Recargá la página e intentá nuevamente."
    );
  }
  if (error.code === "unavailable") {
    return fallo("sin-conexion", "No hay conexión con el servidor. Revisá tu conexión e intentá nuevamente.");
  }
  return fallo("error", "Ocurrió un error inesperado. Intentá nuevamente.");
}

// Devuelve la adquisición del usuario actual para un curso, o null si no
// existe (o si no hay sesión). Si falla la consulta, lanza el error.
async function obtenerAdquisicion(cursoId) {
  const usuario = auth.currentUser;
  if (!usuario) return null;

  const snapshot = await getDoc(doc(db, "adquisiciones", idAdquisicion(usuario.uid, cursoId)));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

// Devuelve el nivel de acceso de la persona actual a un curso:
//   "visitante" -> no hay sesión iniciada
//   "admin"     -> la persona tiene rol "administrador" (ve todo el contenido)
//   "con-curso" -> tiene una adquisición confirmada de ese curso
//   "sin-curso" -> tiene sesión, pero no adquirió el curso (o su adquisición
//                  fue cancelada)
// El resultado sale de Firestore, no de datos que pueda modificar el cliente.
// Si falla alguna consulta, lanza el error para que la página decida qué hacer.
async function obtenerNivelAcceso(cursoId) {
  await auth.authStateReady();

  const usuario = auth.currentUser;
  if (!usuario) return "visitante";

  const perfil = await getDoc(doc(db, "usuarios", usuario.uid));
  if (perfil.exists() && perfil.data().rol === "administrador") return "admin";

  const adquisicion = await obtenerAdquisicion(cursoId);
  if (adquisicion && adquisicion.estado === "confirmada") return "con-curso";

  return "sin-curso";
}

// Registra la adquisición (pago simulado) del curso para el usuario actual.
// Recibe el curso tal como lo devuelve obtenerCursoPorId (id, nombre, precio).
// Devuelve { exito: true } o { exito: false, codigo, mensaje }, con los códigos:
// "sin-sesion", "ya-adquirido", "cancelada", "permiso-denegado", "sin-conexion"
// y "error".
async function adquirirCurso(curso) {
  const usuario = auth.currentUser;
  if (!usuario) {
    return fallo("sin-sesion", "Iniciá sesión para adquirir un curso.");
  }

  try {
    const existente = await obtenerAdquisicion(curso.id);
    if (existente) {
      if (existente.estado === "cancelada") {
        return fallo("cancelada", "Tu adquisición de este curso fue cancelada. Contactá a la administración de la plataforma.");
      }
      return fallo("ya-adquirido", "Ya adquiriste este curso.");
    }

    await setDoc(doc(db, "adquisiciones", idAdquisicion(usuario.uid, curso.id)), {
      uid: usuario.uid,
      cursoId: curso.id,
      cursoNombre: curso.nombre,
      importe: Number(curso.precio),
      metodoPago: "simulado",
      estado: "confirmada",
      fecha: serverTimestamp()
    });

    return { exito: true };
  } catch (error) {
    return traducirErrorFirestore(error);
  }
}

// Convierte el valor guardado en Firestore (Timestamp) en una fecha, o null.
function aFecha(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === "function") return valor.toDate();
  const fecha = new Date(valor);
  return isNaN(fecha.getTime()) ? null : fecha;
}

// Devuelve todas las adquisiciones de la plataforma, de la más reciente a la
// más antigua, con el nombre y el correo de la persona que las hizo:
//   { id, uid, cursoId, cursoNombre, importe, estado, fecha (Date o null),
//     estudiante, email }
// Solo para el administrador. Si falla alguna consulta, lanza el error.
async function obtenerTodasLasAdquisiciones() {
  const [adquisiciones, usuarios] = await Promise.all([
    getDocs(collection(db, "adquisiciones")),
    getDocs(collection(db, "usuarios"))
  ]);

  const personas = {};
  usuarios.docs.forEach((d) => {
    const datos = d.data();
    personas[d.id] = {
      nombre: ((datos.nombre || "") + " " + (datos.apellido || "")).trim(),
      email: datos.email || ""
    };
  });

  const lista = adquisiciones.docs.map((d) => {
    const datos = d.data();
    const persona = personas[datos.uid] || { nombre: "", email: "" };
    return {
      id: d.id,
      uid: datos.uid,
      cursoId: datos.cursoId,
      cursoNombre: datos.cursoNombre,
      importe: Number(datos.importe) || 0,
      estado: datos.estado,
      fecha: aFecha(datos.fecha),
      estudiante: persona.nombre,
      email: persona.email
    };
  });

  lista.sort((a, b) => {
    const fa = a.fecha ? a.fecha.getTime() : 0;
    const fb = b.fecha ? b.fecha.getTime() : 0;
    return fb - fa;
  });
  return lista;
}

// Cambia el estado de una adquisición a "confirmada" o "cancelada". Es lo único
// que las reglas permiten modificar. Si falla, lanza el error.
async function cambiarEstadoAdquisicion(id, estado) {
  if (estado !== "confirmada" && estado !== "cancelada") {
    throw new Error("Estado de adquisición no válido: " + estado);
  }
  await updateDoc(doc(db, "adquisiciones", id), { estado: estado });
}

export {
  adquirirCurso,
  obtenerAdquisicion,
  obtenerNivelAcceso,
  obtenerTodasLasAdquisiciones,
  cambiarEstadoAdquisicion
};
