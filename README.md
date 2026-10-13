# EduTechCourses.github.io
Plataforma web de cursos digitales con suscripción - Taller Integrador, CERP del Litoral

## Autenticación
La plataforma utiliza Firebase Authentication con el proveedor Email/Contraseña.

## Firestore
Colección `usuarios`, un documento por usuario identificado con su UID de Firebase Authentication. Campos: nombre, apellido, email, telefono, rol, fechaRegistro.

Colección `cursos`, un documento por curso. El id del documento es el que se usa en `detalle-curso.html?id=`. Campos: nombre, categoria (robotica, diseno, programacion, idiomas o mentorias), precio, nivel, descripcion, imagen, rating, estudiantes, temario (lista de { titulo, duracion, gratis }), activo, destacado, fechaCreacion. Las páginas públicas solo muestran los cursos con `activo: true`, y Inicio muestra hasta 3 con `destacado: true`.

La carga inicial de los 6 cursos se hizo con `tools/seed-cursos.html`, una página de uso único que requiere sesión de administrador y está excluida del hosting en `firebase.json`.

Colección `adquisiciones`, un documento por adquisición, con id `<uid>_<cursoId>`: esto impide registrar dos veces el mismo curso para el mismo usuario. Campos: uid, cursoId, cursoNombre, importe, metodoPago (siempre "simulado"), estado ("confirmada" o "cancelada") y fecha (hora del servidor). Al crearla, las reglas verifican que el uid sea el del usuario, que el curso esté activo y que el importe y el nombre coincidan con los datos reales del curso.

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

    // Datos del curso, leídos del servidor (no del cliente).
    function cursoDe(id) {
      return get(/databases/$(database)/documents/cursos/$(id)).data;
    }

    match /usuarios/{userId} {
      // Cada usuario lee su propio documento; el administrador lee todos.
      allow read: if request.auth != null && (request.auth.uid == userId || esAdmin());

      // Al registrarse, solo puede crear su documento con rol "estudiante".
      allow create: if request.auth != null && request.auth.uid == userId
        && request.resource.data.rol == "estudiante";

      // Solo puede editar nombre, apellido y teléfono: el rol y el resto no se tocan.
      allow update: if request.auth != null && request.auth.uid == userId
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(["nombre", "apellido", "telefono"]);

      // Nadie elimina usuarios desde el cliente.
      allow delete: if false;
    }

    // Cursos: cualquiera lee los activos; solo el admin lee inactivos y escribe.
    match /cursos/{cursoId} {
      allow read: if esAdmin() || resource.data.activo == true;
      allow write: if esAdmin();
    }

    // Adquisiciones: el id del documento es "<uid>_<cursoId>", lo que impide duplicarlas.
    match /adquisiciones/{adqId} {
      // Lectura por id: solo las propias (o el administrador). Funciona aunque el documento no exista.
      allow get: if request.auth != null
        && (esAdmin() || adqId.matches(request.auth.uid + "_.*"));

      // Consultas (historial): solo las propias; el administrador todas.
      allow list: if request.auth != null
        && (esAdmin() || resource.data.uid == request.auth.uid);

      // Creación validada contra los datos reales del curso.
      allow create: if request.auth != null
        && adqId == request.auth.uid + "_" + request.resource.data.cursoId
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.keys().hasOnly(
             ["uid", "cursoId", "cursoNombre", "importe", "metodoPago", "estado", "fecha"])
        && request.resource.data.keys().hasAll(
             ["uid", "cursoId", "cursoNombre", "importe", "metodoPago", "estado", "fecha"])
        && request.resource.data.estado == "confirmada"
        && request.resource.data.metodoPago == "simulado"
        && request.resource.data.fecha == request.time
        && cursoDe(request.resource.data.cursoId).activo == true
        && request.resource.data.importe == cursoDe(request.resource.data.cursoId).precio
        && request.resource.data.cursoNombre == cursoDe(request.resource.data.cursoId).nombre;

      // El administrador solo puede cambiar el estado.
      allow update: if esAdmin()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["estado"])
        && request.resource.data.estado in ["confirmada", "cancelada"];

      // Nadie elimina adquisiciones desde el cliente.
      allow delete: if false;
    }
  }
}
```

| Colección | Visitante | Estudiante | Administrador |
|---|---|---|---|
| `cursos` | Lee los activos | Lee los activos | Lee y escribe todos |
| `usuarios` | — | Lee y edita su documento (solo nombre, apellido y teléfono); lo crea con rol "estudiante" | Lee todos |
| `adquisiciones` | — | Crea y lee solo las propias | Lee todas y modifica el estado |

Nadie puede eliminar usuarios ni adquisiciones desde el cliente.

## Flujo de adquisición de cursos

La adquisición de un curso usa un **pago simulado**: no se cobra nada ni se solicitan ni se guardan datos de tarjeta ni de ningún otro medio de pago.

### Cómo funciona

1. En `detalle-curso.html?id=…`, el botón «Suscribirme a este curso» comprueba si hay una sesión iniciada.
2. Sin sesión, lleva a `login.html?volver=…`. Después de iniciar sesión, la persona regresa al mismo curso. Solo se aceptan páginas internas del sitio como destino: cualquier otro valor se ignora y se redirige a `perfil.html`.
3. Con sesión, se abre un modal con el nombre y el precio del curso y el aviso de que el pago es simulado.
4. Al confirmar, se crea el documento `adquisiciones/{uid}_{cursoId}` con los campos descritos en la sección Firestore (estado `confirmada`, método de pago `simulado` y fecha del servidor).
5. El modal informa el resultado: confirmación con enlace a «Mis cursos», aviso de que el curso ya había sido adquirido (sin duplicar el registro) o un mensaje de error claro.

Si la persona ya adquirió el curso, la pantalla de detalle lo refleja desde que carga.

### Archivos involucrados

| Archivo | Responsabilidad |
|---|---|
| `js/modules/adquisiciones-servicio.js` | Registra la adquisición (`adquirirCurso`) y la consulta (`obtenerAdquisicion`); traduce los errores de Firestore a mensajes comprensibles |
| `js/pages/detalle-curso.js` | Botón «Suscribirme», modal de pago simulado y mensajes de resultado |
| `detalle-curso.html` | Estructura del modal de pago simulado |
| `login.html` | Regreso al curso de origen mediante el parámetro `volver` |

### Resultados posibles

`adquirirCurso` devuelve `{ exito: true }` o `{ exito: false, codigo, mensaje }`:

| Código | Situación |
|---|---|
| `sin-sesion` | No hay una sesión iniciada |
| `ya-adquirido` | La persona ya tenía una adquisición confirmada de ese curso |
| `cancelada` | La adquisición existe pero fue cancelada por la administración |
| `permiso-denegado` | Las reglas rechazaron el registro (por ejemplo, el curso ya no está activo o su precio cambió) |
| `sin-conexion` | No hay conexión con el servidor |
| `error` | Cualquier otro error inesperado |

### Garantías de seguridad

- El id `{uid}_{cursoId}` impide registrar dos veces el mismo curso para la misma persona.
- Las reglas de Firestore validan que el importe y el nombre coincidan con los datos reales del curso, que el método de pago sea `simulado` y que la fecha sea la del servidor, por lo que el cliente no puede alterar esos valores.
- Nadie puede eliminar adquisiciones; solo la administración puede cambiar su estado.