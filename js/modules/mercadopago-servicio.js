// EduTechCourses — pago con Mercado Pago (Checkout Pro, modo de prueba)
//
// Habla con el servidor de pagos: un Worker de Cloudflare cuyo código está en
// servidor/mercadopago-worker.js (ver «Pago con Mercado Pago» en el README).
// El Access Token de Mercado Pago queda guardado en ese servidor: el sitio
// nunca lo ve.
//
// Flujo:
//   1. crearCheckout(curso) devuelve la dirección del checkout de Mercado Pago,
//      con el nombre y el precio del curso tomados de Firestore por el servidor.
//   2. Al terminar, Mercado Pago vuelve a detalle-curso.html con payment_id y
//      status en la dirección; leerVueltaDePago los lee.
//   3. verificarPago(pagoId, curso) le pregunta a Mercado Pago (a través del
//      servidor) si el pago está aprobado y si corresponde a esta cuenta, a
//      este curso y a este importe. Recién entonces se registra la adquisición.

import { auth } from "../firebase-config.js";

// Dirección del Worker de Cloudflare. Reemplazarla después de crearlo.
const URL_SERVIDOR_PAGOS = "https://edutech-mercadopago.pablodmconti.workers.dev";

const PARAMETROS_VUELTA = ["payment_id", "status", "external_reference"];

// Moneda en la que están los precios de los cursos.
const MONEDA_CURSOS = "USD";

function servidorConfigurado() {
  return !URL_SERVIDOR_PAGOS.includes("TU-SUBDOMINIO");
}

// Hace un pedido al servidor de pagos y devuelve la respuesta en JSON. Si algo
// falla, lanza un Error con un mensaje que se puede mostrar en pantalla.
async function pedirAlServidor(ruta, opciones) {
  if (!servidorConfigurado()) {
    throw new Error("El pago con Mercado Pago todavía no está configurado en la plataforma.");
  }

  let respuesta;
  try {
    respuesta = await fetch(URL_SERVIDOR_PAGOS + ruta, opciones);
  } catch (error) {
    const sinConexion = new Error("No pudimos conectarnos con el servidor de pagos. Revisá tu conexión e intentá nuevamente.");
    sinConexion.reintentar = true;
    throw sinConexion;
  }

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const fallo = new Error(datos.error || "Ocurrió un error con el servidor de pagos. Intentá nuevamente.");
    fallo.reintentar = respuesta.status >= 500;
    throw fallo;
  }
  return datos;
}

// Pide al servidor que cree el pago y devuelve la dirección del checkout.
async function crearCheckout(curso) {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error("Iniciá sesión para adquirir un curso.");

  // Página a la que Mercado Pago devuelve a la persona al terminar.
  const volverA = new URL("detalle-curso.html?id=" + encodeURIComponent(curso.id), window.location.href).href;

  const datos = await pedirAlServidor("/preferencia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cursoId: curso.id, uid: usuario.uid, volverA: volverA })
  });
  if (!datos.url) throw new Error("Mercado Pago no devolvió la dirección del checkout. Intentá nuevamente.");
  return datos.url;
}

// Confirma con Mercado Pago que el pago está aprobado y que corresponde a la
// cuenta actual, a este curso y a su precio. Devuelve { aprobado: true } o
// { aprobado: false, mensaje, pendiente }. Si no se puede consultar, lanza un Error.
async function verificarPago(pagoId, curso) {
  const pago = await pedirAlServidor("/pago?id=" + encodeURIComponent(pagoId));

  if (["pending", "in_process", "authorized"].includes(pago.estado)) {
    return { aprobado: false, pendiente: true, mensaje: "Tu pago quedó pendiente en Mercado Pago, así que todavía no habilitamos el curso. Contactá a la administración de la plataforma." };
  }
  if (pago.estado !== "approved") {
    return { aprobado: false, mensaje: "Mercado Pago no aprobó el pago. Podés intentarlo de nuevo." };
  }

  const usuario = auth.currentUser;
  if (!usuario || pago.referencia !== usuario.uid + "_" + curso.id) {
    return { aprobado: false, mensaje: "Este pago corresponde a otra cuenta o a otro curso." };
  }
  // Mercado Pago puede convertir el precio a pesos uruguayos con su propia
  // cotización (en Uruguay, USD 29 se cobra como $ 1.169,28). Si el pago quedó en
  // dólares, el importe tiene que coincidir exacto. Si quedó convertido, no hay
  // cotización contra la cual comparar; igual es confiable, porque el servidor
  // arma el checkout con el precio leído de Firestore y no con datos del navegador.
  if (pago.moneda === MONEDA_CURSOS && Number(pago.importe) !== Number(curso.precio)) {
    return {
      aprobado: false,
      mensaje: "El importe pagado (" + pago.moneda + " " + pago.importe + ") no coincide con el precio del curso (USD " +
        Number(curso.precio) + "). Contactá a la administración de la plataforma."
    };
  }
  return { aprobado: true };
}

// Si la página se abrió al volver de Mercado Pago, devuelve { pagoId, estado };
// si no, null. pagoId es null cuando la persona volvió sin pagar.
function leerVueltaDePago() {
  const parametros = new URLSearchParams(window.location.search);
  if (!parametros.has("payment_id")) return null;

  const pagoId = parametros.get("payment_id");
  return {
    pagoId: pagoId && pagoId !== "null" ? pagoId : null,
    estado: parametros.get("status")
  };
}

// Quita de la dirección los datos del pago, para que recargar la página no
// vuelva a procesarlos.
function limpiarVueltaDePago() {
  const url = new URL(window.location.href);
  PARAMETROS_VUELTA.forEach((nombre) => url.searchParams.delete(nombre));
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

export { crearCheckout, verificarPago, leerVueltaDePago, limpiarVueltaDePago };
