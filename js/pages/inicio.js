// EduTechCourses — lógica de la pantalla Inicio
// Muestra hasta 3 cursos activos marcados como destacado: true en Firestore.

import {
  obtenerCursosActivos,
  datosCategoria,
  escaparHTML
} from "../modules/cursos-servicio.js";
import { obtenerResumenValoraciones, valoracionHTML } from "../modules/valoraciones-servicio.js";

async function mostrarDestacados() {
  const contenedor = document.getElementById("cursosDestacados");

  let destacados;
  try {
    const cursos = await obtenerCursosActivos();
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
            <h3 class="h6 mt-3 mb-2">${nombre}</h3>            <h3 class="h6 mt-3 mb-2">${nombre}</h3>${valoracionHTML(resumenValoraciones[curso.id])}
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
