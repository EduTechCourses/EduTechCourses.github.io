// EduTechCourses — valoraciones y opiniones de los cursos en Firestore
//
// Es el único lugar que conoce la colección "valoraciones". Las pantallas
// (opiniones.js, catalogo.js e inicio.js) usan solo las funciones de este módulo.
//
// Estructura de cada documento (id = "<cursoId>_<uid>": una opinión por persona y curso):
//   cursoId, uid, nombreUsuario, puntuacion (entero de 1 a 5),
//   texto (3 a 500 caracteres), fecha (timestamp del servidor)
// Solo pueden opinar quienes adquirieron el curso (lo exigen las reglas de Firestore).
// Las opiniones no se editan ni se borran.

import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { generarEstrellasHTML } from "./cursos-servicio.js";

// Error "esperable" (por ejemplo, ya opinó): permite mostrar el motivo exacto
// en lugar de un mensaje técnico.
class ErrorValoracion extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = "ErrorValoracion";
  }
}

function milisegundos(valoracion) {
  return valoracion.fecha && valoracion.fecha.toMillis ? valoracion.fecha.toMillis() : 0;
}

// Devuelve las opiniones de un curso, de la más reciente a la más antigua. Se
// ordena en el cliente para no depender de un índice compuesto de Firestore.
// Si la consulta falla, lanza el error para que lo trate la pantalla.
async function obtenerValoraciones(cursoId) {
  const consulta = query(collection(db, "valoraciones"), where("cursoId", "==", cursoId));
  const snapshot = await getDocs(consulta);
  const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  lista.sort((a, b) => milisegundos(b) - milisegundos(a));
  return lista;
}

// Devuelve el promedio de puntuación de una lista de opiniones (0 si está vacía).
function promedioDe(lista) {
  if (lista.length === 0) return 0;
  return lista.reduce((suma, v) => suma + v.puntuacion, 0) / lista.length;
}

// Devuelve { [cursoId]: { promedio, cantidad } } con todas las opiniones, para
// mostrar el promedio de cada curso en el catálogo y en el inicio. Los cursos sin
// opiniones no aparecen en el resultado.
async function obtenerResumenValoraciones() {
  const snapshot = await getDocs(collection(db, "valoraciones"));
  const porCurso = {};
  snapshot.forEach((d) => {
    const valoracion = d.data();
    if (!porCurso[valoracion.cursoId]) porCurso[valoracion.cursoId] = [];
    porCurso[valoracion.cursoId].push(valoracion);
  });

  const resumen = {};
  Object.keys(porCurso).forEach((cursoId) => {
    resumen[cursoId] = { promedio: promedioDe(porCurso[cursoId]), cantidad: porCurso[cursoId].length };
  });
  return resumen;
}

// HTML con las estrellas y el promedio de un curso, o «Sin valoraciones» si todavía
// no tiene. "resumen" es el elemento de obtenerResumenValoraciones() para ese curso.
function valoracionHTML(resumen) {
  if (!resumen) return '<p class="small text-body-secondary mb-1">Sin valoraciones</p>';
  return `
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="rating-stars">${generarEstrellasHTML(resumen.promedio)}</span>
              <span class="rating-value">${resumen.promedio.toFixed(1)}</span>
              <span class="small text-body-secondary">(${resumen.cantidad})</span>
            </div>`;
}

// Guarda la opinión de una persona sobre un curso. El id "<cursoId>_<uid>" garantiza
// como máximo una por persona y curso; como las reglas no permiten modificar, un
// segundo intento se detecta antes y se informa con un mensaje claro. Las reglas
// también rechazan la opinión de quien no adquirió el curso.
async function publicarValoracion({ cursoId, uid, puntuacion, texto }) {
  const referencia = doc(db, "valoraciones", cursoId + "_" + uid);

  if ((await getDoc(referencia)).exists()) {
    throw new ErrorValoracion("Ya opinaste sobre este curso.");
  }

  // El nombre se copia del perfil al opinar (nombre e inicial del apellido), para
  // mostrarlo sin leer el documento de cada autor: las reglas de "usuarios" solo
  // dejan leer el propio.
  const perfil = await getDoc(doc(db, "usuarios", uid));
  let nombreUsuario = "Estudiante";
  if (perfil.exists()) {
    const datos = perfil.data();
    const apellido = String(datos.apellido || "").trim();
    nombreUsuario = (String(datos.nombre || "").trim() + (apellido ? " " + apellido.charAt(0) + "." : "")).trim() || "Estudiante";
  }

  await setDoc(referencia, {
    cursoId: cursoId,
    uid: uid,
    nombreUsuario: nombreUsuario,
    puntuacion: puntuacion,
    texto: texto,
    // La fecha la pone el servidor: las reglas exigen fecha == request.time.
    fecha: serverTimestamp()
  });
}

export {
  ErrorValoracion,
  obtenerValoraciones,
  obtenerResumenValoraciones,
  promedioDe,
  valoracionHTML,
  publicarValoracion
};