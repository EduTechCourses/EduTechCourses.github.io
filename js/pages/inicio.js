// EduTechCourses — lógica de la pantalla Inicio
// Muestra hasta 3 cursos activos marcados como destacado: true en Firestore y las
// cifras de la portada (cursos y opiniones), calculadas con los datos reales.

import {
  obtenerCursosActivos,
  datosCategoria,
  escaparHTML
} from "../modules/cursos-servicio.js";
import { obtenerResumenValoraciones, valoracionHTML } from "../modules/valoraciones-servicio.js";

// Completa las cifras de la portada con datos reales. Si algo no se pudo leer o
// todavía no hay opiniones, queda el guion que trae el HTML: nunca un número inventado.
function mostrarEstadisticas(cursos, resumenValoraciones) {
  document.getElementById("statCursos").textContent = cursos.length;

  const resumenes = Object.values(resumenValoraciones);
  const totalOpiniones = resumenes.reduce((suma, r) => suma + r.cantidad, 0);
  if (totalOpiniones === 0) return;

  const sumaPuntos = resumenes.reduce((suma, r) => suma + r.promedio * r.cantidad, 0);
  document.getElementById("statOpiniones").textContent = totalOpiniones;
  document.getElementById("statPromedio").textContent = (sumaPuntos / totalOpiniones).toFixed(1);
}

async function mostrarDestacados() {
  const contenedor = document.getElementById("cursosDestacados");

  let cursos;
  let destacados;
  try {
    cursos = await obtenerCursosActivos();
    destacados = cursos.filter((curso) => curso.destacado).slice(0, 3);
  } catch (error) {
    console.error("Error al cargar destacados:", error);
    contenedor.innerHTML = `
      <div class="col-12">
        <p class="text-body-secondary mb-0">No se pudieron cargar los cursos destacados. <a href="catalogo.html" class="text-navy fw-semibold">Ver el catálogo</a></p>
      </div>
    `;
    return;
  }

  // Si no se pueden leer las opiniones, los cursos se muestran igual, sin promedios.
  let resumenValoraciones = {};
  try {
    resumenValoraciones = await obtenerResumenValoraciones();
  } catch (error) {
    console.error("No se pudieron cargar las valoraciones:", error);
  }

  mostrarEstadisticas(cursos, resumenValoraciones);
  
  let html = "";
  destacados.forEach((curso) => {
    const cat = datosCategoria(curso.categoria);
    const nombre = escaparHTML(curso.nombre);
    html += `
      <div class="col-md-4">
        <div class="course-card">
          <img src="${escaparHTML(curso.imagen)}" alt="Curso de ${nombre}" class="course-thumb">
          <div class="card-body">
            <span class="badge-category ${cat.clase}">${cat.label}</span>
            <h3 class="h6 mt-3 mb-2">${nombre}</h3>${valoracionHTML(resumenValoraciones[curso.id])}
            <p class="course-meta mb-3">${(curso.temario || []).length} módulos</p>
            <div class="d-flex justify-content-between align-items-center">
              <span class="course-price">USD ${Number(curso.precio)} <small>/ curso</small></span>
              <a href="detalle-curso.html?id=${encodeURIComponent(curso.id)}" class="btn btn-sm btn-outline-brand" style="color: var(--navy); border-color: var(--navy);">Ver curso</a>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  contenedor.innerHTML = html;
}

mostrarDestacados();
