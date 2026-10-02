# EduTechCourses.github.io
Plataforma web de cursos digitales con suscripción — Taller Integrador, CERP del Litoral

## Autenticación
La plataforma utiliza Firebase Authentication con el proveedor Email/Contraseña.

## Firestore
Colección `usuarios`, un documento por usuario identificado con su UID de Firebase Authentication. Campos: nombre, apellido, email, telefono, rol, fechaRegistro.

Colección `cursos`, un documento por curso. El id del documento es el que se usa en `detalle-curso.html?id=`. Campos: nombre, categoria (robotica, diseno, programacion, idiomas o mentorias), precio, nivel, descripcion, imagen, rating, estudiantes, temario (lista de { titulo, duracion, gratis }), activo, destacado, fechaCreacion. Las páginas públicas solo muestran los cursos con `activo: true`, y Inicio muestra hasta 3 con `destacado: true`.

La carga inicial de los 6 cursos se hizo con `tools/seed-cursos.html`, una página de uso único que requiere sesión de administrador y está excluida del hosting en `firebase.json`.

## Reglas de seguridad de Firestore
Las reglas se publican desde la consola de Firebase (Firestore Database → Reglas). Esta es la versión vigente:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Devuelve true si el usuario autenticado tiene rol "administrador".
    function esAdmin() {
      return request.auth != null &&
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == "administrador";
    }

    match /usuarios/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Cursos: cualquiera lee los activos; solo el admin lee inactivos y escribe.
    match /cursos/{cursoId} {
      allow read: if esAdmin() || resource.data.activo == true;
      allow write: if esAdmin();
    }
  }
}
```