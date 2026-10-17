// EduTechCourses — acceso a la colección "cursos" de Firestore
//
// Reemplaza a js/modules/datos-cursos.js (catálogo hardcodeado).
// Lo usan inicio.js, catalogo.js, detalle-curso.js y el panel admin.
// Centraliza las consultas para que ninguna página
// llame directamente al SDK de Firestore para leer cursos.
//
// Estructura de cada documento (id = id del documento):
//   nombre, categoria, precio, nivel, descripcion, imagen,
//   rating, estudiantes, temario [{ titulo, duracion, gratis }],
//   activo (bool), destacado (bool), fechaCreacion (timestamp)
 
import { db } from "../firebase-config.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
 
// Datos de presentación de cada categoría. Se guardan acá y no en
// Firestore para que el admin solo tenga que elegir la categoría.
const CATEGORIAS = {
  robotica: { label: "Robótica", clase: "badge-cat-teal" },
  diseno: { label: "Diseño", clase: "badge-cat-purple" },
  programacion: { label: "Programación", clase: "badge-cat-blue" },
  idiomas: { label: "Idiomas", clase: "badge-cat-pink" },
  mentorias: { label: "Mentorías", clase: "badge-cat-amber" }
};
 
function datosCategoria(clave) {
  return CATEGORIAS[clave] || { label: clave || "Sin categoría", clase: "" };
}
 
// Devuelve los cursos activos, ordenados por nombre. El filtro
// activo == true es obligatorio: las reglas de Firestore rechazan
// la consulta si no lo incluye (un visitante no puede leer inactivos).
async function obtenerCursosActivos() {
  const consulta = query(collection(db, "cursos"), where("activo", "==", true));
  const snapshot = await getDocs(consulta);
  const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return lista;
}
 
// Devuelve todos los cursos, activos e inactivos, ordenados por nombre.
// Solo lo puede usar el administrador: las reglas de Firestore rechazan
// esta consulta para cualquier otro rol. Lo usa el panel admin.
async function obtenerTodosLosCursos() {
  const snapshot = await getDocs(collection(db, "cursos"));
  const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return lista;
}

// Activa o desactiva un curso (campo "activo"). Solo el administrador puede
// escribir en "cursos". Si falla, lanza el error para que lo trate la pantalla.
async function cambiarEstadoCurso(id, activo) {
  await updateDoc(doc(db, "cursos", id), { activo: activo === true });
}

// Devuelve un curso por id, o null si no existe o no se puede leer
// (por ejemplo, un curso inactivo consultado por un no-admin).
async function obtenerCursoPorId(id) {
  try {
    const snapshot = await getDoc(doc(db, "cursos", id));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  } catch (error) {
    if (error.code === "permission-denied") return null;
    throw error;
  }
}
 
// Estrellas de rating (llenas, media y vacías). Antes estaba en datos-cursos.js.
function generarEstrellasHTML(rating) {
  const llenas = Math.floor(rating);
  const media = (rating - llenas) >= 0.5 ? 1 : 0;
  const vacias = 5 - llenas - media;
  let html = "";
  for (let i = 0; i < llenas; i++) html += '<i class="bi bi-star-fill"></i>';
  if (media) html += '<i class="bi bi-star-half"></i>';
  for (let i = 0; i < vacias; i++) html += '<i class="bi bi-star"></i>';
  return html;
}
 
// Evita que texto cargado desde Firestore se interprete como HTML
// al insertarlo con innerHTML.
function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}
 
export {
  CATEGORIAS,
  datosCategoria,
  obtenerCursosActivos,
  obtenerTodosLosCursos,
  cambiarEstadoCurso,
  obtenerCursoPorId,
  generarEstrellasHTML,
  escaparHTML
};