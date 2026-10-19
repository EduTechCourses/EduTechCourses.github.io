// EduTechCourses — sección "Cursos" del panel administrativo
//
// Contrato con js/pages/admin.js (issue #78):
//   - admin.js llama a iniciarCursos(contenedor) cada vez que se abre la sección,
//     y solo después de confirmar que el usuario es administrador.
//   - Este módulo dibuja todo su contenido dentro de "contenedor" y vuelve a
//     pedir los datos a Firestore cada vez, para no mostrar información vieja.
//   - Los modales se insertan en #contenedor-modales.
//   - Si algo falla al cargar, el error se lanza hacia admin.js, que muestra el
//     aviso dentro de esta sección sin afectar a las demás.
//
// Issue #79: lista todos los cursos (activos e inactivos) y permite activarlos
// o desactivarlos. Un curso inactivo desaparece de las páginas públicas.

import {
  obtenerTodosLosCursos,
  cambiarEstadoCurso,
  datosCategoria,
  escaparHTML
} from "../modules/cursos-servicio.js";

// Escapa texto para usarlo dentro de un atributo HTML entre comillas.
function escaparAtributo(texto) {
  return escaparHTML(texto).replace(/"/g, "&quot;");
}

function encabezadoHTML(total) {
  const texto = total === 1 ? "1 curso en total." : total + " cursos en total.";
  return `
    <div class="mb-4">
      <h1 class="h4 mb-1">Gestión de cursos</h1>
      <p class="text-body-secondary small mb-0">${texto}</p>
    </div>`;
}

function tarjetaHTML(valor, etiqueta, color) {
  const estilo = color ? ` style="color:${color};"` : "";
  return `
    <div class="col-6 col-md-3">
      <div class="stat-card">
        <p class="stat-value mb-0"${estilo}>${valor}</p>
        <p class="stat-label mb-0">${etiqueta}</p>
      </div>
    </div>`;
}

function filaHTML(curso) {
  const categoria = datosCategoria(curso.categoria);
  const activo = curso.activo === true;
  const imagen = curso.imagen
    ? `<img src="${escaparAtributo(curso.imagen)}" alt="" width="44" height="36" class="rounded-2 flex-shrink-0" style="object-fit:cover;">`
    : "";

  return `
    <tr>
      <td class="ps-3">
        <div class="d-flex align-items-center gap-2">
          ${imagen}
          <span class="fw-semibold">${escaparHTML(curso.nombre)}</span>
        </div>
      </td>
      <td><span class="badge-category ${categoria.clase}">${escaparHTML(categoria.label)}</span></td>
      <td class="text-nowrap">USD ${escaparHTML(String(curso.precio))}</td>
      <td class="text-nowrap"><span class="status-dot ${activo ? "active" : "inactive"}"></span>${activo ? "Activo" : "Inactivo"}</td>
      <td class="text-end pe-3 text-nowrap">
        <button type="button" class="btn btn-link btn-sm p-0 link-secondary text-decoration-none"
          data-accion="estado" data-id="${escaparAtributo(curso.id)}" data-activo="${activo}">
          ${activo ? "Desactivar" : "Activar"}
        </button>
      </td>
    </tr>`;
}

function tablaHTML(cursos) {
  if (cursos.length === 0) {
    return `<div class="stat-card text-center text-body-secondary">Todavía no hay cursos cargados.</div>`;
  }
  return `
    <div class="stat-card p-0">
      <div class="table-responsive">
        <table class="table table-admin align-middle mb-0">
          <thead>
            <tr>
              <th class="ps-3">Curso</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Estado</th>
              <th class="text-end pe-3">Acciones</th>
            </tr>
          </thead>
          <tbody>${cursos.map(filaHTML).join("")}</tbody>
        </table>
      </div>
    </div>`;
}

// Trae los cursos y dibuja la sección completa. "aviso" es un mensaje de error
// opcional que se muestra arriba de la tabla (por ejemplo, si falló un cambio).
async function dibujar(contenedor, aviso) {
  const cursos = await obtenerTodosLosCursos();

  const activos = cursos.filter((c) => c.activo === true).length;
  const estudiantes = cursos.reduce((suma, c) => suma + (Number(c.estudiantes) || 0), 0);

  contenedor.innerHTML =
    encabezadoHTML(cursos.length) +
    (aviso ? `<div class="alert alert-danger" role="alert">${escaparHTML(aviso)}</div>` : "") +
    `<div class="row g-3 mb-4">` +
    tarjetaHTML(cursos.length, "Total cursos") +
    tarjetaHTML(activos, "Activos", "var(--teal-dark)") +
    tarjetaHTML(cursos.length - activos, "Inactivos", "var(--ink-faint)") +
    tarjetaHTML(estudiantes, "Estudiantes totales") +
    `</div>` +
    tablaHTML(cursos);

  contenedor.querySelectorAll('[data-accion="estado"]').forEach(function (boton) {
    boton.addEventListener("click", function () {
      cambiarEstado(contenedor, boton).catch(function (error) {
        console.error("No se pudo recargar la sección de cursos:", error);
        contenedor.innerHTML =
          '<div class="alert alert-danger" role="alert">No se pudo cargar esta sección. Probá recargar la página.</div>';
      });
    });
  });
}

async function cambiarEstado(contenedor, boton) {
  const activar = boton.dataset.activo !== "true";
  boton.disabled = true;
  boton.textContent = "Guardando…";

  try {
    await cambiarEstadoCurso(boton.dataset.id, activar);
  } catch (error) {
    console.error("No se pudo cambiar el estado del curso:", error);
    await dibujar(contenedor, "No se pudo cambiar el estado del curso. Revisá tu conexión e intentá de nuevo.");
    return;
  }
  await dibujar(contenedor);
}

export async function iniciarCursos(contenedor) {
  contenedor.innerHTML = '<p class="text-body-secondary">Cargando cursos…</p>';
  await dibujar(contenedor);
}