// EduTechCourses — sección "Resumen" del panel administrativo
//
// Contrato con js/pages/admin.js (issue #78):
//   - admin.js llama a iniciarResumen(contenedor) cada vez que se abre la sección,
//     y solo después de confirmar que el usuario es administrador.
//   - Este módulo dibuja todo su contenido dentro de "contenedor" y vuelve a
//     pedir los datos a Firestore cada vez, para no mostrar información vieja.
//   - Los modales se insertan en #contenedor-modales.
//   - Si algo falla al cargar, el error se lanza hacia admin.js, que muestra el
//     aviso dentro de esta sección sin afectar a las demás.
//
// Issue #84: indicadores generales de la plataforma, ranking de los cursos más
// adquiridos y últimas adquisiciones. Es solo de consulta. Los ingresos son
// simulados: no se cobra nada.

import { obtenerResumen } from "../modules/resumen-servicio.js";
import { escaparHTML } from "../modules/cursos-servicio.js";

function formatearFecha(fecha) {
  if (!fecha) return "—";
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  return dia + "/" + mes + "/" + fecha.getFullYear();
}

function tarjetaHTML(valor, etiqueta, color) {
  const estilo = color ? ` style="color:${color};"` : "";
  return `
    <div class="col-6 col-lg-3">
      <div class="stat-card">
        <p class="stat-value mb-0"${estilo}>${valor}</p>
        <p class="stat-label mb-0">${etiqueta}</p>
      </div>
    </div>`;
}

function rankingHTML(ranking) {
  if (ranking.length === 0) {
    return '<p class="text-body-secondary small mb-0">Todavía no hay adquisiciones confirmadas.</p>';
  }
  const maximo = ranking[0].cantidad;
  return ranking.map(function (curso, indice) {
    const porcentaje = Math.round((curso.cantidad / maximo) * 100);
    return `
      <div class="mb-3">
        <div class="d-flex justify-content-between gap-2 small mb-1">
          <span class="fw-semibold">${indice + 1}. ${escaparHTML(curso.cursoNombre)}</span>
          <span class="text-body-secondary text-nowrap">${curso.cantidad === 1 ? "1 adquisición" : curso.cantidad + " adquisiciones"}</span>
        </div>
        <div class="progress" style="height:6px;" role="progressbar" aria-label="${curso.cantidad} adquisiciones" aria-valuenow="${porcentaje}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar" style="width:${porcentaje}%; background:var(--teal);"></div>
        </div>
      </div>`;
  }).join("");
}

function ultimasHTML(ultimas) {
  if (ultimas.length === 0) {
    return '<p class="text-body-secondary small mb-0">Todavía no hay adquisiciones registradas.</p>';
  }
  return ultimas.map(function (a) {
    const confirmada = a.estado === "confirmada";
    return `
      <div class="d-flex justify-content-between align-items-start gap-2 py-2 border-bottom">
        <div>
          <div class="fw-semibold small">${escaparHTML(a.cursoNombre)}</div>
          <div class="small text-body-secondary">${escaparHTML(a.estudiante || "Sin nombre")} · ${formatearFecha(a.fecha)}</div>
        </div>
        <div class="text-end text-nowrap small">
          <div>USD ${a.importe.toLocaleString("es-UY")}</div>
          <div class="text-body-secondary"><span class="status-dot ${confirmada ? "active" : "inactive"}"></span>${confirmada ? "Confirmada" : "Cancelada"}</div>
        </div>
      </div>`;
  }).join("");
}

export async function iniciarResumen(contenedor) {
  contenedor.innerHTML = '<p class="text-body-secondary">Cargando resumen…</p>';

  const r = await obtenerResumen();

  contenedor.innerHTML = `
    <div class="mb-4">
      <h1 class="h4 mb-1">Resumen de la plataforma</h1>
      <p class="text-body-secondary small mb-0">Indicadores generales. Los ingresos son simulados: no se cobra nada.</p>
    </div>
    <div class="row g-3 mb-4">` +
    tarjetaHTML(r.totalUsuarios, "Usuarios registrados") +
    tarjetaHTML(r.cursosActivos, "Cursos activos (de " + r.totalCursos + ")", "var(--teal-dark)") +
    tarjetaHTML(r.adquisicionesConfirmadas, "Adquisiciones confirmadas") +
    tarjetaHTML("USD " + r.ingresos.toLocaleString("es-UY"), "Ingresos simulados") +
    `</div>
    <div class="row g-3">
      <div class="col-lg-6">
        <div class="stat-card h-100">
          <h2 class="h6 mb-3">Cursos más adquiridos</h2>
          ${rankingHTML(r.ranking)}
        </div>
      </div>
      <div class="col-lg-6">
        <div class="stat-card h-100">
          <h2 class="h6 mb-2">Últimas adquisiciones</h2>
          ${ultimasHTML(r.ultimas)}
        </div>
      </div>
    </div>`;
}