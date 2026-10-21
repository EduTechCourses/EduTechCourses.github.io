// Fondo animado del hero de index.html: cintas de luz dibujadas con WebGL2 que se
// retuercen alrededor del cursor.
//
// CRÉDITO: el efecto (los shaders y la matemática) es el componente "Ribbon Glow 2" de
// Originkit: https://www.originkit.dev/components/ribbon-glow/02
// El original está escrito como componente de React + TypeScript. Acá se tradujo a
// JavaScript común (sin React ni compilación) y se adaptó a la paleta de EduTechCourses.
// Los shaders (VERT_SRC, CAMPO_SRC y ACABADO_SRC) se conservan tal como vienen en el
// original; lo propio de este archivo es la traducción, los nombres y la integración.
//
// Cómo funciona, en resumen:
//   1. CAMPO: un shader calcula, para cada píxel, cuánta luz suman 84 capas deformadas
//      (cada una se tuerce, se pliega y brilla). Se dibuja en una textura de la mitad
//      de tamaño, porque así cuesta 4 veces menos.
//   2. ACABADO: un segundo shader estira esa textura a pantalla completa, la mezcla con
//      el color de fondo y le suma un grano muy fino para evitar bandas de color.
//   3. Un bucle con requestAnimationFrame repite los dos pasos en cada cuadro, pasando
//      a los shaders el tiempo y la posición del mouse.
//
// Se conecta con index.html (el <canvas id="fondoHero" class="hero-canvas"> dentro de la
// sección .hero) y con css/styles.css (.hero-canvas y la capa oscura .hero::before).

// ---------- Ajustes ----------

// Colores y comportamiento. Son los mismos controles que ofrece el componente original.
const CONFIG = {
    fondo: "#12305c",   // azul navy: el color de fondo del hero (--navy)
    color1: "#1AA98B",  // verde azulado de la marca (--teal)
    color2: "#7FE3CE",  // verde azulado claro
    velocidad: 50,      // 0 = congelado, 100 = el doble de rápido
    tamano: 100,        // zoom del dibujo, en porcentaje (50 a 200)
    angulo: -180,       // rotación del dibujo, en grados
    hover: 100,         // cuánto se retuercen las cintas con el cursor (0 = nada)
    alcance: 240        // radio en píxeles alrededor del cursor donde se nota el efecto
};

const CAPAS = 84;       // cantidad de capas de luz que suma el shader
const TORSION = 1.25;   // cuánto se retuerce el plano alrededor del cursor
const ARRASTRE = 0.18;  // cuánto lo arrastra el movimiento del cursor
const DPR_MAX = 2;      // tope de la densidad de píxeles, para no gastar de más

// ---------- Shaders (de Originkit, sin modificar) ----------

// Vértice: dibuja un único triángulo enorme que cubre toda la pantalla. No lleva datos
// porque las tres esquinas están escritas en el propio shader.
const VERT_SRC = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }
`;

// Campo: calcula la luz de las cintas en cada píxel (paso 1).
const CAMPO_SRC = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uC1;
uniform vec3 uC2;
uniform float uSize;
uniform float uAngle;
uniform vec2 uMouse;
uniform float uOn;
uniform float uReach;
uniform vec2 uVel;
out vec4 o;

const float TAU = 6.28318530718;
const float LAYERS = ${CAPAS.toFixed(1)};
const float TWIST = ${TORSION.toFixed(3)};
const float DRAG = ${ARRASTRE.toFixed(3)};
const float GAIN = 0.62;
const vec2 CENTRE = vec2(-0.62, 0.24);
const float TILT = 0.6;
const float ZOOM = 1.05;
const float THETA = 2.13;
const float SHEAR = 0.963;
const float SHRINK = 0.953;
const vec2 WARP_FREQ = vec2(0.42, 2.4);
const vec2 WARP_AMP = vec2(0.13, 0.027);
const vec2 ASPECT = vec2(2.1, 0.17);
const float OFFSET = 0.36;
const float GLOW = 0.0021;
const float SOFT = 0.0019;
const float FALLOFF = 0.37;
const float PHASE = 12.0;
const float CYCLE = 0.16;
const float HUE_TRAVEL = 2.0;

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

void main() {
  vec2 R = uRes;
  vec2 pos = (gl_FragCoord.xy - 0.5 * R) / R.y;

  vec2 d = pos - uMouse;
  float w = uOn * exp(-dot(d, d) / (uReach * uReach));
  if (w > 1e-4) pos = uMouse + rot(w * TWIST) * d * (1.0 - 0.3 * min(w, 1.0)) - uVel * min(w, 1.0) * DRAG;

  pos = rot(uAngle) * pos / uSize;
  float t = uTime * 0.49 + PHASE;
  float breath = (-sin(uTime * 0.735) + sin(uTime * 0.49 + 1.0)) * 0.25 + 0.5;
  vec2 u = rot(TILT) * ((pos - CENTRE) * (ZOOM - breath * 0.085));
  mat2 fold = mat2(cos(THETA), sin(THETA), -SHEAR, cos(THETA));

  vec3 col = vec3(0.0);
  for (float i = 1.0; i <= LAYERS; i += 1.0) {
    u.x -= sin(u.y * WARP_FREQ.x + t + i * 0.007) * WARP_AMP.x;
    u.y -= sin(u.x * WARP_FREQ.y - t + i * 0.02) * WARP_AMP.y;
    u = fold * u * SHRINK;
    vec2 q = (u - vec2(OFFSET + breath * 0.1, 0.0)) * ASPECT;
    float g = GLOW / (dot(q, q) + SOFT) * (0.25 + breath * 0.4);
    float r = length(u);
    float k = sin(i * CYCLE + t * 1.2 + r * HUE_TRAVEL) * 0.5 + 0.5;
    col += g * mix(uC1, uC2, k) * (0.62 + 0.5 * k) * exp2(-r * FALLOFF);
  }
  vec3 x = max(col * GAIN, 0.0);
  col = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(0.85, 0.92, 0.98));
  col *= 1.0 - smoothstep(0.5, 1.6, length(pos)) * 0.07;
  o = vec4(col, 1.0);
}
`;

// Acabado: toma la textura del campo, la mezcla con el fondo y agrega grano (paso 2).
const ACABADO_SRC = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uBg;
uniform float uPaper;
out vec4 o;

float ign(vec2 p, float f) { p += 5.588238 * mod(f, 64.0); return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y)); }

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec3 L = max(texture(uField, frag / uRes).rgb, 0.0);

  vec3 dark = uBg + L * (1.0 - uBg);
  float strength = clamp(max(L.r, max(L.g, L.b)), 0.0, 1.0);
  vec3 paper = uBg * (1.0 - strength) + L * 0.96;
  vec3 col = mix(dark, paper, uPaper);
  col += (ign(frag, floor(uTime * 24.0)) - 0.5) / 255.0;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

// ---------- Funciones auxiliares ----------

// Convierte un color hexadecimal ("#E07A3E") en tres números de 0 a 1 (rojo, verde,
// azul), que es el formato que esperan los shaders.
function hexARgb(hex) {
    const limpio = hex.replace("#", "");
    return [
        parseInt(limpio.slice(0, 2), 16) / 255,
        parseInt(limpio.slice(2, 4), 16) / 255,
        parseInt(limpio.slice(4, 6), 16) / 255
    ];
}

// Mantiene un número dentro de un rango: si se pasa, lo corta en el límite.
function limitar(valor, minimo, maximo) {
    return valor < minimo ? minimo : valor > maximo ? maximo : valor;
}

// Compila los dos shaders (vértice y fragmento) y los une en un "programa" que la
// placa de video puede ejecutar. Si algo falla, avisa por consola y devuelve null.
function enlazarPrograma(gl, fragmentoSrc, etiqueta) {
    const compilar = (tipo, codigo) => {
        const shader = gl.createShader(tipo);
        gl.shaderSource(shader, codigo);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(`Fondo del hero, shader ${etiqueta}:`, gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    };

    const vertice = compilar(gl.VERTEX_SHADER, VERT_SRC);
    const fragmento = compilar(gl.FRAGMENT_SHADER, fragmentoSrc);
    if (!vertice || !fragmento) return null;

    const programa = gl.createProgram();
    gl.attachShader(programa, vertice);
    gl.attachShader(programa, fragmento);
    gl.linkProgram(programa);
    gl.deleteShader(vertice);
    gl.deleteShader(fragmento);

    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
        console.error(`Fondo del hero, enlace ${etiqueta}:`, gl.getProgramInfoLog(programa));
        gl.deleteProgram(programa);
        return null;
    }
    return programa;
}

// Busca la "dirección" de cada uniforme (variable que JavaScript le pasa al shader) y
// las junta en un objeto, para no consultarlas de nuevo en cada cuadro.
function ubicarUniformes(gl, programa, nombres) {
    const ubicaciones = {};
    nombres.forEach((nombre) => {
        ubicaciones[nombre] = gl.getUniformLocation(programa, nombre);
    });
    return ubicaciones;
}

// Crea la textura donde se dibuja el campo de luz (paso 1) y la mantiene del tamaño
// correcto. Intenta usar números de media precisión (RGBA16F), que dan mejores
// degradados; si el navegador no los permite, cae a 8 bits.
function crearObjetivo(gl) {
    const fbo = gl.createFramebuffer();
    let textura = null;
    let ancho = 0;
    let alto = 0;
    let mediaPrecision = !!gl.getExtension("EXT_color_buffer_float");

    return {
        fbo,
        textura: () => textura,
        ancho: () => ancho,
        alto: () => alto,
        redimensionar(nuevoAncho, nuevoAlto) {
            if (nuevoAncho === ancho && nuevoAlto === alto && textura) return;

            for (let intento = 0; intento < 2; intento++) {
                if (textura) gl.deleteTexture(textura);
                textura = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, textura);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texImage2D(
                    gl.TEXTURE_2D, 0,
                    mediaPrecision ? gl.RGBA16F : gl.RGBA8,
                    nuevoAncho, nuevoAlto, 0, gl.RGBA,
                    mediaPrecision ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
                    null
                );
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textura, 0);
                const completo = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);

                if (completo || !mediaPrecision) break;
                mediaPrecision = false; // no funcionó con media precisión: reintenta con 8 bits
            }
            ancho = nuevoAncho;
            alto = nuevoAlto;
        }
    };
}

// Sigue la posición del cursor y la guarda en un objeto { tx, ty, dentro }:
// tx y ty son la posición en píxeles dentro del hero, y "dentro" indica si el cursor
// está sobre él. Los eventos se escuchan en "window" (y no en el hero) para que el
// efecto siga respondiendo aunque el texto del hero esté apilado encima del canvas.
function seguirPuntero(raiz) {
    const puntero = { tx: 0, ty: 0, dentro: false };

    const leer = (evento) => {
        const rect = raiz.getBoundingClientRect();
        const escalaX = raiz.offsetWidth / (rect.width || 1);
        const escalaY = raiz.offsetHeight / (rect.height || 1);
        puntero.tx = (evento.clientX - rect.left) * escalaX;
        puntero.ty = (evento.clientY - rect.top) * escalaY;
        puntero.dentro =
            evento.clientX >= rect.left && evento.clientX <= rect.right &&
            evento.clientY >= rect.top && evento.clientY <= rect.bottom;
    };

    // Si el cursor sale de la ventana del navegador, deja de contar como "dentro".
    const salir = (evento) => {
        if (!evento.relatedTarget) puntero.dentro = false;
    };

    window.addEventListener("pointermove", leer, { passive: true });
    window.addEventListener("pointerdown", leer, { passive: true });
    document.addEventListener("pointerout", salir);

    return puntero;
}

// ---------- Programa principal ----------

// Ajustes de calidad según el dispositivo (ver la función dibujarCuadro):
const DIVISOR_CAMPO = 2;        // en escritorio, el campo de luz se dibuja a 1/2 del tamaño
const DIVISOR_CAMPO_MOVIL = 3;  // en celulares, a 1/3: menos píxeles, menos batería
const DPR_MAX_MOVIL = 1;        // en celulares no se usa densidad de píxeles extra

// Momento de la animación que se muestra congelado cuando el usuario pide "reducir
// movimiento". Se eligió uno en el que las cintas se ven bien repartidas.
const MOMENTO_ESTATICO = 30;

document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.querySelector("#fondoHero");
    if (!canvas) return; // este archivo solo tiene sentido en index.html

    const raiz = canvas.parentElement; // la sección .hero

    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false });

    // Si el navegador no soporta WebGL2 (o falla algún shader), se oculta el canvas y
    // el hero se queda con su degradado de siempre: la página funciona igual.
    const ocultarCanvas = () => { canvas.style.display = "none"; };
    if (!gl) { ocultarCanvas(); return; }

    const progCampo = enlazarPrograma(gl, CAMPO_SRC, "campo");
    const progAcabado = enlazarPrograma(gl, ACABADO_SRC, "acabado");
    if (!progCampo || !progAcabado) { ocultarCanvas(); return; }

    const uCampo = ubicarUniformes(gl, progCampo, ["uRes", "uTime", "uC1", "uC2", "uSize", "uAngle", "uMouse", "uOn", "uReach", "uVel"]);
    const uAcabado = ubicarUniformes(gl, progAcabado, ["uField", "uRes", "uTime", "uBg", "uPaper"]);

    // El triángulo que cubre la pantalla no necesita datos, pero WebGL2 exige tener
    // un VAO activo para poder dibujar.
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const objetivo = crearObjetivo(gl);
    const puntero = seguirPuntero(raiz);

    // Preferencias del dispositivo y del usuario. matchMedia permite consultarlas desde
    // JavaScript, igual que un @media de CSS, y avisa cuando cambian.
    const consultaMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");
    const consultaMovil = window.matchMedia("(max-width: 767.98px)");

    // Los ajustes de CONFIG, ya convertidos a lo que esperan los shaders.
    const velocidad = limitar(CONFIG.velocidad, 0, 100) / 50;
    const tamano = limitar(CONFIG.tamano, 50, 200) / 100;
    const angulo = (limitar(CONFIG.angulo, -180, 180) * Math.PI) / 180;
    const hover = limitar(CONFIG.hover, 0, 200) / 100;
    const alcance = limitar(CONFIG.alcance, 10, 800);
    const color1 = hexARgb(CONFIG.color1);
    const color2 = hexARgb(CONFIG.color2);
    const fondo = hexARgb(CONFIG.fondo);
    // Luminosidad del fondo: decide si las cintas se "mezclan como luz" (fondo oscuro)
    // o "como pintura sobre papel" (fondo claro). Con el azul navy da luz.
    const luminosidadFondo = 0.2126 * fondo[0] + 0.7152 * fondo[1] + 0.0722 * fondo[2];

    // Estado que cambia cuadro a cuadro.
    let mx = 0, my = 0;   // posición suavizada del cursor (la que siguen las cintas)
    let vx = 0, vy = 0;   // velocidad suavizada del cursor
    let presencia = 0;    // 0 = cursor afuera, 1 = adentro (sube y baja de a poco)
    let ultimo = -1;      // marca de tiempo del cuadro anterior
    let reloj = 0;        // tiempo de la animación, en segundos
    let raf = 0;          // identificador del bucle, para poder frenarlo

    // Condiciones que deciden si la animación debe correr.
    let movimientoReducido = consultaMovimiento.matches; // el usuario pidió menos movimiento
    let heroVisible = true;                              // el hero está (aunque sea en parte) en pantalla
    let pestanaVisible = !document.hidden;               // la pestaña del navegador está a la vista

    // Dibuja UN cuadro de la animación. No pide el siguiente: eso lo hace bucle().
    function dibujarCuadro(ahora) {
        // Segundos desde el cuadro anterior, con tope por si la pestaña estuvo pausada.
        const dt = ultimo < 0 ? 0 : limitar((ahora - ultimo) / 1000, 0, 0.05);
        ultimo = ahora;
        reloj = (reloj + dt * velocidad) % 3600;

        // En celulares se baja la calidad: menos densidad de píxeles y un campo de luz
        // más pequeño. El dibujo se ve apenas más suave, pero cuesta mucho menos.
        const esMovil = consultaMovil.matches;
        const dpr = Math.min(window.devicePixelRatio || 1, esMovil ? DPR_MAX_MOVIL : DPR_MAX);
        const divisor = esMovil ? DIVISOR_CAMPO_MOVIL : DIVISOR_CAMPO;

        // Tamaño del canvas en píxeles reales (considerando pantallas de alta densidad).
        const cw = canvas.clientWidth || 1200;
        const ch = canvas.clientHeight || 800;
        const bw = Math.max(1, Math.round(cw * dpr));
        const bh = Math.max(1, Math.round(ch * dpr));
        if (canvas.width !== bw || canvas.height !== bh) {
            canvas.width = bw;
            canvas.height = bh;
        }
        objetivo.redimensionar(Math.max(1, Math.round(bw / divisor)), Math.max(1, Math.round(bh / divisor)));

        // --- Cursor: lo suavizamos para que las cintas lo sigan con inercia ---
        const adentro = puntero.dentro ? 1 : 0;
        // Si el cursor acaba de entrar, las cintas aparecen directo en su lugar.
        if (adentro && presencia < 0.02) {
            mx = puntero.tx;
            my = puntero.ty;
        }
        presencia += (adentro - presencia) * (1 - Math.exp(-dt * 5));

        const k = 1 - Math.exp(-dt * 16);
        const nx = mx + (puntero.tx - mx) * k;
        const ny = my + (puntero.ty - my) * k;
        if (dt > 0) {
            const kv = 1 - Math.exp(-dt * 8);
            vx += ((nx - mx) / dt - vx) * kv;
            vy += ((ny - my) / dt - vy) * kv;
        }
        mx = nx;
        my = ny;
        const largoVel = Math.hypot(vx, vy) / ch;
        const topeVel = largoVel > 3 ? 3 / largoVel : 1;

        // Con movimiento reducido el cursor no debe afectar al dibujo.
        const hoverEfectivo = movimientoReducido ? 0 : hover;

        // --- Paso 1: dibujar el campo de luz en la textura pequeña ---
        gl.bindFramebuffer(gl.FRAMEBUFFER, objetivo.fbo);
        gl.viewport(0, 0, objetivo.ancho(), objetivo.alto());
        gl.useProgram(progCampo);
        gl.uniform2f(uCampo.uRes, objetivo.ancho(), objetivo.alto());
        gl.uniform1f(uCampo.uTime, reloj);
        gl.uniform3f(uCampo.uC1, color1[0], color1[1], color1[2]);
        gl.uniform3f(uCampo.uC2, color2[0], color2[1], color2[2]);
        gl.uniform1f(uCampo.uSize, tamano);
        gl.uniform1f(uCampo.uAngle, angulo);
        gl.uniform2f(uCampo.uMouse, (mx - cw / 2) / ch, (ch / 2 - my) / ch);
        gl.uniform1f(uCampo.uOn, presencia * hoverEfectivo);
        gl.uniform1f(uCampo.uReach, alcance / ch);
        gl.uniform2f(uCampo.uVel, (vx / ch) * topeVel, (-vy / ch) * topeVel);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // --- Paso 2: estirar esa textura a pantalla completa y darle el acabado ---
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, bw, bh);
        gl.useProgram(progAcabado);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, objetivo.textura());
        gl.uniform1i(uAcabado.uField, 0);
        gl.uniform2f(uAcabado.uRes, bw, bh);
        gl.uniform1f(uAcabado.uTime, reloj);
        gl.uniform3f(uAcabado.uBg, fondo[0], fondo[1], fondo[2]);
        gl.uniform1f(uAcabado.uPaper, limitar((luminosidadFondo - 0.35) / 0.3, 0, 1));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // El bucle de la animación: dibuja un cuadro y le pide al navegador el siguiente.
    function bucle(ahora) {
        raf = requestAnimationFrame(bucle);
        dibujarCuadro(ahora);
    }

    // Arranca el bucle (si ya estaba andando, no hace nada).
    function iniciar() {
        if (raf) return;
        ultimo = -1; // evita un salto de tiempo al reanudar después de una pausa
        raf = requestAnimationFrame(bucle);
    }

    // Frena el bucle: la placa de video deja de trabajar hasta que se vuelva a iniciar.
    function detener() {
        cancelAnimationFrame(raf);
        raf = 0;
    }

    // Dibuja un único cuadro fijo, sin animación. Es lo que se muestra cuando el
    // usuario pidió reducir el movimiento: el hero conserva el fondo, pero quieto.
    function dibujarEstatico() {
        ultimo = -1;          // así el cuadro se calcula sin avance de tiempo
        reloj = MOMENTO_ESTATICO;
        presencia = 0;
        dibujarCuadro(0);
    }

    // Decide qué hacer según las condiciones actuales. Se llama cada vez que una cambia.
    function actualizar() {
        if (movimientoReducido) {
            detener();
            dibujarEstatico();
        } else if (heroVisible && pestanaVisible) {
            iniciar();
        } else {
            detener();
        }
    }

    // 1) El hero entra o sale de la pantalla (por ejemplo, al bajar por la página).
    new IntersectionObserver((entradas) => {
        heroVisible = entradas[0].isIntersecting;
        actualizar();
    }).observe(raiz);

    // 2) La pestaña pasa a segundo plano o vuelve a primer plano.
    document.addEventListener("visibilitychange", () => {
        pestanaVisible = !document.hidden;
        actualizar();
    });

    // 3) El usuario activa o desactiva "reducir movimiento" en su sistema.
    consultaMovimiento.addEventListener("change", (evento) => {
        movimientoReducido = evento.matches;
        actualizar();
    });

    // 4) Con la animación quieta, si cambia el tamaño del hero hay que volver a dibujar
    //    el cuadro fijo (con la animación andando, el bucle ya se encarga).
    new ResizeObserver(() => {
        if (movimientoReducido) dibujarEstatico();
    }).observe(raiz);

    actualizar();
});