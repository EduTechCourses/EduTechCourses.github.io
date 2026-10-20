// EduTechCourses — contenido de los cursos (PDF y videos)
//
// Cada curso puede tener tres enlaces:
//   - vistaPreviaUrl: video corto y público. Se guarda en el documento del curso
//     (cursos/{id}) y lo ve cualquier persona en la página del curso.
//   - pdfUrl y videoUrl: la guía en PDF y el video del curso completo. Se guardan
//     en cursos/{id}/contenido/principal, un documento aparte que las reglas de
//     Firestore solo dejan leer al administrador y a quien adquirió el curso.
//
// Los enlaces se cargan desde el panel administrativo. Solo se aceptan enlaces
// de Google Drive (video o PDF) y de YouTube (solo video). Antes de mostrarlos se
// convierten a su dirección de incrustación, que se arma con el identificador del
// archivo: nunca se usa el texto pegado como dirección del iframe.
//
// Limitación conocida: el enlace no se muestra en pantalla, pero quien tenga
// acceso al contenido puede verlo con las herramientas del navegador y
// compartirlo. Una protección total requeriría servir los archivos desde
// Firebase Storage con enlaces temporales.

import { db } from "../firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const ID_DRIVE = /^[A-Za-z0-9_-]{10,}$/;
const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;

function leerEnlace(enlace) {
  try {
    const url = new URL(String(enlace).trim());
    return url.protocol === "https:" ? url : null;
  } catch (error) {
    return null;
  }
}

// Google Drive: https://drive.google.com/file/d/<id>/view?usp=sharing
//           o   https://drive.google.com/open?id=<id>
function incrustarDrive(url) {
  if (url.hostname !== "drive.google.com") return null;

  const coincidencia = url.pathname.match(/^\/file\/d\/([^/]+)/);
  const id = coincidencia ? coincidencia[1] : url.searchParams.get("id");
  if (!id || !ID_DRIVE.test(id)) return null;

  return "https://drive.google.com/file/d/" + id + "/preview";
}

// YouTube: watch?v=<id>, youtu.be/<id>, /embed/<id>, /shorts/<id> o /live/<id>.
function incrustarYoutube(url) {
  let id = null;

  if (url.hostname === "youtu.be") {
    id = url.pathname.slice(1);
  } else if (["www.youtube.com", "youtube.com", "m.youtube.com"].includes(url.hostname)) {
    const coincidencia = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
    id = coincidencia ? coincidencia[1] : url.searchParams.get("v");
  }
  if (!id || !ID_YOUTUBE.test(id)) return null;

  return "https://www.youtube-nocookie.com/embed/" + id;
}

// Convierte un enlace pegado por el administrador en la dirección que se usa en
// el iframe, o devuelve null si el enlace no es válido para ese tipo.
//   tipo "video": acepta Google Drive y YouTube
//   tipo "pdf":   acepta solo Google Drive
function urlParaIncrustar(enlace, tipo) {
  const url = leerEnlace(enlace);
  if (!url) return null;

  const drive = incrustarDrive(url);
  if (drive) return drive;

  return tipo === "video" ? incrustarYoutube(url) : null;
}

// Devuelve { pdfUrl, videoUrl } del curso. Si todavía no se cargó nada, los
// dos vienen vacíos. Si falla la consulta (por ejemplo, la persona no adquirió
// el curso y las reglas la rechazan), lanza el error.
async function obtenerContenido(cursoId) {
  const snapshot = await getDoc(doc(db, "cursos", cursoId, "contenido", "principal"));
  const datos = snapshot.exists() ? snapshot.data() : {};
  return { pdfUrl: datos.pdfUrl || "", videoUrl: datos.videoUrl || "" };
}

// Guarda los tres enlaces del curso. Un enlace vacío borra el valor anterior.
// Primero valida los tres y, si alguno no sirve, no guarda nada. Solo el
// administrador puede escribir. Si falla, lanza el error.
async function guardarEnlacesCurso(cursoId, enlaces) {
  const vistaPreviaUrl = String(enlaces.vistaPreviaUrl || "").trim();
  const pdfUrl = String(enlaces.pdfUrl || "").trim();
  const videoUrl = String(enlaces.videoUrl || "").trim();

  if (vistaPreviaUrl && !urlParaIncrustar(vistaPreviaUrl, "video")) {
    throw new Error("El enlace de la vista previa no es válido.");
  }
  if (pdfUrl && !urlParaIncrustar(pdfUrl, "pdf")) {
    throw new Error("El enlace del PDF no es válido.");
  }
  if (videoUrl && !urlParaIncrustar(videoUrl, "video")) {
    throw new Error("El enlace del video no es válido.");
  }

  await setDoc(doc(db, "cursos", cursoId, "contenido", "principal"), {
    pdfUrl: pdfUrl,
    videoUrl: videoUrl
  });
  await updateDoc(doc(db, "cursos", cursoId), { vistaPreviaUrl: vistaPreviaUrl });
}

export { urlParaIncrustar, obtenerContenido, guardarEnlacesCurso };
