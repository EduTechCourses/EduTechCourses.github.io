// EduTechCourses — lógica de la pantalla Mi perfil
// Depende de js/firebase-config.js (debe cargarse antes que este archivo)

import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let uidActual = null;

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

function actualizarEncabezados(datos) {
    const nombreCompleto = datos.nombre + " " + datos.apellido;
    const iniciales = obtenerIniciales(datos.nombre, datos.apellido);
    const rolCapitalizado = datos.rol.charAt(0).toUpperCase() + datos.rol.slice(1);

    // Issue #43: el link "Admin" solo se muestra si el rol es administrador.
    document.getElementById("navAdminLink").classList.toggle("d-none", datos.rol !== "administrador");

    document.getElementById("navAvatarSm").textContent = iniciales;
    document.getElementById("navNombreSm").textContent = nombreCompleto;

    document.getElementById("perfilAvatarGrande").childNodes[0].textContent = iniciales + " ";
    document.getElementById("perfilNombreCompleto").textContent = nombreCompleto;
    document.getElementById("perfilEmailSidebar").textContent = datos.email;
    document.getElementById("perfilRolBadge").textContent = rolCapitalizado;

    document.getElementById("perfilAvatarChico").textContent = iniciales;
    document.getElementById("perfilNombreChico").textContent = nombreCompleto;
    document.getElementById("perfilEmailChico").textContent = datos.email;
}

onAuthStateChanged(auth, async function (usuario) {
    if (!usuario) {
        window.location.href = "login.html";
        return;
    }

    uidActual = usuario.uid;
    const referenciaDoc = doc(db, "usuarios", uidActual);
    const snapshot = await getDoc(referenciaDoc);

    if (!snapshot.exists()) {
        document.getElementById("perfilNombreCompleto").textContent = usuario.displayName || usuario.email;
        document.getElementById("perfilEmailSidebar").textContent = usuario.email;
        return;
    }

    const datos = snapshot.data();
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
            rol: document.getElementById("perfilRolBadge").textContent,
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

function mostrarSeccionPerfil(seccion) {
    document.getElementById('seccion-datos').classList.toggle('d-none', seccion !== 'datos');
    document.getElementById('seccion-cursos').classList.toggle('d-none', seccion !== 'cursos');
    document.getElementById('nav-datos').classList.toggle('active', seccion === 'datos');
    document.getElementById('nav-cursos').classList.toggle('active', seccion === 'cursos');
}
window.mostrarSeccionPerfil = mostrarSeccionPerfil;