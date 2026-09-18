// EduTechCourses — lógica de la pantalla Inicio
// Depende de js/modules/datos-cursos.js (debe cargarse antes que este archivo)
 
function mostrarDestacados() {
  const idsDestacados = [1, 3, 5]; // Robótica desde cero, Diseño 3D con Blender, Inglés profesional
  const destacados = cursos.filter((curso) => idsDestacados.includes(curso.id));
  const contenedor = document.getElementById("cursosDestacados");
 
  contenedor.innerHTML = "";
  destacados.forEach((curso) => {
    contenedor.innerHTML += `
      <div class="col-md-4">
        <div class="course-card">
          <img src="${curso.imagen}" alt="Curso de ${curso.nombre}" class="course-thumb">
          <div class="card-body">
            <span class="badge-category ${curso.categoriaClase}">${curso.categoriaLabel}</span>
            <h3 class="h6 mt-3 mb-2">${curso.nombre}</h3>
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="rating-stars">${generarEstrellasHTML(curso.rating)}</span>
              <span class="rating-value">${curso.rating.toFixed(1)}</span>
            </div>
            <p class="course-meta mb-3">${curso.estudiantes} estudiantes · ${curso.temario.length} módulos</p>
            <div class="d-flex justify-content-between align-items-center">
              <span class="course-price">USD ${curso.precio} <small>/ curso</small></span>
              <a href="detalle-curso.html?id=${curso.id}" class="btn btn-sm btn-outline-brand" style="color: var(--navy); border-color: var(--navy);">Ver curso</a>
            </div>
          </div>
        </div>
      </div>
    `;
  });
}
 
document.addEventListener("DOMContentLoaded", mostrarDestacados);