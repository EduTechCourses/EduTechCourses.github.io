// EduTechCourses — lectura de usuarios para el panel administrativo
//
// Solo lo usa el panel admin (sección "Usuarios"). Las reglas de Firestore
// permiten leer todos los documentos de "usuarios" y de "adquisiciones" únicamente
// al administrador: para cualquier otro rol estas consultas son rechazadas.
//
// No se devuelve el teléfono: el panel no lo necesita.

import { db } from "../firebase-config.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Convierte el valor guardado en Firestore (Timestamp) en una fecha, o null.
function aFecha(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === "function") return valor.toDate();
  const fecha = new Date(valor);
  return isNaN(fecha.getTime()) ? null : fecha;
}

// Devuelve todos los usuarios, del más reciente al más antiguo, cada uno con
// la cantidad de cursos que tiene adquiridos (solo adquisiciones confirmadas):
//   { uid, nombre, apellido, email, rol, fechaRegistro (Date o null), cursosAdquiridos }
// Si falla alguna consulta, lanza el error para que lo trate la pantalla.
async function obtenerUsuarios() {
  const [usuarios, adquisiciones] = await Promise.all([
    getDocs(collection(db, "usuarios")),
    getDocs(collection(db, "adquisiciones"))
  ]);

  const confirmadasPorUsuario = {};
  adquisiciones.docs.forEach((d) => {
    const adquisicion = d.data();
    if (adquisicion.estado === "confirmada") {
      confirmadasPorUsuario[adquisicion.uid] = (confirmadasPorUsuario[adquisicion.uid] || 0) + 1;
    }
  });

  const lista = usuarios.docs.map((d) => {
    const datos = d.data();
    return {
      uid: d.id,
      nombre: datos.nombre || "",
      apellido: datos.apellido || "",
      email: datos.email || "",
      rol: datos.rol || "estudiante",
      fechaRegistro: aFecha(datos.fechaRegistro),
      cursosAdquiridos: confirmadasPorUsuario[d.id] || 0
    };
  });

  lista.sort((a, b) => {
    const fa = a.fechaRegistro ? a.fechaRegistro.getTime() : 0;
    const fb = b.fechaRegistro ? b.fechaRegistro.getTime() : 0;
    return fb - fa;
  });
  return lista;
}

export { obtenerUsuarios };
