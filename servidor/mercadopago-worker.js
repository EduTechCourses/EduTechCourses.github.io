// EduTechCourses — servidor de pagos con Mercado Pago (Cloudflare Worker)
//
// Este archivo NO se publica con el sitio: su código se pega en un Worker de
// Cloudflare (ver «Pago con Mercado Pago» en el README). Existe porque el
// Access Token de Mercado Pago es secreto y no puede ir en el JavaScript que
// se descarga el navegador.
//
// Rutas:
//   GET  /             Comprueba que el Worker funciona y si tiene el Access Token.
//   POST /preferencia  { cursoId, uid, volverA }
//                      Lee el nombre y el precio del curso desde Firestore (no
//                      del navegador), crea la preferencia de Checkout Pro y
//                      devuelve { url } con la dirección del checkout.
//   GET  /volver       Mercado Pago vuelve acá al terminar el pago, y el Worker
//                      reenvía a la página del curso con payment_id, status y
//                      external_reference. Pasar por acá permite probar desde
//                      localhost, que Mercado Pago no acepta como retorno.
//   GET  /pago?id=…    Consulta el pago en Mercado Pago y devuelve su estado,
//                      referencia e importe, para confirmar que está aprobado.
//
// Variables del Worker (Settings > Variables and Secrets):
//   MP_ACCESS_TOKEN  secreto, obligatorio: Access Token de prueba de Mercado Pago.
//   MONEDA           opcional: moneda del cobro. Si no se define, "USD".

const PROYECTO_FIREBASE = "edutechcourses-e8f3c";

// Sitios que pueden usar este servidor.
const ORIGENES_PERMITIDOS = [
  "https://edutechcourses.github.io",
  "https://edutechcourses-e8f3c.web.app",
  "https://edutechcourses-e8f3c.firebaseapp.com"
];

// Desarrollo local (Live Server) y canales de vista previa de Firebase Hosting.
const PATRONES_PERMITIDOS = [
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/edutechcourses-e8f3c--[a-z0-9-]+\.web\.app$/
];

function origenPermitido(origen) {
  if (!origen) return false;
  return ORIGENES_PERMITIDOS.includes(origen) || PATRONES_PERMITIDOS.some((patron) => patron.test(origen));
}

function encabezadosCors(origen) {
  const encabezados = { "Vary": "Origin" };
  if (origenPermitido(origen)) {
    encabezados["Access-Control-Allow-Origin"] = origen;
    encabezados["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    encabezados["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return encabezados;
}

function responderJson(datos, estado, origen) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { "Content-Type": "application/json; charset=utf-8", ...encabezadosCors(origen) }
  });
}

// Lee un curso de Firestore con la API REST y sin credenciales: las reglas solo
// permiten leer así los cursos activos. Devuelve { nombre, precio } o null.
async function leerCurso(cursoId) {
  const direccion = "https://firestore.googleapis.com/v1/projects/" + PROYECTO_FIREBASE +
    "/databases/(default)/documents/cursos/" + encodeURIComponent(cursoId);
  const respuesta = await fetch(direccion);
  if (respuesta.status === 403 || respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error("Firestore respondió " + respuesta.status);

  const campos = (await respuesta.json()).fields || {};
  if (!campos.activo || campos.activo.booleanValue !== true) return null;

  const nombre = campos.nombre ? campos.nombre.stringValue : "";
  const precio = campos.precio ? Number(campos.precio.integerValue ?? campos.precio.doubleValue) : NaN;
  if (!nombre || !(precio > 0)) return null;
  return { nombre: nombre, precio: precio };
}

async function crearPreferencia(request, env, origen) {
  let datos;
  try {
    datos = await request.json();
  } catch (error) {
    return responderJson({ error: "El pedido no tiene un formato válido." }, 400, origen);
  }

  const { cursoId, uid, volverA } = datos || {};
  if (typeof cursoId !== "string" || !/^[^/]{1,150}$/.test(cursoId) ||
      typeof uid !== "string" || !/^[A-Za-z0-9]{1,128}$/.test(uid)) {
    return responderJson({ error: "Faltan los datos del curso o de la cuenta." }, 400, origen);
  }

  let destino = null;
  try {
    destino = new URL(volverA);
  } catch (error) {
    destino = null;
  }
  if (!destino || !origenPermitido(destino.origin)) {
    return responderJson({ error: "La página de retorno no está permitida." }, 400, origen);
  }

  const curso = await leerCurso(cursoId);
  if (!curso) {
    return responderJson({ error: "El curso no está disponible. Recargá la página e intentá nuevamente." }, 404, origen);
  }

  const volver = new URL("/volver", request.url);
  volver.searchParams.set("destino", destino.href);

  const preferencia = {
    items: [{
      id: cursoId,
      title: curso.nombre,
      quantity: 1,
      unit_price: curso.precio,
      currency_id: env.MONEDA || "USD"
    }],
    external_reference: uid + "_" + cursoId,
    back_urls: { success: volver.href, failure: volver.href, pending: volver.href },
    auto_return: "approved",
    // Sin pagos en efectivo (Abitab, Red Pagos): quedarían pendientes y el
    // sitio no tiene cómo enterarse de cuándo se acreditan.
    payment_methods: { excluded_payment_types: [{ id: "ticket" }], installments: 1 }
  };

  const respuesta = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.MP_ACCESS_TOKEN,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(preferencia)
  });
  const resultado = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    console.log("Mercado Pago rechazó la preferencia:", respuesta.status, JSON.stringify(resultado));
    return responderJson({ error: "Mercado Pago no aceptó el pago: " + (resultado.message || "error " + respuesta.status) }, 502, origen);
  }

  // Las credenciales viejas de prueba empiezan con TEST- y usan el checkout de sandbox.
  const url = env.MP_ACCESS_TOKEN.startsWith("TEST-") ? resultado.sandbox_init_point : resultado.init_point;
  return responderJson({ url: url }, 200, origen);
}

// Reenvía a la página del curso con los datos del pago que manda Mercado Pago.
function volverAlSitio(url) {
  let destino = null;
  try {
    destino = new URL(url.searchParams.get("destino"));
  } catch (error) {
    destino = null;
  }
  if (!destino || !origenPermitido(destino.origin)) {
    return new Response("Destino no permitido.", { status: 400 });
  }

  const pagoId = url.searchParams.get("payment_id") || url.searchParams.get("collection_id") || "null";
  const estado = url.searchParams.get("status") || url.searchParams.get("collection_status") || "null";
  destino.searchParams.set("payment_id", pagoId);
  destino.searchParams.set("status", estado);

  const referencia = url.searchParams.get("external_reference");
  if (referencia) destino.searchParams.set("external_reference", referencia);

  return Response.redirect(destino.href, 302);
}

async function consultarPago(url, env, origen) {
  const id = url.searchParams.get("id") || "";
  if (!/^\d{1,20}$/.test(id)) {
    return responderJson({ error: "El número de pago no es válido." }, 400, origen);
  }

  const respuesta = await fetch("https://api.mercadopago.com/v1/payments/" + id, {
    headers: { "Authorization": "Bearer " + env.MP_ACCESS_TOKEN }
  });
  if (respuesta.status === 404) {
    return responderJson({ error: "No encontramos ese pago en Mercado Pago." }, 404, origen);
  }

  const pago = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    console.log("No se pudo consultar el pago:", respuesta.status, JSON.stringify(pago));
    return responderJson({ error: "No pudimos consultar el pago en Mercado Pago." }, 502, origen);
  }

  return responderJson({
    id: String(pago.id),
    estado: pago.status,
    referencia: pago.external_reference,
    importe: pago.transaction_amount,
    moneda: pago.currency_id
  }, 200, origen);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origen = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: encabezadosCors(origen) });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return responderJson({
        servicio: "Servidor de pagos de EduTechCourses",
        accessTokenConfigurado: Boolean(env.MP_ACCESS_TOKEN),
        moneda: env.MONEDA || "USD"
      }, 200, origen);
    }

    if (request.method === "GET" && url.pathname === "/volver") {
      return volverAlSitio(url);
    }

    if (!origenPermitido(origen)) {
      return responderJson({ error: "Este sitio no puede usar el servidor de pagos." }, 403, origen);
    }
    if (!env.MP_ACCESS_TOKEN) {
      return responderJson({ error: "El servidor de pagos no tiene configurado el Access Token de Mercado Pago." }, 500, origen);
    }

    try {
      if (request.method === "POST" && url.pathname === "/preferencia") {
        return await crearPreferencia(request, env, origen);
      }
      if (request.method === "GET" && url.pathname === "/pago") {
        return await consultarPago(url, env, origen);
      }
      return responderJson({ error: "Ruta no encontrada." }, 404, origen);
    } catch (error) {
      console.log("Error inesperado en el servidor de pagos:", error);
      return responderJson({ error: "Ocurrió un error en el servidor de pagos. Intentá nuevamente." }, 500, origen);
    }
  }
};
