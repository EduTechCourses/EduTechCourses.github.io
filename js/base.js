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
// módulos no crean funciones globales automáticamente, las funciones
// llamadas desde atributos onclick="" del HTML (como
// mostrarEstadoCurso) se asignan explícitamente a `window` al final.
 
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
 
// Alterna entre vista de visitante/no suscripto y usuario suscripto,
// usado en detalle-curso.html. Cuando exista Firestore, este estado
// deberá reemplazarse por la consulta real de la suscripción.
function mostrarEstadoCurso(estado) {
  const previa = document.getElementById('estado-no-suscripto');
  const completo = document.getElementById('estado-suscripto');
  const btnPrevia = document.getElementById('btn-estado-previa');
  const btnCompleto = document.getElementById('btn-estado-suscripto');
  if (!previa || !completo) return;
 
  if (estado === 'suscripto') {
    previa.classList.add('d-none');
    completo.classList.remove('d-none');
    btnCompleto.classList.add('active');
    btnPrevia.classList.remove('active');
  } else {
    completo.classList.add('d-none');
    previa.classList.remove('d-none');
    btnPrevia.classList.add('active');
    btnCompleto.classList.remove('active');
  }
 
  const accionNoSuscripto = document.getElementById('accion-no-suscripto');
  const accionSuscripto = document.getElementById('accion-suscripto');
  if (accionNoSuscripto && accionSuscripto) {
    accionNoSuscripto.classList.toggle('d-none', estado === 'suscripto');
    accionSuscripto.classList.toggle('d-none', estado !== 'suscripto');
  }
}
 
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
 
// Exponemos al alcance global las funciones llamadas desde onclick=""
// en el HTML, ya que un <script type="module"> no las declara como
// globales automáticamente.
window.mostrarEstadoCurso = mostrarEstadoCurso;