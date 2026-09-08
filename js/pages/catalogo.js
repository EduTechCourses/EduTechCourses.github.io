// EduTechCourses — lógica de la pantalla Catálogo
// Depende de js/modules/datos-cursos.js (debe cargarse antes que este archivo)
 
let categoriaActiva = "todas";
 
// Genera las tarjetas del catálogo a partir de un array de cursos
function mostrarCursos(lista) {
  const contenedor = document.getElementById("grillaCursos");
  contenedor.innerHTML = "";
 
  lista.forEach((curso) => {
    contenedor.innerHTML += `
      <div class="col-sm-6 col-lg-4 col-xl-3">
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
            <a href="detalle-curso.html?id=${curso.id}" class="fw-semibold text-navy small text-decoration-none">Ver curso <i class="bi bi-arrow-right"></i></a>
          </div>
        </div>
      </div>
    `;
  });
 
  const contador = document.getElementById("contadorResultados");
  contador.textContent = lista.length + " curso" + (lista.length === 1 ? "" : "s") + " encontrado" + (lista.length === 1 ? "" : "s");
  document.getElementById("sinResultados").classList.toggle("d-none", lista.length !== 0);
}
 
// Combina búsqueda + categoría + precio máximo sobre el array original de cursos
function filtrarCatalogo() {
  const texto = document.getElementById("buscador").value.toLowerCase().trim();
  const precioMax = Number(document.getElementById("filtroPrecio").value);
 
  const resultado = cursos.filter((curso) => {
    const coincideNombre = curso.nombre.toLowerCase().includes(texto);
    const coincideCategoria = categoriaActiva === "todas" || curso.categoria === categoriaActiva;
    const coincidePrecio = curso.precio <= precioMax;
    return coincideNombre && coincideCategoria && coincidePrecio;
  });
 
  mostrarCursos(resultado);
}
 
function seleccionarCategoria(chip) {
  document.querySelectorAll("#chipsCategoria .category-chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  categoriaActiva = chip.dataset.categoria;
  filtrarCatalogo();
}
 
document.addEventListener("DOMContentLoaded", function () {
  mostrarCursos(cursos);
 
  // Preseleccionar categoría si viene desde el inicio (?categoria=robotica)
  const params = new URLSearchParams(window.location.search);
  const cat = params.get("categoria");
  if (cat) {
    const chip = document.querySelector('.category-chip[data-categoria="' + cat + '"]');
    if (chip) seleccionarCategoria(chip);
  }
});