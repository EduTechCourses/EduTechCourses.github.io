# EduTechCourses.github.io
Plataforma web de cursos digitales con suscripción — Taller Integrador, CERP del Litoral

## Autenticación
La plataforma utiliza Firebase Authentication con el proveedor Email/Contraseña.

## Firestore
Colección `usuarios`, un documento por usuario identificado con su UID de Firebase Authentication. Campos: nombre, apellido, email, telefono, rol, fechaRegistro.