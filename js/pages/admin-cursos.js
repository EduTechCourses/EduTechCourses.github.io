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
// Issue #80: botón "Nuevo curso" con un formulario en un modal para crear cursos.
// Issue #81: botón "Editar" en cada fila; abre el mismo formulario con los datos
// del curso para modificarlos.
// Issue #86: el formulario suma tres enlaces opcionales (vista previa pública,
// guía en PDF y video completo) que se guardan con contenido-servicio.js.
// Issue #92: el formulario permite subir la imagen del curso a Cloudinary.

import {
  obtenerTodosLosCursos,
  cambiarEstadoCurso,
  crearCurso,
  actualizarCurso,
  CATEGORIAS,
  NIVELES,
  IMAGEN_CURSO_POR_DEFECTO,
  datosCategoria,
  escaparHTML
} from "../modules/cursos-servicio.js";
import { PRESET_CURSOS, urlOptimizada, abrirSubidaImagen } from "../modules/imagenes-servicio.js";
import {
  urlParaIncrustar,
  obtenerContenido,
  guardarEnlacesCurso
} from "../modules/contenido-servicio.js";

const ID_MODAL = "modalCurso";

// Escapa texto para usarlo dentro de un atributo HTML entre comillas.
function escaparAtributo(texto) {
  return escaparHTML(texto).replace(/"/g, "&quot;");
}

function encabezadoHTML(total) {
  const texto = total === 1 ? "1 curso en total." : total + " cursos en total.";
  return `
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
      <div>
        <h1 class="h4 mb-1">Gestión de cursos</h1>
        <p class="text-body-secondary small mb-0">${texto}</p>
      </div>
      <button type="button" class="btn btn-brand" data-accion="nuevo">
        <i class="bi bi-plus-lg me-1"></i> Nuevo curso
      </button>
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
        <button type="button" class="btn btn-link btn-sm p-0 me-3 text-decoration-none"
          data-accion="editar" data-id="${escaparAtributo(curso.id)}">Editar</button>
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

// Inserta (o reemplaza) el modal del formulario en #contenedor-modales.
function insertarModal() {
  const anterior = document.getElementById(ID_MODAL);
  if (anterior) anterior.remove();

  const categorias = Object.keys(CATEGORIAS)
    .map((clave) => `<option value="${clave}">${escaparHTML(CATEGORIAS[clave].label)}</option>`)
    .join("");
  const niveles = NIVELES
    .map((nivel) => `<option value="${escaparAtributo(nivel)}">${escaparHTML(nivel)}</option>`)
    .join("");

  document.getElementById("contenedor-modales").insertAdjacentHTML("beforeend", `
    <div class="modal fade" id="${ID_MODAL}" tabindex="-1" aria-labelledby="${ID_MODAL}Titulo" aria-hidden="true">
      <div class="modal-dialog modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title h5" id="${ID_MODAL}Titulo">Nuevo curso</h2>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <form id="formularioCurso" novalidate class="d-flex flex-column overflow-hidden">
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label d-block">Imagen del curso</label>
                <div class="d-flex align-items-center gap-3 flex-wrap">
                  <img id="cursoImagenVista" alt="Vista previa de la imagen del curso" width="128" height="72"
                    class="rounded-3 border flex-shrink-0" style="object-fit:cover;">
                  <div>
                    <button type="button" class="btn btn-outline-secondary btn-sm" id="cursoImagenSubir">
                      <i class="bi bi-upload me-1"></i> Subir imagen
                    </button>
                    <button type="button" class="btn btn-link btn-sm text-decoration-none d-none" id="cursoImagenQuitar">
                      Usar la imagen por defecto
                    </button>
                    <div class="form-text">JPG, PNG o WEBP de hasta 3 MB. Se recorta en formato 16:9.</div>
                    <div class="small text-danger d-none" id="cursoImagenError"></div>
                  </div>
                </div>
              </div>
              <div class="mb-3">
                <label for="cursoNombre" class="form-label">Título del curso</label>
                <input type="text" class="form-control" id="cursoNombre" maxlength="80" required>
                <div class="invalid-feedback">Escribí el título del curso.</div>
              </div>
              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label for="cursoCategoria" class="form-label">Categoría</label>
                  <select id="cursoCategoria" class="form-select" required>
                    <option value="">Elegir...</option>
                    ${categorias}
                  </select>
                  <div class="invalid-feedback">Elegí una categoría.</div>
                </div>
                <div class="col-md-6">
                  <label for="cursoPrecio" class="form-label">Precio (USD)</label>
                  <input type="number" class="form-control" id="cursoPrecio" min="1" step="1" required>
                  <div class="invalid-feedback">Ingresá un precio mayor que cero.</div>
                </div>
              </div>
              <div class="mb-3">
                <label for="cursoNivel" class="form-label">Nivel</label>
                <select id="cursoNivel" class="form-select" required>
                  <option value="">Elegir...</option>
                  ${niveles}
                </select>
                <div class="invalid-feedback">Elegí un nivel.</div>
              </div>
              <div class="mb-3">
                <label for="cursoDescripcion" class="form-label">Descripción</label>
                <textarea class="form-control" id="cursoDescripcion" rows="3" required></textarea>
                <div class="invalid-feedback">Escribí una descripción.</div>
              </div>
              <div class="mb-1">
                <label for="cursoTemario" class="form-label">Temario (un módulo por línea)</label>
                <textarea class="form-control" id="cursoTemario" rows="4"
                  placeholder="Introducción&#10;Fundamentos&#10;Proyecto final" required></textarea>
                <div class="form-text">El primer módulo es la vista previa gratuita.</div>
                <div class="invalid-feedback">Escribí al menos un módulo.</div>
              </div>
              <hr class="my-4">
              <p class="small text-body-secondary mb-3">
                Enlaces opcionales de Google Drive (Compartir → «Cualquier persona con el enlace») o de YouTube.
              </p>
              <div class="mb-3">
                <label for="cursoVistaPrevia" class="form-label">Video de vista previa</label>
                <input type="text" class="form-control" id="cursoVistaPrevia" placeholder="https://drive.google.com/file/d/…">
                <div class="form-text">Video corto que ve cualquier persona en la página del curso.</div>
                <div class="invalid-feedback">Pegá un enlace de Google Drive o de YouTube válido.</div>
              </div>
              <div class="mb-3">
                <label for="cursoPdf" class="form-label">Guía en PDF</label>
                <input type="text" class="form-control" id="cursoPdf" placeholder="https://drive.google.com/file/d/…">
                <div class="form-text">Solo la ven quienes adquirieron el curso (y el administrador).</div>
                <div class="invalid-feedback">Pegá un enlace de Google Drive válido.</div>
              </div>
              <div class="mb-1">
                <label for="cursoVideo" class="form-label">Video del curso completo</label>
                <input type="text" class="form-control" id="cursoVideo" placeholder="https://drive.google.com/file/d/…">
                <div class="form-text">Solo lo ven quienes adquirieron el curso (y el administrador).</div>
                <div class="invalid-feedback">Pegá un enlace de Google Drive o de YouTube válido.</div>
              </div>
              <div class="alert alert-danger d-none mt-3 mb-0" role="alert" id="${ID_MODAL}Error"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="submit" class="btn btn-brand" id="${ID_MODAL}Guardar">Crear curso</button>
            </div>
          </form>
        </div>
      </div>
    </div>`);

  return document.getElementById(ID_MODAL);
}

export async function iniciarCursos(contenedor) {
  contenedor.innerHTML = '<p class="text-body-secondary">Cargando cursos…</p>';

  const elementoModal = insertarModal();
  // focus: false evita que el modal le quite el foco al widget de Cloudinary,
  // que se abre por encima del formulario.
  const modal = window.bootstrap.Modal.getOrCreateInstance(elementoModal, { focus: false });
  const formulario = document.getElementById("formularioCurso");
  const botonGuardar = document.getElementById(ID_MODAL + "Guardar");
  const avisoModal = document.getElementById(ID_MODAL + "Error");

  // Cursos que se ven en la tabla y curso que se está editando (null si el
  // formulario está creando uno nuevo).
  let cursosActuales = [];
  let cursoEditando = null;

  // Imagen del formulario: "imagenElegida" es la que se guardaría y solo se envía
  // si "imagenCambiada" es true (así editar un curso sin tocar la imagen no la modifica).
  let imagenElegida = "";
  let imagenCambiada = false;

  const imagenVista = document.getElementById("cursoImagenVista");
  const botonImagenSubir = document.getElementById("cursoImagenSubir");
  const botonImagenQuitar = document.getElementById("cursoImagenQuitar");
  const avisoImagen = document.getElementById("cursoImagenError");

  // Muestra la imagen indicada y el botón para volver a la imagen por defecto
  // (solo si la imagen actual no es ya la de por defecto).
  function mostrarImagen(ruta) {
    imagenVista.src = ruta;
    botonImagenQuitar.classList.toggle("d-none", ruta === IMAGEN_CURSO_POR_DEFECTO);
  }

  botonImagenSubir.addEventListener("click", function () {
    avisoImagen.classList.add("d-none");
    abrirSubidaImagen(
      PRESET_CURSOS,
      function (url) {
        // Se guarda ya recortada y optimizada, para que el catálogo no cargue la original.
        imagenElegida = urlOptimizada(url, 800, 450);
        imagenCambiada = true;
        mostrarImagen(imagenElegida);
      },
      function (mensaje) {
        avisoImagen.textContent = mensaje;
        avisoImagen.classList.remove("d-none");
      }
    );
  });

  botonImagenQuitar.addEventListener("click", function () {
    imagenElegida = IMAGEN_CURSO_POR_DEFECTO;
    imagenCambiada = true;
    mostrarImagen(IMAGEN_CURSO_POR_DEFECTO);
  });

  // Campos de enlaces y el tipo de enlace que acepta cada uno.
  const CAMPOS_ENLACE = [
    { id: "cursoVistaPrevia", tipo: "video" },
    { id: "cursoPdf", tipo: "pdf" },
    { id: "cursoVideo", tipo: "video" }
  ];

  // Marca el campo como inválido si tiene un enlace que no se puede usar.
  function validarEnlace(campo) {
    const elemento = document.getElementById(campo.id);
    const valor = elemento.value.trim();
    elemento.setCustomValidity(valor !== "" && !urlParaIncrustar(valor, campo.tipo) ? "Enlace no válido" : "");
  }

  CAMPOS_ENLACE.forEach(function (campo) {
    document.getElementById(campo.id).addEventListener("input", function () {
      validarEnlace(campo);
    });
  });

  // Trae los cursos y dibuja la sección completa. "aviso" es un mensaje opcional
  // ({ texto, tipo }) que se muestra arriba de las tarjetas: tipo "success" o "danger".
  async function dibujar(aviso) {
    const cursos = await obtenerTodosLosCursos();
    cursosActuales = cursos;

    const activos = cursos.filter((c) => c.activo === true).length;
    const estudiantes = cursos.reduce((suma, c) => suma + (Number(c.estudiantes) || 0), 0);

    contenedor.innerHTML =
      encabezadoHTML(cursos.length) +
      (aviso ? `<div class="alert alert-${aviso.tipo}" role="alert">${escaparHTML(aviso.texto)}</div>` : "") +
      `<div class="row g-3 mb-4">` +
      tarjetaHTML(cursos.length, "Total cursos") +
      tarjetaHTML(activos, "Activos", "var(--teal-dark)") +
      tarjetaHTML(cursos.length - activos, "Inactivos", "var(--ink-faint)") +
      tarjetaHTML(estudiantes, "Estudiantes totales") +
      `</div>` +
      tablaHTML(cursos);

    contenedor.querySelector('[data-accion="nuevo"]').addEventListener("click", function () {
      abrirModal(null, null);
    });

    contenedor.querySelectorAll('[data-accion="editar"]').forEach(function (boton) {
      boton.addEventListener("click", async function () {
        const curso = cursosActuales.find((c) => c.id === boton.dataset.id);
        if (!curso) return;

        // Los enlaces del PDF y del video se leen antes de abrir el formulario:
        // si no se pudieran leer, guardar los dejaría vacíos sin querer.
        let contenido;
        try {
          contenido = await obtenerContenido(curso.id);
        } catch (error) {
          console.error("No se pudo leer el contenido del curso:", error);
          await dibujar({ texto: "No se pudieron cargar los enlaces del curso. Intentá de nuevo.", tipo: "danger" }).catch(errorDeRecarga);
          return;
        }
        abrirModal(curso, contenido);
      });
    });

    contenedor.querySelectorAll('[data-accion="estado"]').forEach(function (boton) {
      boton.addEventListener("click", function () {
        cambiarEstado(boton).catch(errorDeRecarga);
      });
    });
  }

  function errorDeRecarga(error) {
    console.error("No se pudo recargar la sección de cursos:", error);
    contenedor.innerHTML =
      '<div class="alert alert-danger" role="alert">No se pudo cargar esta sección. Probá recargar la página.</div>';
  }

  async function cambiarEstado(boton) {
    const activar = boton.dataset.activo !== "true";
    boton.disabled = true;
    boton.textContent = "Guardando…";

    try {
      await cambiarEstadoCurso(boton.dataset.id, activar);
    } catch (error) {
      console.error("No se pudo cambiar el estado del curso:", error);
      await dibujar({ texto: "No se pudo cambiar el estado del curso. Revisá tu conexión e intentá de nuevo.", tipo: "danger" });
      return;
    }
    await dibujar();
  }

  // Abre el formulario vacío (curso null) o con los datos del curso a editar.
  // "contenido" trae { pdfUrl, videoUrl } del curso que se edita.
  function abrirModal(curso, contenido) {
    cursoEditando = curso;
    imagenElegida = "";
    imagenCambiada = false;
    avisoImagen.classList.add("d-none");
    mostrarImagen((curso && curso.imagen) || IMAGEN_CURSO_POR_DEFECTO);
    formulario.reset();
    formulario.classList.remove("was-validated");
    avisoModal.classList.add("d-none");
    botonGuardar.disabled = false;

    document.getElementById(ID_MODAL + "Titulo").textContent = curso ? "Editar curso" : "Nuevo curso";
    botonGuardar.textContent = curso ? "Guardar cambios" : "Crear curso";

    if (curso) {
      document.getElementById("cursoNombre").value = curso.nombre || "";
      document.getElementById("cursoCategoria").value = curso.categoria || "";
      document.getElementById("cursoPrecio").value = curso.precio;
      document.getElementById("cursoNivel").value = curso.nivel || "";
      document.getElementById("cursoDescripcion").value = curso.descripcion || "";
      document.getElementById("cursoTemario").value = (curso.temario || []).map((m) => m.titulo).join("\n");
      document.getElementById("cursoVistaPrevia").value = curso.vistaPreviaUrl || "";
      document.getElementById("cursoPdf").value = contenido.pdfUrl;
      document.getElementById("cursoVideo").value = contenido.videoUrl;
    }
    CAMPOS_ENLACE.forEach(validarEnlace);
    modal.show();
  }

  formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    // Se quitan los espacios sobrantes antes de validar, para que un campo con
    // solo espacios cuente como vacío.
    formulario.querySelectorAll("input[type=text], textarea").forEach(function (campo) {
      campo.value = campo.value.trim();
    });
    CAMPOS_ENLACE.forEach(validarEnlace);
    formulario.classList.add("was-validated");
    if (!formulario.checkValidity()) return;

    const datos = {
      nombre: document.getElementById("cursoNombre").value,
      categoria: document.getElementById("cursoCategoria").value,
      precio: Number(document.getElementById("cursoPrecio").value),
      nivel: document.getElementById("cursoNivel").value,
      descripcion: document.getElementById("cursoDescripcion").value,
      temario: document.getElementById("cursoTemario").value.split("\n")
    };
    if (imagenCambiada) datos.imagen = imagenElegida;
    const enlaces = {
      vistaPreviaUrl: document.getElementById("cursoVistaPrevia").value,
      pdfUrl: document.getElementById("cursoPdf").value,
      videoUrl: document.getElementById("cursoVideo").value
    };
    const hayEnlaces = enlaces.vistaPreviaUrl !== "" || enlaces.pdfUrl !== "" || enlaces.videoUrl !== "";

    const editando = cursoEditando;
    botonGuardar.disabled = true;
    avisoModal.classList.add("d-none");

    let idCurso;
    try {
      if (editando) {
        await actualizarCurso(editando.id, datos);
        idCurso = editando.id;
      } else {
        idCurso = await crearCurso(datos);
      }
    } catch (error) {
      console.error("No se pudo guardar el curso:", error);
      avisoModal.textContent = "No se pudo guardar el curso. Revisá tu conexión e intentá de nuevo.";
      avisoModal.classList.remove("d-none");
      botonGuardar.disabled = false;
      return;
    }

    // Al editar siempre se guardan los enlaces (para poder borrarlos); al crear,
    // solo si se cargó alguno.
    let enlacesGuardados = true;
    if (editando || hayEnlaces) {
      try {
        await guardarEnlacesCurso(idCurso, enlaces);
      } catch (error) {
        console.error("No se pudieron guardar los enlaces del curso:", error);
        enlacesGuardados = false;
      }
    }

    modal.hide();
    if (!enlacesGuardados) {
      try {
        await dibujar({
          texto: "El curso «" + datos.nombre + "» se guardó, pero no se pudieron guardar los enlaces. Abrilo con «Editar» para cargarlos de nuevo.",
          tipo: "danger"
        });
      } catch (error) {
        errorDeRecarga(error);
      }
      return;
    }
    const texto = editando
      ? "Curso «" + datos.nombre + "» actualizado."
      : "Curso «" + datos.nombre + "» creado. Ya está activo y se ve en el catálogo.";
    try {
      await dibujar({ texto: texto, tipo: "success" });
    } catch (error) {
      errorDeRecarga(error);
    }
  });

  await dibujar();
}
