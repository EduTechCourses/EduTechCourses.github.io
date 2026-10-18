// EduTechCourses — sección "Usuarios" del panel administrativo
//
// Contrato con js/pages/admin.js (issue #78):
//   - admin.js llama a iniciarUsuarios(contenedor) cada vez que se abre la sección,
//     y solo después de confirmar que el usuario es administrador.
//   - Este módulo dibuja todo su contenido dentro de "contenedor" y vuelve a
//     pedir los datos a Firestore cada vez, para no mostrar información vieja.
//   - Los modales se insertan en #contenedor-modales.
//   - Si algo falla al cargar, el error se lanza hacia admin.js, que muestra el
//     aviso dentro de esta sección sin afectar a las demás.
//
// Issue #82: lista los usuarios registrados, con su rol, la cantidad de cursos
// adquiridos y la fecha de registro. Es solo de consulta: no hay acciones.

import { obtenerUsuarios } from "../modules/usuarios-servicio.js";
import { escaparHTML } from "../modules/cursos-servicio.js";

function formatearFecha(fecha) {
  if (!fecha) return "—";
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  return dia + "/" + mes + "/" + fecha.getFullYear();
}

function textoCursos(cantidad) {
  return cantidad === 1 ? "1 curso" : cantidad + " cursos";
}

function tarjetaHTML(valor, etiqueta, color) {
  const estilo = color ? ` style="color:${color};"` : "";
  return `
    <div class="col-6 col-md-4">
      <div class="stat-card">
        <p class="stat-value mb-0"${estilo}>${valor}</p>
        <p class="stat-label mb-0">${etiqueta}</p>
      </div>
    </div>`;
}

function filaHTML(usuario) {
  const nombre = (usuario.nombre + " " + usuario.apellido).trim() || "Sin nombre";
  const esAdmin = usuario.rol === "administrador";

  return `
    <tr>
      <td class="ps-3 fw-semibold">${escaparHTML(nombre)}</td>
      <td class="text-body-secondary">${escaparHTML(usuario.email)}</td>
      <td><span class="badge-category ${esAdmin ? "badge-cat-purple" : ""}">${esAdmin ? "Administrador" : "Estudiante"}</span></td>
      <td class="text-nowrap">${textoCursos(usuario.cursosAdquiridos)}</td>
      <td class="text-body-secondary text-nowrap pe-3">${formatearFecha(usuario.fechaRegistro)}</td>
    </tr>`;
}

function tablaHTML(usuarios) {
  if (usuarios.length === 0) {
    return `<div class="stat-card text-center text-body-secondary">Todavía no hay usuarios registrados.</div>`;
  }
  return `
    <div class="stat-card p-0">
      <div class="table-responsive">
        <table class="table table-admin align-middle mb-0">
          <thead>
            <tr>
              <th class="ps-3">Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Cursos adquiridos</th>
              <th class="pe-3">Fecha de registro</th>
            </tr>
          </thead>
          <tbody>${usuarios.map(filaHTML).join("")}</tbody>
        </table>
      </div>
    </div>`;
}

export async function iniciarUsuarios(contenedor) {
  contenedor.innerHTML = '<p class="text-body-secondary">Cargando usuarios…</p>';

  const usuarios = await obtenerUsuarios();

  const estudiantes = usuarios.filter((u) => u.rol !== "administrador");
  const conCursos = estudiantes.filter((u) => u.cursosAdquiridos > 0).length;
  const texto = usuarios.length === 1 ? "1 usuario registrado." : usuarios.length + " usuarios registrados.";

  contenedor.innerHTML = `
    <div class="mb-4">
      <h1 class="h4 mb-1">Gestión de usuarios</h1>
      <p class="text-body-secondary small mb-0">${texto}</p>
    </div>
    <div class="row g-3 mb-4">` +
    tarjetaHTML(usuarios.length, "Total usuarios") +
    tarjetaHTML(conCursos, "Estudiantes con cursos", "var(--teal-dark)") +
    tarjetaHTML(estudiantes.length - conCursos, "Estudiantes sin cursos aún", "var(--ink-faint)") +
    `</div>` +
    tablaHTML(usuarios);
}
