// EduTechCourses — sección "Adquisiciones" del panel administrativo
//
// Contrato con js/pages/admin.js (issue #78):
//   - admin.js llama a iniciarAdquisiciones(contenedor) cada vez que se abre la
//     sección, y solo después de confirmar que el usuario es administrador.
//   - Este módulo dibuja todo su contenido dentro de "contenedor" y vuelve a
//     pedir los datos a Firestore cada vez, para no mostrar información vieja.
//   - Los modales se insertan en #contenedor-modales.
//   - Si algo falla al cargar, el error se lanza hacia admin.js, que muestra el
//     aviso dentro de esta sección sin afectar a las demás.
//
// Issue #83: lista todas las adquisiciones, permite filtrarlas por estado y
// cancelarlas o reactivarlas (con confirmación). Los importes son simulados:
// no se cobra nada, por eso los ingresos se muestran como "simulados".

import {
  obtenerTodasLasAdquisiciones,
  cambiarEstadoAdquisicion
} from "../modules/adquisiciones-servicio.js";
import { escaparHTML } from "../modules/cursos-servicio.js";

const ID_MODAL = "modalEstadoAdquisicion";

function escaparAtributo(texto) {
  return escaparHTML(texto).replace(/"/g, "&quot;");
}

function formatearFecha(fecha) {
  if (!fecha) return "—";
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  return dia + "/" + mes + "/" + fecha.getFullYear();
}

function formatearImporte(importe) {
  return "USD " + importe.toLocaleString("es-UY");
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

function filaHTML(adquisicion) {
  const confirmada = adquisicion.estado === "confirmada";
  const persona = adquisicion.estudiante || "Sin nombre";

  return `
    <tr>
      <td class="ps-3 text-body-secondary text-nowrap">${formatearFecha(adquisicion.fecha)}</td>
      <td>
        <div class="fw-semibold">${escaparHTML(persona)}</div>
        <div class="small text-body-secondary">${escaparHTML(adquisicion.email)}</div>
      </td>
      <td>${escaparHTML(adquisicion.cursoNombre)}</td>
      <td class="text-nowrap">${formatearImporte(adquisicion.importe)}</td>
      <td class="text-nowrap"><span class="status-dot ${confirmada ? "active" : "inactive"}"></span>${confirmada ? "Confirmada" : "Cancelada"}</td>
      <td class="text-end pe-3 text-nowrap">
        <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none ${confirmada ? "link-danger" : "link-secondary"}"
          data-accion="estado" data-id="${escaparAtributo(adquisicion.id)}">
          ${confirmada ? "Cancelar" : "Reactivar"}
        </button>
      </td>
    </tr>`;
}

function tablaHTML(adquisiciones, hayAdquisiciones) {
  if (adquisiciones.length === 0) {
    const texto = hayAdquisiciones
      ? "No hay adquisiciones con ese estado."
      : "Todavía no hay adquisiciones registradas.";
    return `<div class="stat-card text-center text-body-secondary">${texto}</div>`;
  }
  return `
    <div class="stat-card p-0">
      <div class="table-responsive">
        <table class="table table-admin align-middle mb-0">
          <thead>
            <tr>
              <th class="ps-3">Fecha</th>
              <th>Estudiante</th>
              <th>Curso</th>
              <th>Importe</th>
              <th>Estado</th>
              <th class="text-end pe-3">Acciones</th>
            </tr>
          </thead>
          <tbody>${adquisiciones.map(filaHTML).join("")}</tbody>
        </table>
      </div>
    </div>`;
}

// Inserta (o reemplaza) el modal de confirmación en #contenedor-modales.
function insertarModal() {
  const anterior = document.getElementById(ID_MODAL);
  if (anterior) anterior.remove();

  document.getElementById("contenedor-modales").insertAdjacentHTML("beforeend", `
    <div class="modal fade" id="${ID_MODAL}" tabindex="-1" aria-labelledby="${ID_MODAL}Titulo" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title h5" id="${ID_MODAL}Titulo"></h2>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body">
            <p class="mb-0" id="${ID_MODAL}Texto"></p>
            <div class="alert alert-danger d-none mt-3 mb-0" role="alert" id="${ID_MODAL}Error"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Volver</button>
            <button type="button" class="btn" id="${ID_MODAL}Confirmar"></button>
          </div>
        </div>
      </div>
    </div>`);

  return document.getElementById(ID_MODAL);
}

export async function iniciarAdquisiciones(contenedor) {
  contenedor.innerHTML = '<p class="text-body-secondary">Cargando adquisiciones…</p>';

  const elementoModal = insertarModal();
  const modal = window.bootstrap.Modal.getOrCreateInstance(elementoModal);
  const botonConfirmar = document.getElementById(ID_MODAL + "Confirmar");
  const avisoModal = document.getElementById(ID_MODAL + "Error");

  // Adquisición sobre la que se está pidiendo confirmación y estado al que pasaría.
  let pendiente = null;

  // Trae los datos y dibuja la sección completa. "filtro" es "todas",
  // "confirmada" o "cancelada" y solo cambia qué filas se ven en la tabla.
  async function cargar(filtro) {
    const todas = await obtenerTodasLasAdquisiciones();
    dibujar(todas, filtro);
  }

  function dibujar(todas, filtro) {
    const confirmadas = todas.filter((a) => a.estado === "confirmada");
    const ingresos = confirmadas.reduce((suma, a) => suma + a.importe, 0);
    const visibles = filtro === "todas" ? todas : todas.filter((a) => a.estado === filtro);
    const texto = todas.length === 1 ? "1 adquisición registrada." : todas.length + " adquisiciones registradas.";

    contenedor.innerHTML = `
      <div class="mb-4">
        <h1 class="h4 mb-1">Gestión de adquisiciones</h1>
        <p class="text-body-secondary small mb-0">${texto} Los importes son simulados: no se cobra nada.</p>
      </div>
      <div class="row g-3 mb-4">` +
      tarjetaHTML(todas.length, "Total adquisiciones") +
      tarjetaHTML(confirmadas.length, "Confirmadas", "var(--teal-dark)") +
      tarjetaHTML(todas.length - confirmadas.length, "Canceladas", "var(--ink-faint)") +
      tarjetaHTML(formatearImporte(ingresos), "Ingresos simulados") +
      `</div>
      <div class="d-flex align-items-center gap-2 mb-3">
        <label for="filtroEstadoAdquisicion" class="form-label small mb-0">Estado</label>
        <select id="filtroEstadoAdquisicion" class="form-select form-select-sm w-auto">
          <option value="todas"${filtro === "todas" ? " selected" : ""}>Todas</option>
          <option value="confirmada"${filtro === "confirmada" ? " selected" : ""}>Confirmadas</option>
          <option value="cancelada"${filtro === "cancelada" ? " selected" : ""}>Canceladas</option>
        </select>
      </div>` +
      tablaHTML(visibles, todas.length > 0);

    document.getElementById("filtroEstadoAdquisicion").addEventListener("change", function (evento) {
      dibujar(todas, evento.target.value);
    });

    contenedor.querySelectorAll('[data-accion="estado"]').forEach(function (boton) {
      boton.addEventListener("click", function () {
        const adquisicion = todas.find((a) => a.id === boton.dataset.id);
        if (adquisicion) pedirConfirmacion(adquisicion, filtro);
      });
    });
  }

  function pedirConfirmacion(adquisicion, filtro) {
    const cancelar = adquisicion.estado === "confirmada";
    pendiente = { id: adquisicion.id, estado: cancelar ? "cancelada" : "confirmada", filtro: filtro };

    const persona = adquisicion.estudiante || adquisicion.email || "esta persona";
    document.getElementById(ID_MODAL + "Titulo").textContent = cancelar ? "Cancelar adquisición" : "Reactivar adquisición";
    document.getElementById(ID_MODAL + "Texto").textContent = cancelar
      ? "¿Cancelar la adquisición de «" + adquisicion.cursoNombre + "» de " + persona + "? Dejará de ver el contenido completo del curso."
      : "¿Reactivar la adquisición de «" + adquisicion.cursoNombre + "» de " + persona + "? Volverá a tener acceso al contenido completo del curso.";

    botonConfirmar.textContent = cancelar ? "Cancelar adquisición" : "Reactivar";
    botonConfirmar.className = "btn " + (cancelar ? "btn-danger" : "btn-brand");
    botonConfirmar.disabled = false;
    avisoModal.classList.add("d-none");
    modal.show();
  }

  botonConfirmar.addEventListener("click", async function () {
    if (!pendiente) return;
    const { id, estado, filtro } = pendiente;

    botonConfirmar.disabled = true;
    avisoModal.classList.add("d-none");

    try {
      await cambiarEstadoAdquisicion(id, estado);
    } catch (error) {
      console.error("No se pudo cambiar el estado de la adquisición:", error);
      avisoModal.textContent = "No se pudo guardar el cambio. Revisá tu conexión e intentá de nuevo.";
      avisoModal.classList.remove("d-none");
      botonConfirmar.disabled = false;
      return;
    }

    pendiente = null;
    modal.hide();
    try {
      await cargar(filtro);
    } catch (error) {
      console.error("No se pudo recargar la sección de adquisiciones:", error);
      contenedor.innerHTML =
        '<div class="alert alert-danger" role="alert">No se pudo cargar esta sección. Probá recargar la página.</div>';
    }
  });

  await cargar("todas");
}
