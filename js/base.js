// EduTechCourses — script compartido
//
// NOTA PARA EL EQUIPO: acá va solo la lógica que sea realmente
// compartida entre varias páginas. La lógica específica de una sola
// página puede ir directamente en un <script> al final de ese HTML,
// o más adelante en js/pages/<nombre-pagina>.js si crece.
//
// Evitemos que dos personas editen este archivo al mismo tiempo en
// ramas distintas para no generar conflictos de merge.

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
});

// Alterna entre vista de visitante/no suscripto y usuario suscripto (RF-03 y RF-06),
// usado en detalle-curso.html. Cuando exista Firebase, este estado deberá
// reemplazarse por la consulta real de la suscripción.
function mostrarEstadoCurso(estado) {
  var previa = document.getElementById('estado-no-suscripto');
  var completo = document.getElementById('estado-suscripto');
  var btnPrevia = document.getElementById('btn-estado-previa');
  var btnCompleto = document.getElementById('btn-estado-suscripto');
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

  // Actualiza también la caja de compra lateral (si existe en la página)
  var accionNoSuscripto = document.getElementById('accion-no-suscripto');
  var accionSuscripto = document.getElementById('accion-suscripto');
  if (accionNoSuscripto && accionSuscripto) {
    accionNoSuscripto.classList.toggle('d-none', estado === 'suscripto');
    accionSuscripto.classList.toggle('d-none', estado !== 'suscripto');
  }
}