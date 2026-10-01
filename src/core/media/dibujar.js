/**
 * Dibujo de un fotograma del clip con la plantilla encima.
 *
 * Es lo que usan las dos piezas: la previsualización en vivo y el render. Si
 * dibujaran por su cuenta, lo que se ve antes de descargar y lo que sale en el
 * fichero serían dos cosas distintas, que es la forma más fiable de quejarse
 * después de haber esperado 40 segundos.
 */
import { NOMBRE_POR_DEFECTO, repartirNombre } from './plantillas.js';

const MARCA = 'Cuero Na’má';
const MARCA_MARCA = 'Ritmo Na’má';

const FUENTE = "800 __PX__px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Estilo del logo para la marca, según el fondo de la plantilla. */
const MARCA_CLARA = { principal: '#ffffff', secundario: 'rgba(255,255,255,0.72)' };
const MARCA_OSCURA = { principal: '#fde68a', secundario: 'rgba(253,230,138,0.75)' };

/**
 * Prepara un contexto 2D para el tamaño de salida pedido y devuelve lo que hace
 * falta para dibujar encima.
 */
export function crearLienzo(ancho, alto) {
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d', { alpha: false });
  return { canvas, ctx };
}

/** Medidor de texto ligado a un contexto real, para `repartirNombre`. */
function medidorDe(ctx, ancho, tamanoBasePx) {
  return {
    ancho,
    tamano: tamanoBasePx,
    texto: (t, px) => {
      ctx.font = FUENTE.replace('__PX__', String(px));
      return ctx.measureText(t).width;
    }
  };
}

/**
 * Dibuja un fotograma completo en `ctx`.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opciones
 * @param {CanvasImageSource|null} opciones.fotograma  el vídeo ya dibujado
 * @param {object} opciones.plantilla
 * @param {string} opciones.nombre  el texto del usuario (puede ir vacío)
 * @param {object} opciones.formato  { ancho, alto }
 */
export function dibujarFotograma(ctx, { fotograma, plantilla, nombre, formato }) {
  const { ancho, alto } = formato;

  // 1. Fondo del vídeo, cubriendo el lienzo sin deformarlo.
  ctx.save();
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, ancho, alto);
  if (fotograma) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const caja = encuadrar(fotograma, { ancho, alto, encoger: plantilla.videoEncogido });
    ctx.drawImage(fotograma, caja.x, caja.y, caja.w, caja.h);
  }
  ctx.restore();

  // 2. Fondo de la plantilla, si pide uno.
  if (plantilla.fondo === 'oscuro') {
    degradado(ctx, '#09090b', 'rgba(9,9,11,0.55)', alto);
  } else if (plantilla.fondo === 'ambar') {
    ctx.fillStyle = 'rgba(217,119,6,0.16)';
    ctx.fillRect(0, 0, ancho, alto);
  }

  if (plantilla.marco) {
    ctx.strokeStyle = 'rgba(245,158,11,0.85)';
    ctx.lineWidth = Math.max(4, Math.round(ancho * 0.012));
    const m = ctx.lineWidth;
    ctx.strokeRect(m, m, ancho - m * 2, alto - m * 2);
  }

  // 3. El nombre del usuario, repartido en una o dos líneas.
  const tamanoBase = Math.round(ancho * plantilla.tamano);
  const { lineas, tamanoPx } = repartirNombre(nombre, medidorDe(ctx, ancho, tamanoBase));
  dibujarNombre(ctx, { lineas, tamanoPx, plantilla, ancho, alto, formato });

  // 4. La marca, siempre visible y siempre la misma.
  dibujarMarca(ctx, { plantilla, ancho, alto });
}

/**
 * Sitúa el vídeo dentro del lienzo.
 *
 * Los clips del taller son verticales y la plantilla "Foto grande" deja sitio
 * abajo, así que `encoger` reduce la altura para que el texto tenga su sitio sin
 * tapar nada.
 */
function encuadrar(fotograma, { ancho, alto, encoger }) {
  const natural = fotograma.videoWidth || fotograma.width || ancho;
  const naturalAlto = fotograma.videoHeight || fotograma.height || alto;

  if (encoger) {
    const altoVideo = alto * 0.62;
    const escala = Math.min(ancho / natural, altoVideo / naturalAlto);
    const w = natural * escala;
    const h = naturalAlto * escala;
    return { x: (ancho - w) / 2, y: 0, w, h };
  }

  // cover: llena el lienzo sin deformar, recortando lo que sobre.
  const escala = Math.max(ancho / natural, alto / naturalAlto);
  const w = natural * escala;
  const h = naturalAlto * escala;
  return { x: (ancho - w) / 2, y: (alto - h) / 2, w, h };
}

function degradado(ctx, desde, hasta, alto) {
  const g = ctx.createLinearGradient(0, 0, 0, alto);
  g.addColorStop(0, desde);
  g.addColorStop(0.55, hasta);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ctx.canvas.width, alto);
}

function dibujarNombre(ctx, { lineas, tamanoPx, plantilla, ancho, alto }) {
  const altoLinea = tamanoPx * 1.18;
  const altoBloque = altoLinea * lineas.length;
  const margen = Math.round(ancho * 0.07);

  // Sombra suave: sin ella, el texto blanco sobre un parche claro se pierde.
  ctx.save();
  ctx.font = FUENTE.replace('__PX__', String(tamanoPx));
  ctx.textAlign = plantilla.alineacion === 'izquierda' ? 'left' : 'center';
  ctx.textBaseline = 'middle';
  const x = plantilla.alineacion === 'izquierda' ? margen : ancho / 2;

  // El bloque va arriba o abajo, dejando aire para la marca en el otro extremo.
  const yBloque =
    plantilla.texto === 'arriba'
      ? margen + altoBloque / 2 + alto * 0.03
      : alto - margen - altoBloque / 2 - alto * 0.09;

  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = Math.round(tamanoPx * 0.28);
  ctx.shadowOffsetY = Math.round(tamanoPx * 0.06);
  ctx.fillStyle = '#ffffff';

  lineas.forEach((l, i) => {
    ctx.fillText(l, x, yBloque + i * altoLinea);
  });
  ctx.restore();
}

function dibujarMarca(ctx, { plantilla, ancho, alto }) {
  const escala = plantilla.fondo === 'oscuro' ? MARCA_OSCURA : MARCA_CLARA;
  const px = Math.round(ancho * 0.038);
  const margen = Math.round(ancho * 0.07);

  // Va en el extremo contrario al nombre para que no se pisen.
  const arriba = plantilla.texto !== 'arriba';
  const y = arriba ? margen : alto - margen - px * 0.2;

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // El logo: el tambor del favicon, dibujado aquí para no depender de cargar
  // nada externo durante el render.
  const r = px * 0.62;
  const cx = margen + r;
  const cy = y + px * 0.1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fill();

  const xTexto = cx + r + ancho * 0.02;
  ctx.fillStyle = escala.principal;
  ctx.font = FUENTE.replace('__PX__', String(px));
  ctx.fillText(MARCA_MARCA, xTexto, cy - px * 0.16);
  ctx.fillStyle = escala.secundario;
  ctx.font = FUENTE.replace('__PX__', String(Math.round(px * 0.62)));
  ctx.fillText(MARCA, xTexto, cy + px * 0.5);

  ctx.restore();
}

/** El texto por defecto, para mostrarlo como pista en el campo. */
export const textoPorDefecto = () => NOMBRE_POR_DEFECTO;