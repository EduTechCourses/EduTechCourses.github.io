// EduTechCourses — datos de cursos
//
// Array de objetos: nuestra "base de datos" local de cursos, hasta que
// se integre Cloud Firestore en el Sprint 2. Lo usan catalogo.html,
// index.html y detalle-curso.html.
 
const cursos = [
  {
    id: 1,
    nombre: "Robótica desde cero",
    categoria: "robotica",
    categoriaLabel: "Robótica",
    categoriaClase: "badge-cat-teal",
    precio: 29,
    rating: 4.8,
    estudiantes: 120,
    imagen: "assets/img/curso-robotica.jpg",
    nivel: "Inicial",
    descripcion: "Un recorrido práctico por los fundamentos de electrónica y programación aplicados a robots educativos, con guía en PDF y videos por módulo. Pensado para quienes se acercan por primera vez a la robótica: no se requieren conocimientos previos. Al finalizar, vas a poder armar y programar un robot seguidor de línea simple.",
    temario: [
      { titulo: "Introducción a la robótica educativa", duracion: "Vista previa gratuita", gratis: true },
      { titulo: "Componentes electrónicos básicos", duracion: "PDF + video · 45 min", gratis: false },
      { titulo: "Programación del microcontrolador", duracion: "PDF + video · 55 min", gratis: false },
      { titulo: "Proyecto final: robot seguidor de línea", duracion: "PDF + video · 1 h 10 min", gratis: false }
    ]
  },
  {
    id: 2,
    nombre: "Electrónica aplicada",
    categoria: "robotica",
    categoriaLabel: "Robótica",
    categoriaClase: "badge-cat-teal",
    precio: 27,
    rating: 4.3,
    estudiantes: 74,
    imagen: "assets/img/curso-electronica.jpg",
    nivel: "Intermedio",
    descripcion: "Circuitos, sensores y actuadores para llevar tus proyectos de robótica al siguiente nivel. Vas a aprender a leer datasheets, medir con multímetro y diseñar circuitos propios, con ejercicios guiados en cada módulo.",
    temario: [
      { titulo: "Introducción a componentes y multímetro", duracion: "Vista previa gratuita", gratis: true },
      { titulo: "Sensores analógicos y digitales", duracion: "PDF + video · 50 min", gratis: false },
      { titulo: "Actuadores: motores y relés", duracion: "PDF + video · 40 min", gratis: false },
      { titulo: "Diseño de un circuito propio", duracion: "PDF + video · 35 min", gratis: false },
      { titulo: "Proyecto final: estación de sensores", duracion: "PDF + video · 1 h", gratis: false }
    ]
  },
  {
    id: 3,
    nombre: "Diseño 3D con Blender",
    categoria: "diseno",
    categoriaLabel: "Diseño",
    categoriaClase: "badge-cat-purple",
    precio: 24,
    rating: 4.2,
    estudiantes: 86,
    imagen: "assets/img/curso-diseno3d.jpg",
    nivel: "Inicial",
    descripcion: "Modelado, texturizado y renderizado desde los primeros pasos, usando Blender (software libre y gratuito). No hace falta experiencia previa en diseño 3D ni conocimientos de arte digital.",
    temario: [
      { titulo: "Interfaz de Blender y primeros modelos", duracion: "Vista previa gratuita", gratis: true },
      { titulo: "Modelado con geometría básica", duracion: "PDF + video · 55 min", gratis: false },
      { titulo: "Materiales y texturizado", duracion: "PDF + video · 45 min", gratis: false },
      { titulo: "Iluminación y cámaras", duracion: "PDF + video · 30 min", gratis: false },
      { titulo: "Proyecto final: render de producto", duracion: "PDF + video · 1 h 10 min", gratis: false }
    ]
  },
  {
    id: 4,
    nombre: "Python para datos",
    categoria: "programacion",
    categoriaLabel: "Programación",
    categoriaClase: "badge-cat-blue",
    precio: 22,
    rating: 4.9,
    estudiantes: 98,
    imagen: "assets/img/curso-python.jpg",
    nivel: "Intermedio",
    descripcion: "Análisis y visualización de datos con Python, usando las librerías Pandas y Matplotlib. Ideal si ya sabés programación básica y querés dar el salto al análisis de datos.",
    temario: [
      { titulo: "Repaso de Python y primer dataset", duracion: "Vista previa gratuita", gratis: true },
      { titulo: "Pandas: leer y limpiar datos", duracion: "PDF + video · 1 h", gratis: false },
      { titulo: "Análisis exploratorio de datos", duracion: "PDF + video · 50 min", gratis: false },
      { titulo: "Visualización con Matplotlib", duracion: "PDF + video · 45 min", gratis: false },
      { titulo: "Estadística aplicada básica", duracion: "PDF + video · 40 min", gratis: false },
      { titulo: "Proyecto final: informe de datos reales", duracion: "PDF + video · 1 h 20 min", gratis: false }
    ]
  },
  {
    id: 5,
    nombre: "Inglés profesional",
    categoria: "idiomas",
    categoriaLabel: "Idiomas",
    categoriaClase: "badge-cat-pink",
    precio: 19,
    rating: 5.0,
    estudiantes: 143,
    imagen: "assets/img/curso-ingles.jpg",
    nivel: "Intermedio",
    descripcion: "Vocabulario y comunicación aplicados al ámbito laboral: reuniones, correos, entrevistas y presentaciones. Pensado para quienes ya tienen una base de inglés y quieren perfeccionar el uso profesional.",
    temario: [
      { titulo: "Vocabulario esencial de oficina", duracion: "Vista previa gratuita", gratis: true },
      { titulo: "Redacción de correos profesionales", duracion: "PDF + video · 40 min", gratis: false },
      { titulo: "Inglés para reuniones y llamadas", duracion: "PDF + video · 45 min", gratis: false },
      { titulo: "Entrevistas laborales en inglés", duracion: "PDF + video · 35 min", gratis: false },
      { titulo: "Presentaciones efectivas", duracion: "PDF + video · 40 min", gratis: false },
      { titulo: "Proyecto final: presentación grabada", duracion: "PDF + video · 30 min", gratis: false }
    ]
  },
  {
    id: 6,
    nombre: "Mentoría en desarrollo web",
    categoria: "mentorias",
    categoriaLabel: "Mentorías",
    categoriaClase: "badge-cat-amber",
    precio: 39,
    rating: 4.7,
    estudiantes: 31,
    imagen: "assets/img/curso-mentoria.jpg",
    nivel: "Todos los niveles",
    descripcion: "Acompañamiento personalizado para avanzar en tu primer proyecto web: HTML, CSS, y buenas prácticas de desarrollo, con revisión de código incluida en cada módulo.",
    temario: [
      { titulo: "Diagnóstico y plan de trabajo", duracion: "Vista previa gratuita", gratis: true },
      { titulo: "Estructura y semántica HTML", duracion: "PDF + video · 40 min", gratis: false },
      { titulo: "Estilos y diseño responsive", duracion: "PDF + video · 50 min", gratis: false }
    ]
  }
];
 
// Genera el HTML de las estrellas de rating (llenas, media y vacías) según el valor numérico
function generarEstrellasHTML(rating) {
  const llenas = Math.floor(rating);
  const media = (rating - llenas) >= 0.5 ? 1 : 0;
  const vacias = 5 - llenas - media;
  let html = "";
  for (let i = 0; i < llenas; i++) html += '<i class="bi bi-star-fill"></i>';
  if (media) html += '<i class="bi bi-star-half"></i>';
  for (let i = 0; i < vacias; i++) html += '<i class="bi bi-star"></i>';
  return html;
}