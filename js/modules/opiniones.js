// EduTechCourses — sección «Opiniones» del detalle de un curso
//
// La usa js/pages/detalle-curso.js:
//   - iniciarOpiniones(curso) agrega la sección debajo del contenido del curso y
//     carga las opiniones (promedio y lista).
//   - actualizarOpiniones(nivel) recibe el nivel de acceso de la persona
//     ("visitante", "sin-curso", "con-curso" o "admin") y decide qué mostrar sobre
//     la lista: invitación a ingresar, aviso, «ya opinaste» o el formulario.
// Solo pueden opinar quienes adquirieron el curso (las reglas de Firestore también lo exigen).

import { auth } from "../firebase-config.js";
import { escaparHTML, generarEstrellasHTML } from "./cursos-servicio.js";
import {
  obtenerValoraciones,
  promedioDe,
  publicarValoracion
} from "./valoraciones-servicio.js";

let curso = null;
let valoraciones = null; // null mientras carga o si no se pudieron cargar
let nivelAcceso = null; // null hasta que detalle-curso.js lo consulta

let zonaResumen = null;
let zonaFormulario = null;
let zonaLista = null;

function dibujarLista() {
  if (valoraciones.length === 0) {
    zonaResumen.textContent = "Todavía no hay opiniones.";
    zonaLista.innerHTML = '<p class="text-body-secondary mb-0">Sé la primera persona en opinar.</p>';
    return;
  }

  const promedio = promedioDe(valoraciones);
  zonaResumen.innerHTML = `
    <span class="rating-stars">${generarEstrellasHTML(promedio)}</span>
    <strong class="text-body">${promedio.toFixed(1)}</strong>
    · ${valoraciones.length} ${valoraciones.length === 1 ? "opinión" : "opiniones"}`;

  // El texto lo escriben las personas: se escapa antes de insertarlo en la página.
  zonaLista.innerHTML = valoraciones.map((v) => `
    <article class="stat-card mb-3">
      <div class="d-flex justify-content-between flex-wrap gap-2">
        <strong>${escaparHTML(v.nombreUsuario)}</strong>
        <span class="small text-body-secondary">${v.fecha && v.fecha.toDate ? v.fecha.toDate().toLocaleDateString("es-UY") : ""}</span>
      </div>
      <div class="my-1"><span class="rating-stars">${generarEstrellasHTML(Number(v.puntuacion))}</span></div>
      <p class="mb-0" style="white-space: pre-line;">${escaparHTML(v.texto)}</p>
    </article>`).join("");
}

function mensaje(texto) {
  return `<p class="mb-0 text-body-secondary">${texto}</p>`;
}

// Decide qué se muestra sobre la lista según el nivel de acceso de la persona.
function dibujarFormulario(aviso) {
  if (valoraciones === null || nivelAcceso === null) return;

  if (nivelAcceso === "visitante") {
    const destino = "detalle-curso.html?id=" + encodeURIComponent(curso.id);
    zonaFormulario.innerHTML = `
      ${mensaje("Iniciá sesión y adquirí el curso para dejar tu opinión.")}
      <a href="login.html?volver=${encodeURIComponent(destino)}" class="btn btn-outline-secondary btn-sm mt-2">Iniciar sesión</a>`;
    return;
  }
  if (nivelAcceso === "admin") {
    zonaFormulario.innerHTML = mensaje("Como administrador podés leer las opiniones, pero no publicar una.");
    return;
  }
  if (nivelAcceso !== "con-curso") {
    zonaFormulario.innerHTML = mensaje("Solo pueden opinar quienes adquirieron este curso.");
    return;
  }

  const usuario = auth.currentUser;
  if (!usuario) {
    zonaFormulario.innerHTML = mensaje("Iniciá sesión para dejar tu opinión.");
    return;
  }

  if (valoraciones.some((v) => v.uid === usuario.uid)) {
    zonaFormulario.innerHTML = (aviso ? '<div class="alert alert-success small" role="status">' + aviso + "</div>" : "")
      + mensaje("Ya opinaste sobre este curso. ¡Gracias!");
    return;
  }

  zonaFormulario.innerHTML = `
    <form id="formOpinion" novalidate>
      <fieldset class="mb-3">
        <legend class="form-label fs-6">Tu puntuación</legend>
        <div class="estrellas-fila">
          ${[5, 4, 3, 2, 1].map((n) => `
          <input type="radio" name="puntuacion" id="estrella${n}" value="${n}">
          <label for="estrella${n}"><i class="bi bi-star-fill"></i><span class="visually-hidden">${n} ${n === 1 ? "estrella" : "estrellas"}</span></label>`).join("")}
        </div>
      </fieldset>
      <div class="mb-3">
        <label for="textoOpinion" class="form-label">Tu opinión</label>
        <textarea class="form-control" id="textoOpinion" rows="3" maxlength="500"></textarea>
        <div class="form-text">Entre 3 y 500 caracteres.</div>
      </div>
      <div class="alert alert-danger small d-none" id="errorOpinion" role="alert"></div>
      <button type="submit" class="btn btn-brand">Publicar opinión</button>
    </form>`;

  const formulario = zonaFormulario.querySelector("#formOpinion");
  const error = zonaFormulario.querySelector("#errorOpinion");
  const boton = formulario.querySelector("button[type=submit]");

  formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    error.classList.add("d-none");

    // Se valida acá antes de consultar a Firebase; las reglas validan lo mismo
    // del lado del servidor, como segunda barrera.
    const elegida = formulario.querySelector("input[name=puntuacion]:checked");
    const texto = formulario.querySelector("#textoOpinion").value.trim();
    let problema = "";
    if (!elegida) problema = "Elegí una puntuación de 1 a 5 estrellas.";
    else if (texto.length < 3) problema = "La opinión debe tener al menos 3 caracteres.";
    else if (texto.length > 500) problema = "La opinión no puede superar los 500 caracteres.";

    if (problema) {
      error.textContent = problema;
      error.classList.remove("d-none");
      return;
    }

    boton.disabled = true; // evita publicar dos veces con un doble clic

    try {
      await publicarValoracion({
        cursoId: curso.id,
        uid: usuario.uid,
        puntuacion: Number(elegida.value),
        texto: texto
      });
    } catch (errorAlPublicar) {
      console.error("No se pudo publicar la opinión:", errorAlPublicar);
      if (errorAlPublicar.name === "ErrorValoracion") {
        error.textContent = errorAlPublicar.message;
      } else if (errorAlPublicar.code === "permission-denied") {
        error.textContent = "No se pudo publicar: solo pueden opinar quienes adquirieron el curso.";
      } else {
        error.textContent = "No se pudo publicar tu opinión. Revisá tu conexión e intentá de nuevo.";
      }
      error.classList.remove("d-none");
      boton.disabled = false;
      return;
    }

    // Se vuelve a pedir la lista para mostrar la opinión con su fecha real. Si esa
    // consulta fallara, la opinión ya quedó guardada: se avisa y se recarga la página.
    try {
      valoraciones = await obtenerValoraciones(curso.id);
      dibujarLista();
      dibujarFormulario("¡Gracias por tu opinión!");
    } catch (errorAlRecargar) {
      console.error("No se pudo recargar la lista de opiniones:", errorAlRecargar);
      zonaFormulario.innerHTML = '<div class="alert alert-success small mb-0" role="status">¡Gracias por tu opinión! Recargá la página para verla en la lista.</div>';
    }
  });
}

// Recibe el nivel de acceso de la persona y actualiza lo que se muestra sobre la lista.
function actualizarOpiniones(nivel) {
  nivelAcceso = nivel;
  dibujarFormulario();
}

// Agrega la sección «Opiniones» debajo del contenido del curso y carga la lista.
async function iniciarOpiniones(cursoDelDetalle) {
  const columna = document.querySelector("#contenidoCurso .col-lg-8");
  if (!columna) return;

  curso = cursoDelDetalle;
  valoraciones = null;

  const seccion = document.createElement("section");
  seccion.className = "mt-5 pt-4 border-top";
  seccion.setAttribute("aria-labelledby", "opinionesTitulo");
  seccion.innerHTML = `
    <h2 id="opinionesTitulo" class="h4 mb-2">Opiniones</h2>
    <div id="opinionesResumen" class="mb-3 text-body-secondary"></div>
    <div id="opinionesFormulario" class="mb-4"></div>
    <div id="opinionesLista"><p class="text-body-secondary">Cargando opiniones...</p></div>`;
  columna.appendChild(seccion);

  zonaResumen = seccion.querySelector("#opinionesResumen");
  zonaFormulario = seccion.querySelector("#opinionesFormulario");
  zonaLista = seccion.querySelector("#opinionesLista");

  try {
    valoraciones = await obtenerValoraciones(curso.id);
  } catch (error) {
    console.error("No se pudieron cargar las opiniones:", error);
    zonaResumen.textContent = "";
    zonaLista.innerHTML = '<p class="text-body-secondary mb-0">No se pudieron cargar las opiniones. Recargá la página para intentarlo de nuevo.</p>';
    return;
  }

  dibujarLista();
  dibujarFormulario();
}

export { iniciarOpiniones, actualizarOpiniones };