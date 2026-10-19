// EduTechCourses — indicadores generales para el panel administrativo
//
// Solo lo usa la sección "Resumen" del panel admin. Las reglas de Firestore
// permiten leer todos los documentos de "cursos", "usuarios" y "adquisiciones"
// únicamente al administrador.
//
// Los ingresos son simulados: el pago de la plataforma no cobra nada.

import { db } from "../firebase-config.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const CANTIDAD_RANKING = 5;
const CANTIDAD_ULTIMAS = 5;

// Convierte el valor guardado en Firestore (Timestamp) en una fecha, o null.
function aFecha(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === "function") return valor.toDate();
  const fecha = new Date(valor);
  return isNaN(fecha.getTime()) ? null : fecha;
}

// Devuelve los indicadores de la plataforma:
//   {
//     totalUsuarios, totalCursos, cursosActivos,
//     adquisicionesConfirmadas, adquisicionesCanceladas, ingresos,
//     ranking: [{ cursoId, cursoNombre, cantidad }]   (hasta 5, solo confirmadas)
//     ultimas: [{ id, cursoNombre, estudiante, importe, estado, fecha }] (las 5 más recientes)
//   }
// Si falla alguna consulta, lanza el error para que lo trate la pantalla.
async function obtenerResumen() {
  const [cursos, usuarios, adquisiciones] = await Promise.all([
    getDocs(collection(db, "cursos")),
    getDocs(collection(db, "usuarios")),
    getDocs(collection(db, "adquisiciones"))
  ]);

  const nombres = {};
  usuarios.docs.forEach((d) => {
    const datos = d.data();
    nombres[d.id] = ((datos.nombre || "") + " " + (datos.apellido || "")).trim() || datos.email || "";
  });

  const lista = adquisiciones.docs.map((d) => {
    const datos = d.data();
    return {
      id: d.id,
      cursoId: datos.cursoId,
      cursoNombre: datos.cursoNombre || "",
      estudiante: nombres[datos.uid] || "",
      importe: Number(datos.importe) || 0,
      estado: datos.estado,
      fecha: aFecha(datos.fecha)
    };
  });

  const confirmadas = lista.filter((a) => a.estado === "confirmada");

  const porCurso = {};
  confirmadas.forEach((a) => {
    if (!porCurso[a.cursoId]) {
      porCurso[a.cursoId] = { cursoId: a.cursoId, cursoNombre: a.cursoNombre, cantidad: 0 };
    }
    porCurso[a.cursoId].cantidad++;
  });
  const ranking = Object.values(porCurso)
    .sort((a, b) => b.cantidad - a.cantidad || a.cursoNombre.localeCompare(b.cursoNombre, "es"))
    .slice(0, CANTIDAD_RANKING);

  const ultimas = lista
    .slice()
    .sort((a, b) => (b.fecha ? b.fecha.getTime() : 0) - (a.fecha ? a.fecha.getTime() : 0))
    .slice(0, CANTIDAD_ULTIMAS);

  return {
    totalUsuarios: usuarios.docs.length,
    totalCursos: cursos.docs.length,
    cursosActivos: cursos.docs.filter((d) => d.data().activo === true).length,
    adquisicionesConfirmadas: confirmadas.length,
    adquisicionesCanceladas: lista.length - confirmadas.length,
    ingresos: confirmadas.reduce((suma, a) => suma + a.importe, 0),
    ranking: ranking,
    ultimas: ultimas
  };
}

export { obtenerResumen };
