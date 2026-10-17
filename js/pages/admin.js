// EduTechCourses — lógica de la pantalla Panel administrativo
// Depende de js/firebase-config.js (debe cargarse antes que este archivo)
//
// Este archivo verifica la sesión y el rol, maneja el menú de secciones y le
// pasa a cada módulo su contenedor. El contenido de cada sección vive en su
// propio módulo (admin-resumen.js, admin-cursos.js, admin-usuarios.js y
// admin-adquisiciones.js); ver el contrato en el encabezado de cada uno.

import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { iniciarResumen } from "./admin-resumen.js";
import { iniciarCursos } from "./admin-cursos.js";
import { iniciarUsuarios } from "./admin-usuarios.js";
import { iniciarAdquisiciones } from "./admin-adquisiciones.js";

// Secciones del panel. La clave coincide con data-seccion en los enlaces del
// menú, con el id "seccion-<clave>" y con el id "contenedor-<clave>" de admin.html.
const SECCIONES = {
    resumen: iniciarResumen,
    cursos: iniciarCursos,
    usuarios: iniciarUsuarios,
    adquisiciones: iniciarAdquisiciones
};

function obtenerIniciales(nombre, apellido) {
    const n = (nombre || "").trim();
    const a = (apellido || "").trim();
    if (!n && !a) return "--";
    return ((n[0] || "") + (a[0] || "")).toUpperCase();
}

// Muestra una sección, marca su enlace como activo en los dos menús (lateral y
// de pantallas chicas) y llama a su módulo para que dibuje el contenido.
// Un error en un módulo se avisa dentro de su sección y no afecta a las demás.
async function mostrarSeccion(clave) {
    Object.keys(SECCIONES).forEach(function (otra) {
        document.getElementById("seccion-" + otra).classList.toggle("d-none", otra !== clave);
    });
    document.querySelectorAll("[data-seccion]").forEach(function (enlace) {
        enlace.classList.toggle("active", enlace.dataset.seccion === clave);
    });

    const contenedor = document.getElementById("contenedor-" + clave);
    try {
        await SECCIONES[clave](contenedor);
    } catch (error) {
        console.error("No se pudo cargar la sección " + clave + ":", error);
        contenedor.innerHTML =
            '<div class="alert alert-danger" role="alert">No se pudo cargar esta sección. Probá recargar la página.</div>';
    }
}

document.querySelectorAll("[data-seccion]").forEach(function (enlace) {
    enlace.addEventListener("click", function (evento) {
        evento.preventDefault();
        mostrarSeccion(enlace.dataset.seccion);
    });
});

// Guard de acceso (issue #44): sin sesión -> login; con sesión pero rol
// distinto de "administrador" -> index. Ocultar el link "Admin" en otras
// páginas (issue #43) es solo cosmético; ESTE chequeo es el que protege
// de verdad el acceso a esta página.
//
// Issue #72: en ambos casos se redirige con un aviso (?aviso=, ver base.js).
// El visitante vuelve a esta página después de iniciar sesión (?volver=).
//
// El body arranca oculto (visibility: hidden, definido en admin.html) para
// evitar el parpadeo del contenido mientras se resuelve la sesión y el rol.
// Solo se hace visible una vez confirmado que el usuario es administrador.
//
// Issue #78: ningún módulo de sección se ejecuta antes de este chequeo.
onAuthStateChanged(auth, async function (usuario) {
    if (!usuario) {
        window.location.href = "login.html?volver=admin.html&aviso=sesion-requerida";
        return;
    }

    const snapshot = await getDoc(doc(db, "usuarios", usuario.uid));

    if (!snapshot.exists() || snapshot.data().rol !== "administrador") {
        window.location.href = "index.html?aviso=sin-permisos";
        return;
    }

    document.body.style.visibility = "visible";

    const datos = snapshot.data();
    const nombreCompleto = datos.nombre + " " + datos.apellido;
    const iniciales = obtenerIniciales(datos.nombre, datos.apellido);

    document.getElementById("navAvatarSm").textContent = iniciales;
    document.getElementById("navNombreSm").textContent = nombreCompleto;
    document.getElementById("sidebarAvatarSm").textContent = iniciales;
    document.getElementById("sidebarNombreRol").textContent = nombreCompleto + " · Admin";

    mostrarSeccion("resumen");
});
