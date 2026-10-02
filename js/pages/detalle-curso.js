// EduTechCourses — lógica de la pantalla Detalle de curso
// Lee el curso desde Firestore según el parámetro ?id= de la URL.
// El alternador "Visitante / Usuario suscripto" sigue siendo demostrativo
// (mostrarEstadoCurso en base.js) hasta la issue del flujo de adquisición.

import {
  obtenerCursoPorId,
  datosCategoria,
  escaparHTML
} from "../modules/cursos-servicio.js";

function generarTemarioHTML(temario) {
  let html = "";
  temario.forEach((modulo, index) => {
    html += `
      <li class="list-group-item d-flex justify-content-between align-items-start">
        <div class="ms-2 me-auto">
          <div class="fw-semibold">Módulo ${index + 1} · ${escaparHTML(modulo.titulo)}</div>
          <span class="small text-body-secondary">${escaparHTML(modulo.duracion)}</span>
        </div>
        ${modulo.gratis ? '<span class="badge bg-success-subtle text-success-emphasis">Gratis</span>' : ""}
      </li>
    `;
  });
  return html;
}

function renderizarCurso(curso) {
  const cat = datosCategoria(curso.categoria);
  const temario = curso.temario || [];

  document.title = curso.nombre + " — EduTechCourses";
  document.getElementById("breadcrumbCurso").textContent = curso.nombre;

  const badge = document.getElementById("cursoBadge");
  badge.textContent = cat.label;
  badge.className = "badge-category " + cat.clase;

  document.getElementById("cursoTitulo").textContent = curso.nombre;
  document.getElementById("cursoDescripcionCorta").textContent = curso.descripcion;
  document.getElementById("cursoDescripcionLarga").textContent = curso.descripcion;
  document.getElementById("cursoNivel").textContent = curso.nivel;

  document.getElementById("cursoTemario").innerHTML = generarTemarioHTML(temario);
  document.getElementById("cursoModulos").textContent = temario.length;

  const imagen = document.getElementById("cursoImagen");
  imagen.src = curso.imagen;
  imagen.alt = "Curso de " + curso.nombre;

  document.getElementById("cursoPrecio").innerHTML = `USD ${Number(curso.precio)} <small>/ curso</small>`;
}

function mostrarMensajeCentral(icono, titulo, texto) {
  document.getElementById("breadcrumbCurso").textContent = titulo;
  document.getElementById("contenidoCurso").innerHTML = `
    <div class="col-12 text-center py-5">
      <i class="bi ${icono} display-4 text-body-secondary d-block mb-3"></i>
      <h1 class="h4">${titulo}</h1>
      <p class="text-body-secondary">${texto}</p>
      <a href="catalogo.html" class="btn btn-brand mt-2">Volver al catálogo</a>
    </div>
  `;
}

async function iniciarDetalle() {
  const id = new URLSearchParams(window.location.search).get("id");

  if (!id) {
    mostrarMensajeCentral("bi-search", "No encontramos ese curso", "El enlace no indica qué curso mostrar.");
    return;
  }

  try {
    const curso = await obtenerCursoPorId(id);
    if (!curso) {
      mostrarMensajeCentral("bi-search", "No encontramos ese curso", "El enlace puede estar roto, o el curso ya no está disponible.");
      return;
    }
    renderizarCurso(curso);
  } catch (error) {
    console.error("Error al cargar el curso:", error);
    mostrarMensajeCentral("bi-wifi-off", "No se pudo cargar el curso", "Revisá tu conexión y recargá la página.");
  }
}

iniciarDetalle();