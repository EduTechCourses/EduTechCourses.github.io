// EduTechCourses — script compartido
//
// NOTA PARA EL EQUIPO: acá va solo la lógica que sea realmente
// compartida entre varias páginas. La lógica específica de una sola
// página puede ir directamente en un <script> al final de ese HTML,
// o más adelante en js/pages/<nombre-pagina>.js si crece.
//
// Evitemos que dos personas editen este archivo al mismo tiempo en
// ramas distintas para no generar conflictos de merge.
//
// IMPORTANTE (issue #32): este archivo se carga como
// <script type="module"> en todas las páginas, porque necesita
// importar auth de Firebase para detectar la sesión activa. Como los
// módulos no crean funciones globales automáticamente, una función
// llamada desde un atributo onclick="" del HTML tiene que asignarse
// explícitamente a `window`.
 
import { auth } from "./firebase-config.js";
import { cerrarSesion } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
 
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("form.needs-validation").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      form.classList.add("was-validated");
    });
  });
 
  // Cierre de sesión: cualquier elemento con data-logout dispara signOut
  // y redirige a index.html. Se usa data-attribute en vez de un id fijo
  // porque el botón/link aparece repetido en varias páginas.
  document.querySelectorAll("[data-logout]").forEach(function (elemento) {
    elemento.addEventListener("click", async function (event) {
      event.preventDefault();
      await cerrarSesion();
      window.location.href = "index.html";
    });
  });
});
 
// Adapta la navbar según haya o no una sesión de Firebase activa.
// Busca los contenedores #navAuthGuest / #navAuthUser en la página
// actual; si no existen (por ejemplo en perfil.html o admin.html,
// que ya tienen su propia navbar de usuario), no hace nada.
function actualizarNavbarSegunSesion(usuario) {
  const navGuest = document.getElementById('navAuthGuest');
  const navUser = document.getElementById('navAuthUser');
  if (!navGuest || !navUser) return;
 
  if (usuario) {
    navGuest.classList.add('d-none');
    navUser.classList.remove('d-none');
 
    const nombre = usuario.displayName || usuario.email || 'Mi perfil';
    const nombreSpan = document.getElementById('navNombreUsuario');
    const avatarSpan = document.getElementById('navAvatarIniciales');
    if (nombreSpan) nombreSpan.textContent = nombre;
    if (avatarSpan) avatarSpan.textContent = obtenerIniciales(nombre);
  } else {
    navUser.classList.add('d-none');
    navGuest.classList.remove('d-none');
  }
}
 
// Genera hasta 2 iniciales a partir de un nombre o correo, para el avatar.
function obtenerIniciales(texto) {
  const partes = texto.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}
 
onAuthStateChanged(auth, function (usuario) {
  actualizarNavbarSegunSesion(usuario);
});