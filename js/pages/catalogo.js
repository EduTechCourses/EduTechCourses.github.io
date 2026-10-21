// EduTechCourses — lógica de la pantalla Catálogo
// Lee los cursos desde Firestore a través de js/modules/cursos-servicio.js.
// Se carga como <script type="module">, por eso las funciones llamadas
// desde onclick/onkeyup/onchange se exponen en window al final.

import {
  obtenerCursosActivos,
  datosCategoria,
  escaparHTML
} from "../modules/cursos-servicio.js";

let cursos = [];
let categoriaActiva = "todas";

// Genera las tarjetas del catálogo a partir de un array de cursos
function mostrarCursos(lista) {
  const contenedor = document.getElementById("grillaCursos");
  let html = "";

  lista.forEach((curso) => {
    const cat = datosCategoria(curso.categoria);
    const nombre = escaparHTML(curso.nombre);
    html += `
      <div class="col-sm-6 col-lg-4 col-xl-3">
        <div class="course-card">
          <img src="${escaparHTML(curso.imagen)}" alt="Curso de ${nombre}" class="course-thumb">
          <div class="card-body">
            <span class="badge-category ${cat.clase}">${cat.label}</span>
            <h3 class="h6 mt-3 mb-2">${nombre}</h3>${(curso.temario || []).length} módulos
            <p class="course-meta mb-3">${curso.estudiantes || 0} estudiantes · ${(curso.temario || []).length} módulos</p>
            <a href="detalle-curso.html?id=${encodeURIComponent(curso.id)}" class="fw-semibold text-navy small text-decoration-none">Ver curso <i class="bi bi-arrow-right"></i></a>
          </div>
        </div>
      </div>
    `;
  });

  contenedor.innerHTML = html;

  const contador = document.getElementById("contadorResultados");
  contador.textContent = lista.length + " curso" + (lista.length === 1 ? "" : "s") + " encontrado" + (lista.length === 1 ? "" : "s");
  document.getElementById("sinResultados").classList.toggle("d-none", lista.length !== 0);
}

// Combina búsqueda + categoría + precio máximo sobre los cursos cargados.
// El valor vacío del selector de precio significa "sin límite".
function filtrarCatalogo() {
  const texto = document.getElementById("buscador").value.toLowerCase().trim();
  const valorPrecio = document.getElementById("filtroPrecio").value;
  const precioMax = valorPrecio === "" ? Infinity : Number(valorPrecio);

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

async function iniciarCatalogo() {
  const contador = document.getElementById("contadorResultados");
  contador.textContent = "Cargando cursos...";

  try {
    cursos = await obtenerCursosActivos();
  } catch (error) {
    console.error("Error al cargar cursos:", error);
    contador.textContent = "";
    document.getElementById("grillaCursos").innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger mb-0">No se pudo cargar el catálogo. Revisá tu conexión y recargá la página.</div>
      </div>
    `;
    return;
  }

  mostrarCursos(cursos);

  // Preseleccionar categoría si viene desde el inicio (?categoria=robotica)
  const params = new URLSearchParams(window.location.search);
  const cat = params.get("categoria");
  if (cat) {
    const chip = document.querySelector('.category-chip[data-categoria="' + cat + '"]');
    if (chip) seleccionarCategoria(chip);
  }
}

window.filtrarCatalogo = filtrarCatalogo;
window.seleccionarCategoria = seleccionarCategoria;

iniciarCatalogo();