// EduTechCourses — lógica de la pantalla Detalle de curso
// Lee el curso desde Firestore según el parámetro ?id= de la URL y gestiona
// la adquisición del curso con pago simulado (modal #modalPago).
//
// Control de acceso: lo que se muestra (vista previa o contenido completo)
// depende del nivel de acceso que devuelve obtenerNivelAcceso, que sale de
// Firestore: "visitante", "sin-curso", "con-curso" o "admin".
//
// Contenido (issue #86): la vista previa es un video público guardado en el
// curso (vistaPreviaUrl). El video y la guía en PDF se leen de
// cursos/{id}/contenido/principal solo cuando la persona tiene acceso; las
// reglas de Firestore rechazan esa lectura a cualquier otra persona. Los
// enlaces se convierten a su dirección de incrustación (ver contenido-servicio.js).

import { auth } from "../firebase-config.js";
import {
  obtenerCursoPorId,
  datosCategoria,
  escaparHTML
} from "../modules/cursos-servicio.js";
import { adquirirCurso, obtenerNivelAcceso } from "../modules/adquisiciones-servicio.js";
import { urlParaIncrustar, obtenerContenido } from "../modules/contenido-servicio.js";

let cursoActual = null;
let contenidoCargado = false;

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

// ---------- Vista previa y contenido del curso ----------

// Arma un iframe con atributos puestos uno por uno (sin armar HTML con texto),
// dentro de una caja con proporción fija. "proporcion" es el alto como porcentaje
// del ancho: 56.25 para un video 16:9 y más alto para una hoja de PDF.
function crearReproductor(direccion, titulo, proporcion) {
  const caja = document.createElement("div");
  caja.className = "ratio rounded-3 overflow-hidden";
  caja.style.setProperty("--bs-aspect-ratio", proporcion + "%");

  const marco = document.createElement("iframe");
  marco.src = direccion;
  marco.title = titulo;
  marco.loading = "lazy";
  marco.allow = "autoplay; fullscreen";

  caja.appendChild(marco);
  return caja;
}

function crearSubtitulo(texto) {
  const subtitulo = document.createElement("h3");
  subtitulo.className = "h6 mb-2";
  subtitulo.textContent = texto;
  return subtitulo;
}

// Muestra el video de vista previa del curso, o un aviso si todavía no tiene.
function mostrarVistaPrevia(curso) {
  const contenedor = document.getElementById("vistaPreviaContenedor");
  contenedor.textContent = "";

  const direccion = curso.vistaPreviaUrl ? urlParaIncrustar(curso.vistaPreviaUrl, "video") : null;
  if (direccion) {
    contenedor.appendChild(crearReproductor(direccion, "Vista previa de " + curso.nombre, 56.25));
    return;
  }

  const aviso = document.createElement("p");
  aviso.className = "small text-body-secondary mb-0";
  aviso.textContent = "Este curso todavía no tiene un video de vista previa.";
  contenedor.appendChild(aviso);
}

// Lee el video y la guía en PDF del curso y los muestra. Solo se llama cuando
// la persona tiene acceso; si las reglas rechazaran la lectura, se avisa.
async function cargarContenidoProtegido() {
  if (contenidoCargado) return;
  contenidoCargado = true;

  const caja = document.getElementById("contenidoProtegido");
  caja.innerHTML = `
    <div class="small text-body-secondary">
      <div class="spinner-border spinner-border-sm me-2" aria-hidden="true"></div>
      Cargando el contenido del curso...
    </div>`;

  try {
    const contenido = await obtenerContenido(cursoActual.id);
    const video = urlParaIncrustar(contenido.videoUrl, "video");
    const pdf = urlParaIncrustar(contenido.pdfUrl, "pdf");

    caja.textContent = "";

    if (!video && !pdf) {
      const aviso = document.createElement("p");
      aviso.className = "small text-body-secondary mb-0";
      aviso.textContent = "El contenido de este curso todavía no está disponible. Volvé a probar más adelante.";
      caja.appendChild(aviso);
      return;
    }

    if (video) {
      caja.appendChild(crearSubtitulo("Video del curso"));
      caja.appendChild(crearReproductor(video, "Video de " + cursoActual.nombre, 56.25));
    }
    if (pdf) {
      const subtitulo = crearSubtitulo("Guía en PDF");
      if (video) subtitulo.classList.add("mt-4");
      caja.appendChild(subtitulo);
      caja.appendChild(crearReproductor(pdf, "Guía en PDF de " + cursoActual.nombre, 130));
    }
  } catch (error) {
    console.error("No se pudo cargar el contenido del curso:", error);
    contenidoCargado = false;
    caja.innerHTML = '<div class="alert alert-warning small mb-0" role="alert">No pudimos cargar el contenido del curso. Recargá la página para intentarlo de nuevo.</div>';
  }
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
    ? "Estás viendo este curso como administrador: tenés acceso a todo el contenido, la guía en PDF y el video del curso."
    : "Estás suscripto a este curso: tenés acceso a todo el contenido, la guía en PDF y el video del curso.";

  if (contenidoCompleto) cargarContenidoProtegido();

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
    mostrarVistaPrevia(curso);
    prepararAdquisicion();
  } catch (error) {
    console.error("Error al cargar el curso:", error);
    mostrarMensajeCentral("bi-wifi-off", "No se pudo cargar el curso", "Revisá tu conexión y recargá la página.");
  }
}

iniciarDetalle();
