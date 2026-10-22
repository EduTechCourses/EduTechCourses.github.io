// EduTechCourses — subida de imágenes con Cloudinary
//
// Las imágenes (foto de perfil e imagen de cada curso) no se guardan en Firebase:
// se suben a Cloudinary con su widget oficial y en Firestore solo se guarda la
// dirección (URL) que devuelve. El widget lo carga cada página con el <script>
// de upload-widget.cloudinary.com, antes de los módulos.
//
// Los dos "upload presets" son de tipo Unsigned (no llevan clave secreta), por
// eso el tamaño y los formatos se limitan también acá y en el propio preset.

const NOMBRE_CLOUD = "ef2ky2pq";
const PRESET_USUARIOS = "usuarios_web";
const PRESET_CURSOS = "cursos_web";

const PREFIJO_IMAGENES = "https://res.cloudinary.com/" + NOMBRE_CLOUD + "/image/upload/";
const TAMANO_MAXIMO_BYTES = 3000000;
const FORMATOS_PERMITIDOS = ["jpg", "jpeg", "png", "webp"];

// Indica si el texto es la dirección de una imagen de nuestra cuenta de Cloudinary.
// Se usa antes de guardar o de mostrar una imagen: cualquier otra dirección se rechaza.
function esUrlDeImagen(url) {
  return typeof url === "string"
    && url.length <= 500
    && !/\s/.test(url)
    && url.startsWith(PREFIJO_IMAGENES)
    && url.length > PREFIJO_IMAGENES.length;
}

// Devuelve la dirección de la imagen recortada a ancho x alto (centrada en lo
// importante de la imagen) y optimizada en peso y formato. Si la dirección no es
// de nuestra cuenta de Cloudinary devuelve "" y no se muestra nada.
function urlOptimizada(url, ancho, alto) {
  if (!esUrlDeImagen(url)) return "";
  const transformacion = "c_fill,g_auto,w_" + ancho + ",h_" + alto + ",q_auto,f_auto/";
  return url.replace(PREFIJO_IMAGENES, PREFIJO_IMAGENES + transformacion);
}

// Un widget por preset, creado la primera vez que se necesita.
const widgets = {};
// Qué hacer con el resultado de la subida en curso de cada preset.
const resultados = {};

// Abre el widget de Cloudinary para elegir una imagen del dispositivo o sacar una foto.
//   preset:  PRESET_USUARIOS o PRESET_CURSOS
//   alExito: función que recibe la dirección (URL) de la imagen subida
//   alError: función que recibe un mensaje para mostrarle a la persona
function abrirSubidaImagen(preset, alExito, alError) {
  if (typeof window.cloudinary === "undefined") {
    alError("No se pudo cargar el servicio de imágenes. Revisá tu conexión y recargá la página.");
    return;
  }

  resultados[preset] = { alExito: alExito, alError: alError };

  if (!widgets[preset]) {
    widgets[preset] = window.cloudinary.createUploadWidget(
      {
        cloudName: NOMBRE_CLOUD,
        uploadPreset: preset,
        sources: ["local", "camera"],
        multiple: false,
        resourceType: "image",
        maxFileSize: TAMANO_MAXIMO_BYTES,
        clientAllowedFormats: FORMATOS_PERMITIDOS
      },
      function (error, respuesta) {
        const actual = resultados[preset];
        if (error) {
          console.error("Error al subir la imagen:", error);
          actual.alError("No se pudo subir la imagen. Probá con otra (hasta 3 MB, en JPG, PNG o WEBP).");
          return;
        }
        if (respuesta && respuesta.event === "success") {
          const url = respuesta.info.secure_url;
          if (!esUrlDeImagen(url)) {
            actual.alError("La imagen subida no es válida. Probá de nuevo.");
            return;
          }
          actual.alExito(url);
        }
      }
    );
  }

  widgets[preset].open();
}

export {
  PRESET_USUARIOS,
  PRESET_CURSOS,
  esUrlDeImagen,
  urlOptimizada,
  abrirSubidaImagen
};
