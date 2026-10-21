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
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { esUrlDeImagen } from "./imagenes-servicio.js";

 
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

// Niveles que se pueden elegir al crear o editar un curso desde el panel.
const NIVELES = ["Inicial", "Intermedio", "Avanzado", "Todos los niveles"];

// Imagen que se asigna a los cursos nuevos creados desde el panel cuando no se sube una.
const IMAGEN_CURSO_POR_DEFECTO = "assets/img/curso-nuevo.svg";
 
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

// Convierte las líneas escritas en el panel (una por módulo) en el temario que
// se guarda en Firestore. El primer módulo es la vista previa gratuita.
// "previo" es el temario que tenía el curso antes de editarlo (opcional): los
// módulos que conservan su título mantienen la duración que ya tenían.
function temarioDesdeLineas(lineas, previo) {
  const anteriores = previo || [];
  return lineas
    .map((linea) => String(linea).trim())
    .filter((linea) => linea !== "")
    .map((titulo, indice) => {
      const existente = anteriores.find((modulo) => modulo.titulo === titulo);
      let duracion = "PDF + video";
      if (indice === 0) duracion = "Vista previa gratuita";
      else if (existente && !existente.gratis) duracion = existente.duracion;
      return { titulo: titulo, duracion: duracion, gratis: indice === 0 };
    });
}

// Revisa los datos que carga el administrador. Lanza un Error con el motivo si
// alguno no es válido (la pantalla ya valida, esto es una segunda barrera).
function validarDatosCurso(datos) {
  if (!datos || String(datos.nombre || "").trim() === "") throw new Error("El título es obligatorio.");
  if (!CATEGORIAS[datos.categoria]) throw new Error("La categoría no es válida.");
  if (!(Number(datos.precio) > 0)) throw new Error("El precio tiene que ser mayor que cero.");
  if (!NIVELES.includes(datos.nivel)) throw new Error("El nivel no es válido.");
  if (String(datos.descripcion || "").trim() === "") throw new Error("La descripción es obligatoria.");
    if (temarioDesdeLineas(datos.temario || []).length === 0) throw new Error("El temario necesita al menos un módulo.");
  // La imagen es opcional: una imagen subida a Cloudinary o una de la carpeta assets/img.
  if (datos.imagen !== undefined && !esUrlDeImagen(datos.imagen) && !String(datos.imagen).startsWith("assets/img/")) {
    throw new Error("La imagen no es válida.");
  }
}

// Crea un curso nuevo y devuelve su id. "datos" trae nombre, categoria, precio,
// nivel, descripcion y temario (lista de líneas, una por módulo) y, de forma
// opcional, imagen (dirección de Cloudinary). El resto de los campos arrancan
// con valores por defecto: el curso nace activo, sin destacar, con rating 0,
// sin estudiantes y, si no se subió una imagen, con la imagen por defecto.
// El id empieza con "c" y usa solo minúsculas y números, porque viaja en la
// dirección detalle-curso.html?id=... y en el parámetro "volver" del login.
// Solo el administrador puede escribir en "cursos". Si falla, lanza el error.
async function crearCurso(datos) {
  validarDatosCurso(datos);

  const id = "c" + Date.now().toString(36);
  await setDoc(doc(db, "cursos", id), {
    nombre: String(datos.nombre).trim(),
    categoria: datos.categoria,
    precio: Number(datos.precio),
    nivel: datos.nivel,
    descripcion: String(datos.descripcion).trim(),
    imagen: datos.imagen || IMAGEN_CURSO_POR_DEFECTO,
    rating: 0,
    estudiantes: 0,
    temario: temarioDesdeLineas(datos.temario),
    activo: true,
    destacado: false,
    fechaCreacion: serverTimestamp()
  });
  return id;
}

// Actualiza los datos editables de un curso: nombre, categoría, precio, nivel,
// descripción y temario. "datos" trae los mismos campos que crearCurso; la imagen
// se cambia solo si "datos.imagen" viene informada. No se tocan el rating, los
// estudiantes, el estado, el destacado ni la fecha de creación. Solo el
// administrador puede escribir en "cursos".
// Si falla, lanza el error para que lo trate la pantalla.
async function actualizarCurso(id, datos) {
  validarDatosCurso(datos);

  const referencia = doc(db, "cursos", id);
  const actual = await getDoc(referencia);
  if (!actual.exists()) throw new Error("El curso ya no existe.");

  await updateDoc(referencia, {
    nombre: String(datos.nombre).trim(),
    categoria: datos.categoria,
    precio: Number(datos.precio),
    nivel: datos.nivel,
    descripcion: String(datos.descripcion).trim(),
    temario: temarioDesdeLineas(datos.temario, actual.data().temario),
    ...(datos.imagen ? { imagen: datos.imagen } : {})
  });

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
  NIVELES,
  IMAGEN_CURSO_POR_DEFECTO,
  datosCategoria,
obtenerCursosActivos,
  obtenerTodosLosCursos,
  cambiarEstadoCurso,
  crearCurso,
  actualizarCurso,
  obtenerCursoPorId,
  generarEstrellasHTML,
  escaparHTML
};