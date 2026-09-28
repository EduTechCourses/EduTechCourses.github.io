// EduTechCourses — lógica de la pantalla Detalle de curso
// Depende de js/modules/datos-cursos.js (debe cargarse antes que este archivo)
 
function generarTemarioHTML(temario) {
  let html = "";
  temario.forEach((modulo, index) => {
    html += `
      <li class="list-group-item d-flex justify-content-between align-items-start">
        <div class="ms-2 me-auto">
          <div class="fw-semibold">Módulo ${index + 1} · ${modulo.titulo}</div>
          <span class="small text-body-secondary">${modulo.duracion}</span>
        </div>
        ${modulo.gratis ? '<span class="badge bg-success-subtle text-success-emphasis">Gratis</span>' : ""}
      </li>
    `;
  });
  return html;
}
 
function renderizarCurso(curso) {
  document.title = curso.nombre + " — EduTechCourses";
 
  document.getElementById("breadcrumbCurso").textContent = curso.nombre;
 
  const badge = document.getElementById("cursoBadge");
  badge.textContent = curso.categoriaLabel;
  badge.className = "badge-category " + curso.categoriaClase;
 
  document.getElementById("cursoTitulo").textContent = curso.nombre;
  document.getElementById("cursoDescripcionCorta").textContent = curso.descripcion;
  document.getElementById("cursoDescripcionLarga").textContent = curso.descripcion;
  document.getElementById("cursoNivel").textContent = curso.nivel;
 
  document.getElementById("cursoTemario").innerHTML = generarTemarioHTML(curso.temario);
  document.getElementById("cursoModulos").textContent = curso.temario.length;
 
  const imagen = document.getElementById("cursoImagen");
  imagen.src = curso.imagen;
  imagen.alt = "Curso de " + curso.nombre;
 
  document.getElementById("cursoPrecio").innerHTML = `USD ${curso.precio} <small>/ curso</small>`;
}
 
function mostrarCursoNoEncontrado() {
  document.getElementById("contenidoCurso").innerHTML = `
    <div class="col-12 text-center py-5">
      <i class="bi bi-search display-4 text-body-secondary d-block mb-3"></i>
      <h1 class="h4">No encontramos ese curso</h1>
      <p class="text-body-secondary">El enlace puede estar roto, o el curso ya no está disponible.</p>
      <a href="catalogo.html" class="btn btn-brand mt-2">Volver al catálogo</a>
    </div>
  `;
}
 
document.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("id"));
  const curso = cursos.find((c) => c.id === id);
 
  if (!curso) {
    mostrarCursoNoEncontrado();
    return;
  }
 
  renderizarCurso(curso);
});