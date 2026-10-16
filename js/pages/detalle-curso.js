// EduTechCourses — lógica de la pantalla Detalle de curso
// Lee el curso desde Firestore según el parámetro ?id= de la URL y gestiona
// la adquisición del curso con pago simulado (modal #modalPago).
//
// Control de acceso: lo que se muestra (vista previa o contenido completo)
// depende del nivel de acceso que devuelve obtenerNivelAcceso, que sale de
// Firestore: "visitante", "sin-curso", "con-curso" o "admin".

import { auth } from "../firebase-config.js";
import {
  obtenerCursoPorId,
  datosCategoria,
  escaparHTML
} from "../modules/cursos-servicio.js";
import { adquirirCurso, obtenerNivelAcceso } from "../modules/adquisiciones-servicio.js";

let cursoActual = null;

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

// ---------- Adquisición con pago simulado ----------

function elModalPago() {
  return document.getElementById("modalPago");
}

// Deja el modal en su estado inicial: resumen visible, sin mensajes.
function reiniciarModalPago() {
  document.getElementById("pagoResumen").classList.remove("d-none");
  document.getElementById("pagoAcciones").classList.remove("d-none");
  document.getElementById("pagoExito").classList.add("d-none");
  document.getElementById("pagoError").classList.add("d-none");

  const boton = document.getElementById("btnConfirmarPago");
  boton.disabled = false;
  boton.innerHTML = '<i class="bi bi-lock me-1"></i> Confirmar adquisición';
}

function mostrarErrorPago(mensaje) {
  const caja = document.getElementById("pagoError");
  caja.textContent = mensaje;
  caja.classList.remove("d-none");
}

// ---------- Control de acceso ----------

const BLOQUES_CONTENIDO = ["estado-cargando", "estado-no-suscripto", "estado-suscripto"];
const BLOQUES_ACCION = ["accion-cargando", "accion-no-suscripto", "accion-suscripto", "accion-admin"];

// Deja visible solo el bloque indicado de la lista y oculta los demás.
function mostrarSoloUno(ids, visible) {
  ids.forEach((id) => {
    document.getElementById(id).classList.toggle("d-none", id !== visible);
  });
}

// Muestra la vista previa o el contenido completo, y la acción de la barra
// lateral, según el nivel de acceso de la persona.
function aplicarNivelAcceso(nivel) {
  const contenidoCompleto = nivel === "con-curso" || nivel === "admin";
  mostrarSoloUno(BLOQUES_CONTENIDO, contenidoCompleto ? "estado-suscripto" : "estado-no-suscripto");

  const bloqueAccion = nivel === "admin" ? "accion-admin"
    : nivel === "con-curso" ? "accion-suscripto"
    : "accion-no-suscripto";
  mostrarSoloUno(BLOQUES_ACCION, bloqueAccion);

  document.getElementById("contenidoCompletoTexto").textContent = nivel === "admin"
    ? "Estás viendo este curso como administrador: tenés acceso a todos los módulos, el PDF descargable y todos los videos."
    : "Estás suscripto a este curso: tenés acceso a todos los módulos, el PDF descargable y todos los videos.";

  document.getElementById("accionNota").textContent = nivel === "visitante"
    ? "Se necesita una cuenta para suscribirte"
    : "Pago simulado: no se solicitan datos de tarjeta";
}

// Refleja en la pantalla que el curso ya fue adquirido.
function marcarComoAdquirido() {
  aplicarNivelAcceso("con-curso");
}

// Consulta el nivel de acceso en Firestore y actualiza la pantalla. Si la
// consulta falla, queda la vista previa (nunca se muestra el contenido completo
// sin haberlo confirmado).
async function resolverAcceso() {
  try {
    aplicarNivelAcceso(await obtenerNivelAcceso(cursoActual.id));
  } catch (error) {
    console.error("No se pudo consultar el acceso al curso:", error);
    aplicarNivelAcceso("sin-curso");
  }
}

// Clic en «Suscribirme»: sin sesión lleva al login (y vuelve a este curso);
// con sesión abre el modal con el resumen de la adquisición.
async function iniciarAdquisicion() {
  await auth.authStateReady();

  if (!auth.currentUser) {
    const destino = "detalle-curso.html?id=" + encodeURIComponent(cursoActual.id);
    window.location.href = "login.html?volver=" + encodeURIComponent(destino);
    return;
  }

  document.getElementById("pagoCursoNombre").textContent = cursoActual.nombre;
  document.getElementById("pagoCursoPrecio").innerHTML = `USD ${Number(cursoActual.precio)}`;
  reiniciarModalPago();
  bootstrap.Modal.getOrCreateInstance(elModalPago()).show();
}

// Clic en «Confirmar adquisición» dentro del modal.
async function confirmarAdquisicion() {
  const boton = document.getElementById("btnConfirmarPago");
  boton.disabled = true;
  boton.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Procesando...';
  document.getElementById("pagoError").classList.add("d-none");

  const resultado = await adquirirCurso(cursoActual);

  if (resultado.exito) {
    document.getElementById("pagoResumen").classList.add("d-none");
    document.getElementById("pagoAcciones").classList.add("d-none");
    document.getElementById("pagoExito").classList.remove("d-none");
    marcarComoAdquirido();
    return;
  }

  // Ya lo tenía: no se duplica nada, solo se informa y se refleja el estado.
  if (resultado.codigo === "ya-adquirido") {
    marcarComoAdquirido();
  }

  mostrarErrorPago(resultado.mensaje);
  boton.disabled = false;
  boton.innerHTML = '<i class="bi bi-lock me-1"></i> Confirmar adquisición';
}

function prepararAdquisicion() {
  const botonSuscribirme = document.getElementById("btnSuscribirme");
  botonSuscribirme.addEventListener("click", iniciarAdquisicion);
  document.getElementById("btnConfirmarPago").addEventListener("click", confirmarAdquisicion);
  resolverAcceso();
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
    cursoActual = curso;
    renderizarCurso(curso);
    prepararAdquisicion();
  } catch (error) {
    console.error("Error al cargar el curso:", error);
    mostrarMensajeCentral("bi-wifi-off", "No se pudo cargar el curso", "Revisá tu conexión y recargá la página.");
  }
}

iniciarDetalle();
