# EduTechCourses.github.io
Plataforma web de cursos digitales de compra individual - Taller Integrador, CERP del Litoral

## Sitio publicado

https://edutechcourses-e8f3c.web.app (Firebase Hosting)

## Tecnologías

- HTML, CSS y Bootstrap 5, con el sistema de diseño compartido de `css/styles.css` (paleta azul navy y verde azulado, tipografías Space Grotesk e Inter).
- JavaScript sin frameworks, en módulos ES: `js/pages/` tiene la lógica de cada pantalla y `js/modules/` los servicios compartidos.
- Firebase Authentication, Firestore y Hosting (SDK 12.18.0 por CDN).
- Cloudinary para las imágenes y un Worker de Cloudflare para el pago con Mercado Pago en modo de prueba.

## Cómo probar la plataforma

- Abrir el sitio publicado, o el proyecto en local con Live Server desde `localhost`. Para el ingreso con Google el dominio tiene que estar autorizado en Firebase: `localhost` y `edutechcourses-e8f3c.web.app` lo están, pero `127.0.0.1` no.
- Cuentas de prueba: `latourrobinson+admin@gmail.com` (rol administrador) y `latourrobinson+prueba4@gmail.com` (rol estudiante). Las contraseñas se entregan junto con la documentación de la entrega.
- Un visitante puede ver Inicio, Catálogo y el detalle de los cursos. Para adquirir un curso hay que iniciar sesión y pagar con Mercado Pago en modo de prueba (ver «Probar un pago»).

## Flujo de trabajo

Cada tarea sale de una issue, se desarrolla en una rama propia creada desde `develop`, con commits progresivos que mencionan la issue, y se integra con un Pull Request a `develop` revisado por otra persona del equipo. La rama `main` se actualiza al cerrar cada sprint, con un Pull Request de `develop` revisado por todo el equipo.

## Autenticación
La plataforma utiliza Firebase Authentication con dos proveedores: Email/Contraseña y Google.

### Ingreso con Google

El botón «Continuar con Google» de `login.html` abre una ventana emergente de Google (`signInWithPopup`).

- **Archivos:** `js/firebase-config.js` crea y exporta `googleProvider`; `js/auth.js` tiene `iniciarSesionConGoogle`; `login.html` conecta el botón y muestra un aviso en rojo si el ingreso falla (por ejemplo, si se cierra o se bloquea la ventana de Google).
- **Primer ingreso:** si la persona no tenía cuenta, se crea su documento en `usuarios` con rol `estudiante`, igual que en el registro con correo. Las reglas de Firestore no cambiaron: ya exigen que el uid sea el de la persona y que el rol sea `estudiante`.
- **Volver al curso:** si se llegó desde un curso, tras ingresar se vuelve a él, igual que con correo y contraseña.
- **Foto:** la foto de la cuenta de Google no se muestra. La plataforma solo acepta imágenes de su cuenta de Cloudinary, así que sin foto propia se ven las iniciales.
- **Configuración en Firebase:** Authentication → Método de acceso → Google → Habilitar, con el correo de asistencia del proyecto, y revisar en Configuración → Dominios autorizados que estén los dominios desde donde se usa el sitio.

## Firestore
Colección `usuarios`, un documento por usuario identificado con su UID de Firebase Authentication. Campos: nombre, apellido, email, telefono, rol, fechaRegistro y, de forma opcional, fotoUrl (dirección de la foto de perfil en Cloudinary).

Colección `cursos`, un documento por curso. El id del documento es el que se usa en `detalle-curso.html?id=`. Campos: nombre, categoria (robotica, diseno, programacion, idiomas o mentorias), precio, nivel, descripcion, imagen, temario (lista de { titulo, duracion, gratis }), activo, destacado, fechaCreacion y, de forma opcional, vistaPreviaUrl (enlace al video de vista previa, público). Los campos `rating` y `estudiantes` quedaron de la carga inicial y ya no se muestran: los promedios y la cantidad de opiniones salen de la colección `valoraciones`, y la plataforma no muestra cantidades de estudiantes. Las páginas públicas solo muestran los cursos con `activo: true`, e Inicio muestra hasta 3 con `destacado: true`. El campo `destacado` se marca a mano en Firestore: el panel administrativo no lo modifica.

Subcolección `cursos/{id}/contenido`, con un único documento `principal`: guarda los enlaces del contenido protegido del curso, `pdfUrl` (guía en PDF) y `videoUrl` (video del curso completo). Solo los lee el administrador o quien adquirió el curso (ver «Contenido de los cursos (PDF y videos)»).

La carga inicial de los 6 cursos se hizo con `tools/seed-cursos.html`, una página de uso único que requiere sesión de administrador y está excluida del hosting en `firebase.json`.

Colección `adquisiciones`, un documento por adquisición, con id `<uid>_<cursoId>`: esto impide registrar dos veces el mismo curso para el mismo usuario. Campos: uid, cursoId, cursoNombre, importe, metodoPago ("mercadopago", o "simulado" en las adquisiciones anteriores a Mercado Pago), pagoId (número de pago de Mercado Pago, solo con "mercadopago"), estado ("confirmada" o "cancelada") y fecha (hora del servidor). Al crearla, las reglas verifican que el uid sea el del usuario, que el curso esté activo y que el importe y el nombre coincidan con los datos reales del curso.

Colección `valoraciones`, un documento por opinión, con id `<cursoId>_<uid>`: esto impide opinar dos veces sobre el mismo curso. Campos: cursoId, uid, nombreUsuario (nombre y inicial del apellido, copiados del perfil al opinar), puntuacion (entero de 1 a 5), texto (de 3 a 500 caracteres) y fecha (hora del servidor). Ver «Valoraciones y opiniones de los cursos».

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

      // Solo puede editar nombre, apellido, teléfono y foto de perfil: el rol y el resto no se tocan.
      // La foto, si existe, tiene que ser una imagen de nuestra cuenta de Cloudinary.
      allow update: if request.auth != null && request.auth.uid == userId
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(["nombre", "apellido", "telefono", "fotoUrl"])
        && (!("fotoUrl" in request.resource.data)
            || (request.resource.data.fotoUrl is string
                && request.resource.data.fotoUrl.matches("https://res\\.cloudinary\\.com/ef2ky2pq/image/upload/.+")));

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

      // Creación validada contra los datos reales del curso. El método de pago es
      // "mercadopago" (con el número de pago) o "simulado" (flujo anterior).
      allow create: if request.auth != null
        && adqId == request.auth.uid + "_" + request.resource.data.cursoId
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.keys().hasOnly(
             ["uid", "cursoId", "cursoNombre", "importe", "metodoPago", "pagoId", "estado", "fecha"])
        && request.resource.data.keys().hasAll(
             ["uid", "cursoId", "cursoNombre", "importe", "metodoPago", "estado", "fecha"])
        && request.resource.data.estado == "confirmada"
        && ((request.resource.data.metodoPago == "simulado"
              && !request.resource.data.keys().hasAny(["pagoId"]))
            || (request.resource.data.metodoPago == "mercadopago"
              && request.resource.data.pagoId is string
              && request.resource.data.pagoId.size() > 0))
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

    // Valoraciones de los cursos: el id del documento es "<cursoId>_<uid>", lo que impide
    // opinar dos veces sobre el mismo curso. Cualquiera las lee. Solo opina quien adquirió
    // el curso (adquisición confirmada). No se editan ni se borran.
    match /valoraciones/{valoracionId} {
      allow read: if true;

      allow create: if request.auth != null
        && request.resource.data.keys().hasOnly(
             ["cursoId", "uid", "nombreUsuario", "puntuacion", "texto", "fecha"])
        && request.resource.data.keys().hasAll(
             ["cursoId", "uid", "nombreUsuario", "puntuacion", "texto", "fecha"])
        && request.resource.data.cursoId is string
        && valoracionId == request.resource.data.cursoId + "_" + request.auth.uid
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.nombreUsuario is string
        && request.resource.data.nombreUsuario.size() > 0
        && request.resource.data.nombreUsuario.size() <= 80
        && request.resource.data.puntuacion is int
        && request.resource.data.puntuacion >= 1
        && request.resource.data.puntuacion <= 5
        && request.resource.data.texto is string
        && request.resource.data.texto.size() >= 3
        && request.resource.data.texto.size() <= 500
        && request.resource.data.fecha == request.time
        && tieneCurso(request.resource.data.cursoId);

      // Las opiniones no se editan ni se borran desde el cliente.
      allow update, delete: if false;
    }
  }
}
```

| Colección | Visitante | Estudiante | Administrador |
|---|---|---|---|
| `cursos` | Consulta y abre los activos | Consulta los activos y abre también los que adquirió (aunque estén inactivos) | Lee y escribe todos |
| `usuarios` | — | Lee y edita su documento (solo nombre, apellido, teléfono y foto de perfil); lo crea con rol "estudiante" | Lee todos |
| `adquisiciones` | — | Crea y lee solo las propias | Lee todas y modifica el estado |
| `cursos/{id}/contenido` | — | Lee solo la de los cursos que adquirió | Lee y escribe |
| `valoraciones` | Lee todas | Lee todas y crea una opinión por curso adquirido (no la edita ni la borra) | Lee todas |

Nadie puede eliminar usuarios, adquisiciones ni opiniones desde el cliente, y las opiniones tampoco se editan.

Un curso que se desactiva deja de verse en Inicio y en Catálogo, pero quienes ya lo adquirieron (con la adquisición confirmada) siguen pudiendo abrir su página de detalle.

## Flujo de adquisición de cursos

La adquisición de un curso se paga con **Mercado Pago en modo de prueba** (Checkout Pro): no se cobra dinero real y la plataforma no solicita ni guarda datos de tarjeta ni de ningún otro medio de pago. La configuración está en «Pago con Mercado Pago (modo de prueba)».

### Cómo funciona

1. En `detalle-curso.html?id=…`, el botón «Comprar este curso» comprueba si hay una sesión iniciada.
2. Sin sesión, lleva a `login.html?volver=…`. Después de iniciar sesión, la persona regresa al mismo curso. Solo se aceptan páginas internas del sitio como destino: cualquier otro valor se ignora y se redirige a `perfil.html`.
3. Con sesión, se abre un modal con el nombre y el precio del curso y el aviso de que el pago es con Mercado Pago en modo de prueba.
4. Al confirmar, se comprueba que la persona no tenga ya el curso y se la lleva al checkout de Mercado Pago, que muestra el nombre del curso y el total.
5. Al terminar, Mercado Pago la devuelve a la página del curso. El modal se reabre, consulta el pago en Mercado Pago y, si está aprobado y corresponde a esa cuenta, ese curso y ese importe, crea el documento `adquisiciones/{uid}_{cursoId}` (estado `confirmada`, método de pago `mercadopago`, número de pago y fecha del servidor).
6. El modal informa el resultado: confirmación con enlace a «Mis cursos», pago rechazado o no completado (se puede volver a intentar), pago pendiente o un mensaje de error claro.

Si la persona ya adquirió el curso, la pantalla de detalle lo refleja desde que carga.

### Archivos involucrados

| Archivo | Responsabilidad |
|---|---|
| `js/modules/adquisiciones-servicio.js` | Comprueba si se puede adquirir (`comprobarAdquisicionPosible`), registra la adquisición (`adquirirCurso`) y la consulta (`obtenerAdquisicion`); traduce los errores de Firestore a mensajes comprensibles |
| `js/modules/mercadopago-servicio.js` | Pide el checkout al servidor de pagos (`crearCheckout`), lee la vuelta de Mercado Pago y verifica el pago (`verificarPago`) |
| `js/pages/detalle-curso.js` | Botón «Comprar este curso», modal de pago, redirección a Mercado Pago, verificación al volver y mensajes de resultado |
| `detalle-curso.html` | Estructura del modal de pago |
| `servidor/mercadopago-worker.js` | Servidor de pagos (Cloudflare Worker): crea el checkout y consulta los pagos con el Access Token |
| `login.html` | Regreso al curso de origen mediante el parámetro `volver` |

### Resultados posibles

`comprobarAdquisicionPosible` y `adquirirCurso` devuelven `{ exito: true }` o `{ exito: false, codigo, mensaje }`:

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
- Las reglas de Firestore validan que el importe y el nombre coincidan con los datos reales del curso, que el método de pago sea `mercadopago` (con número de pago) o `simulado`, y que la fecha sea la del servidor, por lo que el cliente no puede alterar esos valores.
- El checkout se arma en el servidor de pagos con el nombre y el precio leídos de Firestore, no con datos del navegador.
- Antes de registrar la adquisición, la página consulta el pago en Mercado Pago y comprueba que esté aprobado y que coincidan la cuenta y el curso. Si el pago quedó en dólares, también comprueba el importe; si Mercado Pago lo convirtió a pesos, no hay cotización contra la cual comparar, pero el importe lo fijó el servidor con el precio de Firestore.
- Nadie puede eliminar adquisiciones; solo la administración puede cambiar su estado.

## Pago con Mercado Pago (modo de prueba)

El Access Token de Mercado Pago es secreto, así que no puede ir en el JavaScript del sitio. Por eso hay un servidor de pagos chico, un **Worker de Cloudflare** (gratis, sin tarjeta), con el código de `servidor/mercadopago-worker.js`. El sitio le pide el checkout y la verificación del pago; el Access Token queda guardado como secreto en Cloudflare. La Public Key no se usa.

### Configurar el servidor de pagos

1. Crear una cuenta en [dash.cloudflare.com](https://dash.cloudflare.com).
2. En **Workers & Pages**, crear un Worker a partir de «Hello World» con el nombre `edutech-mercadopago` y desplegarlo.
3. Abrir **Edit code**, reemplazar todo el código por el de `servidor/mercadopago-worker.js` y desplegar.
4. En **Settings > Variables and Secrets**, agregar un secreto (tipo *Secret*) llamado `MP_ACCESS_TOKEN` con el Access Token de prueba de Mercado Pago (empieza con `APP_USR-`). Opcional: una variable `MONEDA` (por defecto `USD`).
5. Copiar la dirección del Worker (`https://edutech-mercadopago.<subdominio>.workers.dev`) en `URL_SERVIDOR_PAGOS`, al principio de `js/modules/mercadopago-servicio.js`.
6. Publicar en la consola de Firebase las reglas de Firestore de este README (aceptan `metodoPago: "mercadopago"` y `pagoId`).

Para comprobarlo, al abrir la dirección del Worker en el navegador tiene que aparecer `"accessTokenConfigurado": true`. Si se cambia `servidor/mercadopago-worker.js`, hay que volver a pegarlo en Cloudflare.

### Probar un pago

1. En [Tus integraciones](https://www.mercadopago.com.uy/developers/panel/app) de Mercado Pago, abrir la aplicación y, en **Cuentas de prueba**, crear una cuenta **compradora** de Uruguay.
2. Abrir el sitio en una **ventana de incógnito**, iniciar sesión en la plataforma, elegir un curso y confirmar la adquisición.
3. En el checkout, ingresar con la cuenta compradora de prueba (si pide un código, está en Cuentas de prueba) y pagar con una tarjeta de prueba, por ejemplo Visa `4509 9535 6623 3704`, CVV `123`, vencimiento `11/30`, documento `12345678`.
4. El nombre del titular define el resultado: `APRO` aprueba el pago, `OTHE` lo rechaza y `CONT` lo deja pendiente.

Se puede probar desde Live Server (`localhost` o `127.0.0.1`): Mercado Pago no acepta direcciones locales como retorno, por eso vuelve primero al Worker, que reenvía a la página del curso.

### Limitaciones conocidas

- Mercado Pago Uruguay convierte el precio en dólares a pesos uruguayos con su propia cotización, así que el checkout muestra el total en pesos (por ejemplo, USD 29 → $ 1.169,28). En Firestore la adquisición queda con el precio del curso en dólares.
- La adquisición la registra el navegador al volver de Mercado Pago. Si la persona cierra la página antes de volver, el pago queda hecho pero el curso no se habilita. La solución completa son las notificaciones (webhooks) de Mercado Pago, que necesitan que el servidor escriba en Firestore.
- Los pagos pendientes no habilitan el curso. Por eso el checkout no ofrece pagos en efectivo (Abitab, Red Pagos).
- Las reglas de Firestore no pueden comprobar con Mercado Pago que el pago exista: la adquisición la escribe el navegador después de verificar el pago, y quien sepa modificar el código del navegador podría registrar una adquisición sin haber pagado. Es aceptable en modo de prueba, donde no hay dinero real. La solución es que el Worker confirme el pago y lo guarde en Firestore con una cuenta de servicio, y que las reglas exijan ese registro.
- Las reglas siguen aceptando `metodoPago: "simulado"` para no invalidar las adquisiciones anteriores a Mercado Pago; se puede quitar más adelante.

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
| Adquirir un curso (pago con Mercado Pago de prueba) | Debe iniciar sesión primero | Sí | No hace falta: ve todo sin adquirir |
| Ver el contenido completo de un curso | No | Solo de los cursos que adquirió | De todos los cursos |
| Opinar sobre un curso | No: ve las opiniones y un enlace para iniciar sesión | Solo si adquirió el curso, una vez por curso | No: ve las opiniones y un aviso |
| Entrar a «Mi perfil» y «Mis cursos» | Se redirige al login | Sí | Sí |
| Entrar al panel administrativo (`admin.html`) | Se redirige al login | Se redirige a Inicio con un aviso de falta de permisos | Sí |

### Detalle del curso según el acceso

| Situación | Contenido | Acción en la barra lateral |
|---|---|---|
| Visitante | Solo la vista previa, si el curso la tiene | «Comprar este curso», que lleva al login |
| Usuario sin el curso | Solo la vista previa, si el curso la tiene | «Comprar este curso», que abre el modal de pago con Mercado Pago |
| Usuario con el curso | Contenido completo | «Curso comprado» y enlace a «Mis cursos» |
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

## Imágenes (Cloudinary)

Las imágenes no se guardan en Firebase: se suben a Cloudinary (cuenta gratuita, sin tarjeta) y en Firestore se guarda solo su dirección (URL).

### Cómo funciona

1. Las páginas que suben imágenes cargan el widget oficial de Cloudinary (`upload-widget.cloudinary.com`) antes de sus módulos. `js/modules/imagenes-servicio.js` lo configura y lo abre.
2. Se usan dos «upload presets» sin firma (Unsigned): `usuarios_web`, que guarda en la carpeta `usuarios`, y `cursos_web`, que guarda en la carpeta `cursos`. El «cloud name» (`ef2ky2pq`) identifica la cuenta de Cloudinary y no es una clave secreta.
3. La persona elige un archivo del dispositivo o saca una foto. Se aceptan imágenes JPG, PNG o WEBP de hasta 3 MB.
4. Cloudinary devuelve una dirección con la forma `https://res.cloudinary.com/ef2ky2pq/image/upload/…`. Antes de guardarla o mostrarla, el código comprueba que sea de nuestra cuenta; cualquier otra dirección se descarta.
5. Al mostrar la imagen se pide a Cloudinary una versión recortada y optimizada para el tamaño que se necesita, para que las páginas no descarguen la imagen original.

### Foto de perfil

En `perfil.html`, el botón de la cámara sobre el avatar abre el widget. La dirección se guarda en el campo `fotoUrl` de `usuarios/{uid}` y se copia en el `photoURL` de la cuenta de Firebase Authentication, de donde la lee la barra de navegación de todas las páginas. «Quitar foto» borra ambos datos. Sin foto se muestran las iniciales.

Las reglas de Firestore permiten que cada persona edite su `fotoUrl` solo si es una imagen de nuestra cuenta de Cloudinary.

### Imagen de los cursos

En el panel administrativo, el formulario de «Nuevo curso» y «Editar» tiene el botón «Subir imagen», que usa el preset `cursos_web`. La dirección que devuelve Cloudinary se guarda en el campo `imagen` del curso ya recortada en formato 16:9 y optimizada, por lo que el catálogo, Inicio y el detalle la muestran sin cambios. Si no se sube ninguna imagen, el curso nuevo usa `assets/img/curso-nuevo.svg`.


### Limitación conocida

Los presets sin firma no llevan clave secreta, por lo que cualquier persona que conozca su nombre podría subir imágenes a la cuenta. Por eso el tamaño y los formatos se limitan también en el propio preset. Como mejora, las subidas podrían firmarse con una Cloud Function.

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

La sección lista todos los cursos de la colección `cursos`, activos e inactivos, ordenados por nombre. Arriba muestra tres indicadores (total, activos e inactivos) y debajo una tabla con la imagen, el nombre, la categoría, el precio y el estado de cada curso.

**Activar y desactivar.** Cada fila tiene el botón «Desactivar» o «Activar», que cambia el campo `activo` del curso. Un curso inactivo deja de aparecer en Inicio y en Catálogo, y su página de detalle solo se abre para el administrador y para quienes ya lo adquirieron; el administrador lo sigue viendo en esta tabla y puede volver a activarlo. Después de cada cambio la sección vuelve a pedir los datos a Firestore; si el cambio falla, se muestra un aviso arriba de la tabla y el estado del curso no se modifica.

**Crear un curso.** El botón «Nuevo curso» abre un formulario en un modal con título, categoría, precio (mayor que cero), nivel, descripción y temario (un módulo por línea; el primero es la vista previa gratuita). El formulario valida los campos antes de guardar y los espacios sobrantes no cuentan como contenido. El curso nuevo nace activo, sin destacar, con los campos heredados `rating` y `estudiantes` en 0 y con la imagen que se haya subido (o, si no se subió ninguna, `assets/img/curso-nuevo.svg`), por lo que aparece enseguida en el catálogo. Su id empieza con «c» y usa solo minúsculas y números, porque viaja en la dirección `detalle-curso.html?id=…` y en el parámetro `volver` del login.

**Editar un curso.** El botón «Editar» de cada fila abre el mismo formulario con los datos del curso. Se pueden modificar el título, la categoría, el precio, el nivel, la descripción y el temario. La imagen solo cambia si se sube otra; no se tocan el estado, el destacado ni la fecha de creación. Al guardar el temario, los módulos que conservan su título mantienen su duración y solo el primer módulo queda como vista previa gratuita.

**Enlaces del contenido.** El mismo formulario, al crear y al editar, tiene tres campos opcionales: el video de vista previa (público), la guía en PDF y el video del curso completo. Aceptan enlaces de Google Drive o de YouTube y se validan antes de guardar; al editar, un campo vacío borra el enlace anterior. El PDF y el video completo se guardan aparte, en `cursos/{id}/contenido/principal`, que solo pueden leer el administrador y quienes adquirieron el curso (ver «Contenido de los cursos (PDF y videos)»).

**Imagen del curso.** El formulario, al crear y al editar, tiene el botón «Subir imagen», que abre el widget de Cloudinary y muestra una vista previa. La imagen se guarda en el campo `imagen` del curso, ya recortada en formato 16:9 (800 × 450) y optimizada. «Usar la imagen por defecto» vuelve a `assets/img/curso-nuevo.svg`. Ver «Imágenes (Cloudinary)».

Código:

| Archivo | Responsabilidad |
|---|---|
| `js/pages/admin-cursos.js` | Dibuja la sección, el formulario del modal (para crear y para editar, con la imagen y los tres enlaces) y atiende los botones |
| `js/modules/contenido-servicio.js` | Valida los enlaces, los convierte a su dirección de incrustación y los guarda y lee (`guardarEnlacesCurso`, `obtenerContenido`, `urlParaIncrustar`) |
| `js/modules/cursos-servicio.js` | `obtenerTodosLosCursos()` devuelve todos los cursos; `cambiarEstadoCurso(id, activo)` actualiza el campo `activo`; `crearCurso(datos)` valida y guarda un curso nuevo; `actualizarCurso(id, datos)` valida y actualiza solo los campos editables |
| `js/modules/imagenes-servicio.js` | Abre el widget de Cloudinary, comprueba que las direcciones sean de nuestra cuenta y arma la versión recortada y optimizada de una imagen |

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

## Portada (Inicio)

La portada no tiene datos fijos: lo que muestra sale de Firestore.

- **Cifras del encabezado:** `js/pages/inicio.js` calcula la cantidad de cursos activos, la cantidad de opiniones publicadas y el promedio general de valoración. Si todavía no hay opiniones, o si no se pueden leer, las cifras quedan en un guion («–»): nunca se muestra un número inventado. No hay una cifra de estudiantes porque un visitante no puede leer las adquisiciones ni los usuarios, y es una restricción de seguridad deliberada. «1° módulo, siempre gratis» no es un dato, sino una regla de la plataforma.
- **Cursos destacados:** hasta 3 cursos activos con `destacado: true`, en orden alfabético. Es una selección del equipo, hecha a mano en Firestore; no se calcula con las compras. Cada tarjeta muestra el promedio y la cantidad de opiniones del curso, o «Sin valoraciones».

### Fondo animado del encabezado

El encabezado tiene un fondo de cintas de luz dibujadas con WebGL2 que se retuercen alrededor del cursor, con los colores de la página. Está en `js/modules/hero-fondo.js`, con el `<canvas id="fondoHero">` de `index.html` y los estilos `.hero-canvas` y `.hero::before` de `css/styles.css`; una capa azul oscura asegura que el texto se lea.

- Se pausa cuando el encabezado no está a la vista o la pestaña está en segundo plano.
- Con «reducir movimiento» activado en el sistema, queda una imagen fija.
- En celulares se dibuja con menos calidad para gastar menos batería.
- Si el navegador no soporta WebGL2, el canvas se oculta y el encabezado se ve con su degradado de siempre.

**Crédito:** el efecto (los shaders y la matemática) es el componente «Ribbon Glow 2» de Originkit (https://www.originkit.dev/components/ribbon-glow/02). El original es un componente de React y TypeScript; aquí se tradujo a JavaScript común y se adaptó a la paleta de la plataforma. Los shaders se conservan tal como vienen en el original.

## Valoraciones y opiniones de los cursos

Las estrellas y los promedios de la plataforma salen de opiniones reales. Antes eran datos de ejemplo (`rating` y `estudiantes` en cada curso), que se dejaron de mostrar.

### Cómo funciona

1. En `detalle-curso.html?id=…`, debajo del contenido, hay una sección «Opiniones» con la lista de opiniones del curso, de la más reciente a la más antigua. La puede leer cualquier persona.
2. Según el nivel de acceso (ver «Cómo se decide el acceso»), la sección muestra:
   - **Visitante:** un enlace para iniciar sesión, que vuelve al curso.
   - **Administrador:** un aviso de que no puede opinar.
   - **Usuario sin el curso:** el mensaje «Solo pueden opinar quienes adquirieron este curso».
   - **Usuario con el curso:** el formulario para opinar, o el mensaje «Ya opinaste… ¡Gracias!» si ya lo hizo.
3. El formulario pide de 1 a 5 estrellas y un comentario de 3 a 500 caracteres. Se valida antes de enviar y los textos se escapan al mostrarlos.
4. Cada persona opina una sola vez por curso, y la opinión no se puede editar ni borrar. El id `<cursoId>_<uid>` lo garantiza, y la pantalla lo comprueba antes de guardar para dar un mensaje claro.
5. El nombre que se muestra (nombre e inicial del apellido) se copia del perfil al publicar, porque las reglas de `usuarios` solo permiten leer el documento propio.
6. El catálogo y los cursos destacados de Inicio muestran el promedio y la cantidad de opiniones de cada curso, o «Sin valoraciones»; si no se pueden leer las opiniones, los cursos se muestran igual, sin promedios.

### Archivos involucrados

| Archivo | Responsabilidad |
|---|---|
| `js/modules/valoraciones-servicio.js` | Lee las opiniones de un curso (`obtenerValoraciones`), calcula los promedios (`promedioDe`, `obtenerResumenValoraciones`), arma las estrellas con el promedio (`valoracionHTML`) y publica una opinión (`publicarValoracion`) |
| `js/modules/opiniones.js` | Sección «Opiniones» del detalle: lista, formulario y mensajes según el nivel de acceso |
| `js/pages/detalle-curso.js` | Carga la sección y le informa el nivel de acceso |
| `js/pages/catalogo.js` y `js/pages/inicio.js` | Muestran el promedio en cada tarjeta; Inicio además calcula las cifras de la portada |
| `css/styles.css` | Estilos del selector de estrellas (`.estrellas-fila`) |

### Seguridad

Las reglas de Firestore (ver «Reglas de seguridad de Firestore») permiten crear una opinión solo si la persona tiene sesión y una adquisición confirmada del curso, el id es `<cursoId>_<uid>`, el uid es el suyo, la puntuación es un entero de 1 a 5, el texto tiene de 3 a 500 caracteres, solo hay los campos esperados y la fecha es la del servidor. Nadie edita ni borra opiniones desde el cliente.

### Limitaciones conocidas

- Una opinión no se puede editar ni borrar; si hace falta moderar una, se hace desde la consola de Firebase.
- Los promedios se calculan en el navegador leyendo todas las opiniones, lo que es adecuado para el volumen de esta plataforma. Con muchas opiniones habría que guardar el promedio de cada curso en su documento, actualizado por un servidor.

## Limitaciones y mejoras futuras

| Tema | Situación actual | Mejora posible |
|---|---|---|
| Contenido de los cursos | Enlaces de Google Drive «Cualquier persona con el enlace»: quien tiene acceso puede compartir el enlace | Servir los archivos con enlaces temporales desde Firebase Storage |
| Pago | Mercado Pago en modo de prueba; el navegador registra la adquisición y las reglas no pueden comprobar el pago | Que el Worker confirme el pago y lo guarde en Firestore con una cuenta de servicio, con webhooks de Mercado Pago |
| Subida de imágenes | Presets sin firma de Cloudinary | Firmar las subidas con una Cloud Function |
| Cursos destacados | Se marcan a mano en Firestore | Un interruptor «Destacar» en el panel administrativo |
| Valoraciones | Una por persona y curso, sin editar ni borrar; promedios calculados en el navegador | Edición y moderación; promedio guardado por curso |
| Método de pago `simulado` | Las reglas todavía lo aceptan por las adquisiciones anteriores | Quitarlo de las reglas |
