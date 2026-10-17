// EduTechCourses — Panel administrativo: sección Resumen
// Responsable de: indicadores generales de la plataforma (usuarios, cursos y adquisiciones).
//
// Contrato (es el mismo para los cuatro módulos js/pages/admin-*.js):
//  - admin.js llama a iniciarResumen(contenedor) CADA VEZ que el administrador abre la
//    sección, y solo después de comprobar que el usuario tiene rol "administrador".
//  - Dibuja todo su contenido dentro de `contenedor`, desde cero, y vuelve a pedir
//    sus datos a Firestore, para no mostrar información vieja.
//  - Si necesita un modal, lo inserta en #contenedor-modales (si todavía no existe
//    un modal con ese id).
//  - Si lanza un error, admin.js muestra un aviso dentro de esta sección y el resto
//    del panel sigue funcionando.
//  - No modifica admin.html: toda la interfaz de la sección se arma desde acá.

export function iniciarResumen(contenedor) {
    contenedor.innerHTML = `
        <div class="mb-4">
            <h1 class="h4 mb-1">Resumen de la plataforma</h1>
            <p class="text-body-secondary small mb-0">Sección en construcción.</p>
        </div>`;
}