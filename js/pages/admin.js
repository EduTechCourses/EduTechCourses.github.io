// EduTechCourses — lógica de la pantalla Panel administrativo
// Depende de js/firebase-config.js (debe cargarse antes que este archivo)

import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

function obtenerIniciales(nombre, apellido) {
    const n = (nombre || "").trim();
    const a = (apellido || "").trim();
    if (!n && !a) return "--";
    return ((n[0] || "") + (a[0] || "")).toUpperCase();
}

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
});

function mostrarSeccionAdmin(seccion) {
    document.getElementById('seccion-cursos').classList.toggle('d-none', seccion !== 'cursos');
    document.getElementById('seccion-usuarios').classList.toggle('d-none', seccion !== 'usuarios');
    document.getElementById('nav-cursos').classList.toggle('active', seccion === 'cursos');
    document.getElementById('nav-usuarios').classList.toggle('active', seccion === 'usuarios');
}
window.mostrarSeccionAdmin = mostrarSeccionAdmin;

function toggleEstadoCurso(link) {
    const fila = link.closest('tr');
    const celdaEstado = fila.children[3];
    const dot = celdaEstado.querySelector('.status-dot');
    const activo = dot.classList.contains('active');

    dot.classList.toggle('active', !activo);
    dot.classList.toggle('inactive', activo);
    celdaEstado.lastChild.textContent = activo ? 'Inactivo' : 'Activo';
    link.textContent = activo ? 'Activar' : 'Desactivar';
}
window.toggleEstadoCurso = toggleEstadoCurso;