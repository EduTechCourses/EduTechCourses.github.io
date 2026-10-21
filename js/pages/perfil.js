// EduTechCourses — lógica de la pantalla Mi perfil
// Depende de js/firebase-config.js (debe cargarse antes que este archivo)

import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc, updateDoc, deleteField, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { escaparHTML } from "../modules/cursos-servicio.js";
import { PRESET_USUARIOS, urlOptimizada, abrirSubidaImagen } from "../modules/imagenes-servicio.js";

let uidActual = null;
// Rol tal como está guardado en Firestore ("estudiante" o "administrador").
// No se lee del texto de la insignia, que se muestra con la primera letra en mayúscula.
let rolActual = null;
// Dirección de la foto de perfil guardada en Firestore ("" si no tiene).
let fotoActual = "";
// Últimos datos con los que se dibujaron los encabezados (nombre, correo y rol guardados).
let encabezadoActual = null;

function obtenerIniciales(nombre, apellido) {
    const n = (nombre || "").trim();
    const a = (apellido || "").trim();
    if (!n && !a) return "--";
    return ((n[0] || "") + (a[0] || "")).toUpperCase();
}

function formatearFecha(isoString) {
    if (!isoString) return "—";
    const fecha = new Date(isoString);
    return fecha.toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" });
}

// Dibuja en un avatar la foto de perfil o, si no hay, las iniciales.
// Cada avatar tiene un <span class="avatar-texto"> y un <img class="avatar-img">.
function pintarAvatar(avatar, iniciales, fotoUrl, tamano) {
    const texto = avatar.querySelector(".avatar-texto");
    const imagen = avatar.querySelector(".avatar-img");
    const foto = urlOptimizada(fotoUrl, tamano, tamano);

    texto.textContent = iniciales;
    texto.classList.toggle("d-none", foto !== "");
    imagen.classList.toggle("d-none", foto === "");
    if (foto !== "") {
        imagen.src = foto;
    } else {
        imagen.removeAttribute("src");
    }
    document.getElementById("btnQuitarFoto").classList.toggle("d-none", foto === "");
}

function actualizarEncabezados(datos) {
    encabezadoActual = datos;
    const nombreCompleto = datos.nombre + " " + datos.apellido;
    const iniciales = obtenerIniciales(datos.nombre, datos.apellido);
    const rolCapitalizado = datos.rol.charAt(0).toUpperCase() + datos.rol.slice(1);

    // Issue #43: el link "Admin" solo se muestra si el rol es administrador.
    document.getElementById("navAdminLink").classList.toggle("d-none", datos.rol !== "administrador");

    pintarAvatar(document.getElementById("navAvatarSm"), iniciales, fotoActual, 52);
    document.getElementById("navNombreSm").textContent = nombreCompleto;

    pintarAvatar(document.getElementById("perfilAvatarGrande"), iniciales, fotoActual, 160);
    document.getElementById("perfilNombreCompleto").textContent = nombreCompleto;
    document.getElementById("perfilEmailSidebar").textContent = datos.email;
    document.getElementById("perfilRolBadge").textContent = rolCapitalizado;

    pintarAvatar(document.getElementById("perfilAvatarChico"), iniciales, fotoActual, 104);
    document.getElementById("perfilNombreChico").textContent = nombreCompleto;
    document.getElementById("perfilEmailChico").textContent = datos.email;
}

// ---------- Historial de cursos adquiridos ----------

function textoCantidadCursos(cantidad) {
    return cantidad + (cantidad === 1 ? " curso" : " cursos");
}

// Muestra solo uno de los estados de la sección "Mis cursos".
function mostrarEstadoCursos(estado) {
    document.getElementById("cursosCargando").classList.toggle("d-none", estado !== "cargando");
    document.getElementById("cursosError").classList.toggle("d-none", estado !== "error");
    document.getElementById("cursosVacio").classList.toggle("d-none", estado !== "vacio");
    document.getElementById("cursosLista").classList.toggle("d-none", estado !== "lista");
}

function formatearFechaAdquisicion(fecha) {
    if (!fecha || typeof fecha.toDate !== "function") return "—";
    return fecha.toDate().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function crearItemAdquisicion(adquisicion, esUltima) {
    const confirmada = adquisicion.estado === "confirmada";
    const nombre = escaparHTML(adquisicion.cursoNombre);
    const bordeInferior = esUltima ? "" : " border-bottom";

    const etiqueta = confirmada
        ? '<span class="badge bg-success-subtle text-success-emphasis">Confirmada</span>'
        : '<span class="badge bg-secondary-subtle text-secondary-emphasis">Cancelada</span>';

    const accion = confirmada
        ? `<a href="detalle-curso.html?id=${encodeURIComponent(adquisicion.cursoId)}" class="btn btn-brand btn-sm mt-2">Ver curso</a>`
        : '<p class="small text-body-secondary mb-0 mt-2">Esta adquisición fue cancelada. Contactá a la administración de la plataforma.</p>';

    return `
        <div class="d-flex align-items-center gap-3 p-3${bordeInferior}">
            <div class="course-thumb rounded-3 flex-shrink-0"
                style="width:76px; height:60px; font-size:1.2rem; background: linear-gradient(135deg,#12305c,#1aa98b);">
                <i class="bi bi-collection"></i>
            </div>
            <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <div>
                        <p class="fw-semibold mb-0">${nombre}</p>
                        <p class="small text-body-secondary mb-0"><i class="bi bi-calendar3 me-1"></i>Adquirido el ${formatearFechaAdquisicion(adquisicion.fecha)} · USD ${Number(adquisicion.importe)}</p>
                    </div>
                    ${etiqueta}
                </div>
                ${accion}
            </div>
        </div>
    `;
}

// Actualiza los contadores de la barra lateral, el formulario y el resumen.
function actualizarContadoresCursos(cantidadActivos) {
    const contador = document.getElementById("perfilContadorCursos");
    contador.textContent = cantidadActivos;
    contador.classList.toggle("d-none", cantidadActivos === 0);

    document.getElementById("perfilCursosActivos").value = textoCantidadCursos(cantidadActivos);
    document.getElementById("perfilResumenCursos").textContent = cantidadActivos === 0
        ? "Todavía no tenés cursos activos"
        : textoCantidadCursos(cantidadActivos) + (cantidadActivos === 1 ? " activo" : " activos");
}

// Lee las adquisiciones del usuario (las reglas solo permiten consultar las propias)
// y las muestra de la más reciente a la más antigua.
async function cargarHistorialCursos(uid) {
    mostrarEstadoCursos("cargando");

    try {
        const consulta = query(collection(db, "adquisiciones"), where("uid", "==", uid));
        const resultado = await getDocs(consulta);
        const adquisiciones = resultado.docs.map((d) => d.data());

        // Se ordena en el cliente para no depender de un índice compuesto en Firestore.
        adquisiciones.sort((a, b) => {
            const fa = a.fecha && a.fecha.toMillis ? a.fecha.toMillis() : 0;
            const fb = b.fecha && b.fecha.toMillis ? b.fecha.toMillis() : 0;
            return fb - fa;
        });

        const activos = adquisiciones.filter((a) => a.estado === "confirmada").length;
        actualizarContadoresCursos(activos);

        if (adquisiciones.length === 0) {
            mostrarEstadoCursos("vacio");
            return;
        }

        document.getElementById("cursosLista").innerHTML = adquisiciones
            .map((a, indice) => crearItemAdquisicion(a, indice === adquisiciones.length - 1))
            .join("");
        mostrarEstadoCursos("lista");
    } catch (error) {
        console.error("Error al cargar el historial de cursos:", error);
        document.getElementById("cursosError").textContent =
            "No pudimos cargar tus cursos. Revisá tu conexión y recargá la página.";
        document.getElementById("perfilResumenCursos").textContent = "No se pudieron cargar tus cursos";
        mostrarEstadoCursos("error");
    }
}

onAuthStateChanged(auth, async function (usuario) {
    if (!usuario) {
        window.location.href = "login.html?volver=perfil.html&aviso=sesion-requerida";
        return;
    }

    uidActual = usuario.uid;
    cargarHistorialCursos(uidActual);
    const referenciaDoc = doc(db, "usuarios", uidActual);
    const snapshot = await getDoc(referenciaDoc);

    if (!snapshot.exists()) {
        document.getElementById("perfilNombreCompleto").textContent = usuario.displayName || usuario.email;
        document.getElementById("perfilEmailSidebar").textContent = usuario.email;
        return;
    }

    const datos = snapshot.data();
    rolActual = datos.rol;
    fotoActual = datos.fotoUrl || "";
    actualizarEncabezados(datos);

    document.getElementById("perfilNombre").value = datos.nombre;
    document.getElementById("perfilApellido").value = datos.apellido;
    document.getElementById("perfilTelefono").value = datos.telefono || "";
    document.getElementById("perfilEmail").value = datos.email;
    document.getElementById("perfilMiembroDesde").value = formatearFecha(datos.fechaRegistro);
});

const formPerfil = document.getElementById("formPerfil");
const mensajePerfil = document.getElementById("perfilMensaje");

formPerfil.addEventListener("submit", async function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (!formPerfil.checkValidity()) {
        formPerfil.classList.add("was-validated");
        return;
    }

    const nombre = document.getElementById("perfilNombre").value.trim();
    const apellido = document.getElementById("perfilApellido").value.trim();
    const telefono = document.getElementById("perfilTelefono").value.trim();

    const boton = formPerfil.querySelector("button[type=submit]");
    boton.disabled = true;
    boton.textContent = "Guardando...";

    try {
        await updateDoc(doc(db, "usuarios", uidActual), {
            nombre: nombre,
            apellido: apellido,
            telefono: telefono,
        });

        await updateProfile(auth.currentUser, { displayName: nombre + " " + apellido });

        actualizarEncabezados({
            nombre: nombre,
            apellido: apellido,
            email: document.getElementById("perfilEmail").value,
            rol: rolActual || "estudiante",
        });

        mensajePerfil.className = "alert alert-success";
        mensajePerfil.textContent = "Cambios guardados correctamente.";
    } catch (error) {
        mensajePerfil.className = "alert alert-danger";
        mensajePerfil.textContent = "No pudimos guardar los cambios. Intentá nuevamente.";
    }

    boton.disabled = false;
    boton.textContent = "Guardar cambios";
});

// ---------- Foto de perfil (Cloudinary) ----------

function mostrarMensajePerfil(tipo, texto) {
    mensajePerfil.className = "alert alert-" + tipo;
    mensajePerfil.textContent = texto;
}

// Guarda la dirección de la foto en el perfil (Firestore) y en la cuenta de
// Firebase Authentication, de donde la lee la barra de navegación de las demás
// páginas. Con url = "" la foto se quita.
async function guardarFoto(url) {
    try {
        await updateDoc(doc(db, "usuarios", uidActual), { fotoUrl: url === "" ? deleteField() : url });
    } catch (error) {
        console.error("No se pudo guardar la foto de perfil:", error);
        mostrarMensajePerfil("danger", "No pudimos guardar la foto. Intentá nuevamente.");
        return;
    }

    fotoActual = url;
    if (encabezadoActual) actualizarEncabezados(encabezadoActual);
    mostrarMensajePerfil("success", url === "" ? "Quitaste tu foto de perfil." : "Foto de perfil actualizada.");

    // Si esto falla, la foto ya quedó guardada: solo la barra de otras páginas
    // seguiría mostrando las iniciales hasta el próximo cambio.
    try {
        await updateProfile(auth.currentUser, { photoURL: url === "" ? "" : url });
    } catch (error) {
        console.error("No se pudo actualizar la foto de la cuenta:", error);
    }
}

document.getElementById("btnCambiarFoto").addEventListener("click", function () {
    abrirSubidaImagen(
        PRESET_USUARIOS,
        function (url) { guardarFoto(url); },
        function (mensaje) { mostrarMensajePerfil("danger", mensaje); }
    );
});

document.getElementById("btnQuitarFoto").addEventListener("click", function () {
    guardarFoto("");
});

function mostrarSeccionPerfil(seccion) {
    document.getElementById('seccion-datos').classList.toggle('d-none', seccion !== 'datos');
    document.getElementById('seccion-cursos').classList.toggle('d-none', seccion !== 'cursos');
    document.getElementById('nav-datos').classList.toggle('active', seccion === 'datos');
    document.getElementById('nav-cursos').classList.toggle('active', seccion === 'cursos');
}
window.mostrarSeccionPerfil = mostrarSeccionPerfil;

// ?seccion=cursos abre directamente la pestaña «Mis cursos» (la usan los
// enlaces «Ir a Mis cursos» del detalle de un curso).
if (new URLSearchParams(window.location.search).get("seccion") === "cursos") {
    mostrarSeccionPerfil("cursos");
}
