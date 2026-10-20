# EduTechCourses.github.io
Plataforma web de cursos digitales con suscripción - Taller Integrador, CERP del Litoral

## Autenticación
La plataforma utiliza Firebase Authentication con el proveedor Email/Contraseña.

## Firestore
Colección `usuarios`, un documento por usuario identificado con su UID de Firebase Authentication. Campos: nombre, apellido, email, telefono, rol, fechaRegistro.

Colección `cursos`, un documento por curso. El id del documento es el que se usa en `detalle-curso.html?id=`. Campos: nombre, categoria (robotica, diseno, programacion, idiomas o mentorias), precio, nivel, descripcion, imagen, rating, estudiantes, temario (lista de { titulo, duracion, gratis }), activo, destacado, fechaCreacion y, de forma opcional, vistaPreviaUrl (enlace al video de vista previa, público). Las páginas públicas solo muestran los cursos con `activo: true`, y Inicio muestra hasta 3 con `destacado: true`.

Subcolección `cursos/{id}/contenido`, con un único documento `principal`: guarda los enlaces del contenido protegido del curso, `pdfUrl` (guía en PDF) y `videoUrl` (video del curso completo). Solo los lee el administrador o quien adquirió el curso (ver «Contenido de los cursos (PDF y videos)»).

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

    // Devuelve true si el usuario autenticado tiene una adquisición confirmada de ese curso.
    function tieneCurso(cursoId) {
      return request.auth != null
        && exists(/databases/$(database)/documents/adquisiciones/$(request.auth.uid + "_" + cursoId))
        && get(/databases/$(database)/documents/adquisiciones/$(request.auth.uid + "_" + cursoId)).data.estado == "confirmada";
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

    // Cursos: cualquiera consulta los activos y el admin consulta todos. Un curso se abre por id
    // si está activo, si es el admin o si la persona lo adquirió (aunque después se desactive).
    // Solo el admin escribe.
    match /cursos/{cursoId} {
      allow list: if esAdmin() || resource.data.activo == true;
      allow get: if esAdmin() || resource.data.activo == true || tieneCurso(cursoId);
      allow write: if esAdmin();

      // Contenido protegido (enlaces del PDF y del video completo): solo el admin y quien
      // adquirió el curso. Las reglas de un documento no se heredan a sus subcolecciones.
      match /contenido/{docId} {
        allow read: if esAdmin() || tieneCurso(cursoId);
        allow write: if esAdmin();
      }
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
| `cursos` | Consulta y abre los activos | Consulta los activos y abre también los que adquirió (aunque estén inactivos) | Lee y escribe todos |
| `usuarios` | — | Lee y edita su documento (solo nombre, apellido y teléfono); lo crea con rol "estudiante" | Lee todos |
| `adquisiciones` | — | Crea y lee solo las propias | Lee todas y modifica el estado |
| `cursos/{id}/contenido` | — | Lee solo la de los cursos que adquirió | Lee y escribe |

Nadie puede eliminar usuarios ni adquisiciones desde el cliente.

Un curso que se desactiva deja de verse en Inicio y en Catálogo, pero quienes ya lo adquirieron (con la adquisición confirmada) siguen pudiendo abrir su página de detalle.

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

## Historial de cursos en el perfil

La pestaña «Mis cursos» de `perfil.html` muestra el historial real de adquisiciones de la persona con sesión iniciada. Ya no hay datos de ejemplo: la plataforma no registra progreso ni vencimientos de los cursos.

### Cómo funciona

1. `js/pages/perfil.js` consulta la colección `adquisiciones` con `where("uid", "==", uid)`. Las reglas de Firestore solo permiten consultar las adquisiciones propias.
2. Las adquisiciones se ordenan por fecha, de la más reciente a la más antigua. El orden se hace en el cliente, por lo que no hace falta crear un índice compuesto en Firestore.
3. Cada adquisición muestra el nombre del curso, la fecha, el importe y el estado:
   - **Confirmada:** incluye el botón «Ver curso», que lleva a `detalle-curso.html?id=…`.
   - **Cancelada:** muestra un aviso para contactar a la administración y no ofrece enlace al curso.
4. El campo «Cursos activos», la insignia de «Mis cursos» y el resumen del perfil cuentan solo las adquisiciones confirmadas.

### Estados de la sección

| Estado | Cuándo se muestra |
|---|---|
| Cargando | Mientras se consulta Firestore |
| Vacío | La persona todavía no adquirió ningún curso; ofrece un enlace al catálogo |
| Lista | Hay al menos una adquisición |
| Error | Falló la consulta (por ejemplo, sin conexión); pide revisar la conexión y recargar |

### Rol y enlace «Admin»

El enlace «Admin» de la barra superior se muestra solo si el rol guardado en Firestore es `administrador`. El perfil conserva ese rol tal como está en la base y no lo lee del texto de la insignia, por lo que el enlace se mantiene también después de guardar los cambios del perfil.

## Control de acceso y permisos por rol

El acceso a las páginas y al contenido de los cursos depende de la sesión y del rol guardado en Firestore (`estudiante` o `administrador`). Un visitante es quien no tiene sesión iniciada.

### Qué puede hacer cada rol

| Acción | Visitante | Estudiante | Administrador |
|---|---|---|---|
| Ver Inicio, Catálogo y el detalle de un curso (temario y vista previa) | Sí | Sí | Sí |
| Adquirir un curso (pago simulado) | Debe iniciar sesión primero | Sí | No hace falta: ve todo sin adquirir |
| Ver el contenido completo de un curso | No | Solo de los cursos que adquirió | De todos los cursos |
| Entrar a «Mi perfil» y «Mis cursos» | Se redirige al login | Sí | Sí |
| Entrar al panel administrativo (`admin.html`) | Se redirige al login | Se redirige a Inicio con un aviso de falta de permisos | Sí |

### Detalle del curso según el acceso

| Situación | Contenido | Acción en la barra lateral |
|---|---|---|
| Visitante | Solo la vista previa, si el curso la tiene | «Suscribirme», que lleva al login |
| Usuario sin el curso | Solo la vista previa, si el curso la tiene | «Suscribirme», que abre el modal de pago simulado |
| Usuario con el curso | Contenido completo | «Suscripción activa» y enlace a «Mis cursos» |
| Administrador | Contenido completo | Aviso de acceso como administrador y enlace al panel |

### Cómo se decide el acceso

1. Al cargar `detalle-curso.html?id=…`, `js/pages/detalle-curso.js` llama a `obtenerNivelAcceso(cursoId)`, de `js/modules/adquisiciones-servicio.js`.
2. La función espera a que se resuelva la sesión y devuelve uno de cuatro valores: `visitante` (sin sesión), `admin` (rol `administrador` en `usuarios/{uid}`), `con-curso` (adquisición `adquisiciones/{uid}_{cursoId}` con estado `confirmada`) o `sin-curso` (cualquier otro caso, incluida una adquisición cancelada).
3. Mientras se consulta se muestra «Verificando tu acceso…». Si la consulta falla, queda la vista previa: nunca se muestra el contenido completo sin haberlo confirmado.
4. Como el resultado sale de Firestore y no del navegador, se mantiene al recargar la página y al cerrar sesión e ingresar de nuevo. No existe ningún interruptor que permita ver el contenido completo sin haber adquirido el curso.

### Redirecciones y avisos

| Situación | Qué ocurre |
|---|---|
| Visitante entra a `perfil.html` o `admin.html` | Va a `login.html?volver=<página>&aviso=sesion-requerida`, con un aviso azul. Al iniciar sesión vuelve a la página que quería |
| Estudiante entra a `admin.html` | Va a `index.html?aviso=sin-permisos`, con un aviso amarillo que explica que no tiene permisos |

El aviso lo muestra `js/base.js` a partir del parámetro `?aviso=`. Solo se aceptan los códigos `sin-permisos` y `sesion-requerida`: el texto sale de una tabla del código y cualquier otro valor se ignora. Después de mostrarlo, el parámetro se quita de la dirección para que no reaparezca al recargar.

### Contenido de los cursos (PDF y videos)

Cada curso puede tener hasta tres enlaces, que se cargan desde el formulario de la sección Cursos del panel administrativo:

| Enlace | Dónde se guarda | Quién lo ve |
|---|---|---|
| `vistaPreviaUrl` | Documento del curso (`cursos/{id}`) | Cualquier persona, en la página del curso |
| `pdfUrl` | `cursos/{id}/contenido/principal` | Quien adquirió el curso y el administrador |
| `videoUrl` | `cursos/{id}/contenido/principal` | Quien adquirió el curso y el administrador |

Los enlaces pueden ser de Google Drive (video o PDF, compartidos con «Cualquier persona con el enlace») o de YouTube (solo video). El panel valida el enlace antes de guardarlo. Para mostrarlo, `js/modules/contenido-servicio.js` lo convierte a su dirección de incrustación usando solo el identificador del archivo (por ejemplo `https://drive.google.com/file/d/<id>/preview`) y `js/pages/detalle-curso.js` lo coloca en un `iframe`: un enlace de cualquier otro sitio no se muestra. Si el curso todavía no tiene contenido cargado, la página lo indica.

La página lee `cursos/{id}/contenido/principal` solo cuando la persona tiene acceso (adquisición confirmada o administrador). Las reglas de Firestore rechazan esa lectura a cualquier otra persona, por lo que los enlaces del PDF y del video completo no llegan al navegador de un visitante ni de quien no adquirió el curso. La subcolección tiene su propia regla porque las reglas de un documento no se heredan a sus subcolecciones.

**Limitación conocida.** Los archivos están en Google Drive con acceso «Cualquier persona con el enlace». La página no muestra el enlace, pero quien tiene acceso al contenido puede obtenerlo con las herramientas del navegador o desde el menú del reproductor y compartirlo, y cualquiera que lo reciba puede abrir el archivo. Una protección total requeriría servir los archivos con enlaces temporales desde Firebase Storage, que queda como mejora futura.

### Alcance de la protección

Las redirecciones y los estados de pantalla se resuelven en el navegador: sirven para orientar a la persona, pero no son la garantía de seguridad. Lo que realmente impide leer o modificar datos ajenos son las reglas de Firestore (ver «Reglas de seguridad de Firestore»), que se aplican en el servidor.

## Panel administrativo

El panel (`admin.html`) solo lo puede abrir un usuario con rol `administrador`; cualquier otro es redirigido (ver «Control de acceso y permisos por rol»). Está dividido en cuatro secciones, y cada una es un módulo JavaScript independiente.

### Estructura

| Sección | Contenedor en `admin.html` | Módulo |
|---|---|---|
| Resumen | `#contenedor-resumen` | `js/pages/admin-resumen.js` |
| Cursos | `#contenedor-cursos` | `js/pages/admin-cursos.js` |
| Usuarios | `#contenedor-usuarios` | `js/pages/admin-usuarios.js` |
| Adquisiciones | `#contenedor-adquisiciones` | `js/pages/admin-adquisiciones.js` |

`js/pages/admin.js` comprueba la sesión y el rol, maneja el menú de secciones (lateral en pantallas grandes, en pastillas arriba en pantallas chicas) y llama al módulo de la sección cada vez que se abre. Ningún módulo se ejecuta antes de confirmar que el usuario es administrador.

Cada módulo dibuja todo su contenido dentro de su contenedor y vuelve a pedir sus datos a Firestore, por lo que nunca muestra información vieja. Los modales se insertan en `#contenedor-modales`. Si un módulo falla, el panel muestra un aviso dentro de esa sección y las demás siguen funcionando. `admin.html` no contiene datos fijos.

### Resumen

La sección muestra una vista general de la plataforma, solo de consulta:

- **Indicadores:** usuarios registrados, cursos activos (con el total de cursos), adquisiciones confirmadas e ingresos simulados.
- **Cursos más adquiridos:** ranking de hasta 5 cursos según la cantidad de adquisiciones confirmadas, con una barra proporcional al primero.
- **Últimas adquisiciones:** las 5 más recientes, con el curso, la persona, la fecha, el importe y el estado (incluye las canceladas).

Los ingresos son simulados: suman el importe de las adquisiciones confirmadas, pero no se cobra nada. Los datos se piden a Firestore cada vez que se abre la sección.

Código:

| Archivo | Responsabilidad |
|---|---|
| `js/pages/admin-resumen.js` | Dibuja los indicadores, el ranking y la lista de últimas adquisiciones |
| `js/modules/resumen-servicio.js` | `obtenerResumen()` lee `cursos`, `usuarios` y `adquisiciones` y calcula los indicadores |

No hizo falta cambiar las reglas de Firestore: el administrador ya puede leer las tres colecciones.

### Cursos

La sección lista todos los cursos de la colección `cursos`, activos e inactivos, ordenados por nombre. Arriba muestra cuatro indicadores (total, activos, inactivos y estudiantes totales) y debajo una tabla con la imagen, el nombre, la categoría, el precio y el estado de cada curso.

**Activar y desactivar.** Cada fila tiene el botón «Desactivar» o «Activar», que cambia el campo `activo` del curso. Un curso inactivo deja de aparecer en Inicio y en Catálogo, y su página de detalle solo se abre para el administrador y para quienes ya lo adquirieron; el administrador lo sigue viendo en esta tabla y puede volver a activarlo. Después de cada cambio la sección vuelve a pedir los datos a Firestore; si el cambio falla, se muestra un aviso arriba de la tabla y el estado del curso no se modifica.

**Crear un curso.** El botón «Nuevo curso» abre un formulario en un modal con título, categoría, precio (mayor que cero), nivel, descripción y temario (un módulo por línea; el primero es la vista previa gratuita). El formulario valida los campos antes de guardar y los espacios sobrantes no cuentan como contenido. El curso nuevo nace activo, sin destacar, con rating 0, sin estudiantes y con la imagen `assets/img/curso-nuevo.svg`, por lo que aparece enseguida en el catálogo. Su id empieza con «c» y usa solo minúsculas y números, porque viaja en la dirección `detalle-curso.html?id=…` y en el parámetro `volver` del login.

**Editar un curso.** El botón «Editar» de cada fila abre el mismo formulario con los datos del curso. Se pueden modificar el título, la categoría, el precio, el nivel, la descripción y el temario. No se tocan la imagen, el rating, los estudiantes, el estado, el destacado ni la fecha de creación. Al guardar el temario, los módulos que conservan su título mantienen su duración y solo el primer módulo queda como vista previa gratuita.

**Enlaces del contenido.** El mismo formulario, al crear y al editar, tiene tres campos opcionales: el video de vista previa (público), la guía en PDF y el video del curso completo. Aceptan enlaces de Google Drive o de YouTube y se validan antes de guardar; al editar, un campo vacío borra el enlace anterior. El PDF y el video completo se guardan aparte, en `cursos/{id}/contenido/principal`, que solo pueden leer el administrador y quienes adquirieron el curso (ver «Contenido de los cursos (PDF y videos)»).

Código:

| Archivo | Responsabilidad |
|---|---|
| `js/pages/admin-cursos.js` | Dibuja la sección, el formulario del modal (para crear y para editar, con los tres enlaces) y atiende los botones |
| `js/modules/contenido-servicio.js` | Valida los enlaces, los convierte a su dirección de incrustación y los guarda y lee (`guardarEnlacesCurso`, `obtenerContenido`, `urlParaIncrustar`) |
| `js/modules/cursos-servicio.js` | `obtenerTodosLosCursos()` devuelve todos los cursos; `cambiarEstadoCurso(id, activo)` actualiza el campo `activo`; `crearCurso(datos)` valida y guarda un curso nuevo; `actualizarCurso(id, datos)` valida y actualiza solo los campos editables |

Las reglas de Firestore permiten escribir en `cursos` y en su subcolección `contenido` solo al administrador.

### Usuarios

La sección lista los usuarios registrados, del más reciente al más antiguo. Arriba muestra tres indicadores (total de usuarios, estudiantes con cursos y estudiantes sin cursos) y debajo una tabla con el nombre, el correo, el rol, la cantidad de cursos adquiridos y la fecha de registro.

Los cursos adquiridos cuentan solo las adquisiciones con estado `confirmada`: una adquisición cancelada no suma. No se muestra el teléfono y la sección es solo de consulta, sin acciones sobre los usuarios.

Código:

| Archivo | Responsabilidad |
|---|---|
| `js/pages/admin-usuarios.js` | Dibuja los indicadores y la tabla |
| `js/modules/usuarios-servicio.js` | `obtenerUsuarios()` lee `usuarios` y `adquisiciones` y devuelve cada usuario con su cantidad de cursos adquiridos |

No hizo falta cambiar las reglas de Firestore: el administrador ya puede leer todos los documentos de `usuarios` y de `adquisiciones`.

### Adquisiciones

La sección lista todas las adquisiciones de la plataforma, de la más reciente a la más antigua, con la fecha, la persona (nombre y correo), el curso, el importe y el estado. Arriba muestra cuatro indicadores (total, confirmadas, canceladas e ingresos simulados) y un filtro por estado que solo cambia las filas visibles de la tabla.

Los ingresos son simulados: suman el importe de las adquisiciones confirmadas, pero no se cobra nada.

Cada fila tiene un botón para cambiar el estado, siempre con confirmación en un modal:

- **Cancelar** (adquisiciones confirmadas): la persona deja de ver el contenido completo del curso y, si intenta adquirirlo de nuevo, la plataforma le avisa que la adquisición fue cancelada.
- **Reactivar** (adquisiciones canceladas): la persona vuelve a tener acceso al contenido.

Después de cada cambio la sección vuelve a pedir los datos a Firestore. Si el cambio falla, el modal muestra el error y no modifica la adquisición.

Código:

| Archivo | Responsabilidad |
|---|---|
| `js/pages/admin-adquisiciones.js` | Dibuja indicadores, filtro y tabla, y maneja el modal de confirmación |
| `js/modules/adquisiciones-servicio.js` | `obtenerTodasLasAdquisiciones()` devuelve todas las adquisiciones con el nombre y el correo de la persona; `cambiarEstadoAdquisicion(id, estado)` cambia el estado a `confirmada` o `cancelada` |

No hizo falta cambiar las reglas de Firestore: el administrador ya puede leer todas las adquisiciones y modificar únicamente el campo `estado`.
