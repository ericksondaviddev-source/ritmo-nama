/**
 * Las plantillas del editor de vídeo.
 *
 * Una plantilla decide dónde va cada cosa en el lienzo: el vídeo, el texto del
 * nombre y la marca. Todas comparten el logo y el nombre de la marca; lo que
 * cambia es el reparto del espacio, porque un clip de taller y uno de la plaza
 * piden cosas distintas.
 *
 * El texto del usuario es la ÚNICA parte libre. Todo lo demás son plantillas, a
 * propósito: un texto libre obliga a resolver mayúsculas, palabras larguísimas y
 * tipografías que no caben, y para una landing eso sale peor que bonito y
 * acotado. Lo único que se escribe a mano es el nombre, con un máximo de
 * caracteres.
 */

/** Lienzos de salida. 9:16 para compartir en WhatsApp e historias, 16:9 para YouTube. */
export const FORMATOS = {
  vertical: { id: 'vertical', etiqueta: 'Vertical 9:16', ancho: 1080, alto: 1920 },
  horizontal: { id: 'horizontal', etiqueta: 'Horizontal 16:9', ancho: 1920, alto: 1080 }
};

/**
 * Lienzo real de salida según el formato y la calidad elegidos.
 *
 * `calidad` '720' baja la resolución manteniendo la proporción (720×1280 o
 * 1280×720) y es la opción por defecto: codificar la mitad de píxeles es cerca
 * del doble de rápido y para WhatsApp o TikTok nadie nota la diferencia. '1080'
 * devuelve la resolución completa. Siempre pares, que los codecs lo exigen.
 */
export function formatoSalida(formatoId, calidad = '720') {
  const base = FORMATOS[formatoId] ?? FORMATOS.vertical;
  if (String(calidad) !== '720') {
    return { id: base.id, etiqueta: base.etiqueta, ancho: base.ancho, alto: base.alto };
  }
  const escala = 720 / Math.min(base.ancho, base.alto);
  const par = (v) => Math.round((v * escala) / 2) * 2;
  return { id: base.id, etiqueta: base.etiqueta, ancho: par(base.ancho), alto: par(base.alto) };
}

/** Cuántos caracteres caben en el nombre antes de que se haga ilegible. */
export const MAX_NOMBRE = 40;

/** Texto que se pone si el campo del nombre se deja vacío. */
export const NOMBRE_POR_DEFECTO = 'Tambores de La Guaira';

/**
 * Medidas del texto del nombre, por plantilla y formato.
 *
 * `peso` y `tamano` están dados como fracción del ancho: así la misma plantilla
 * se lee igual en 1080 que en 1920 de ancho, sin dos juegos de números.
 */
export const PLANTILLAS = [
  {
    id: 'clasico',
    nombre: 'Clásico',
    descripcion: 'Logo arriba y el nombre abajo, sobre fondo limpio.',
    texto: 'abajo',
    tamano: 0.085,
    alineacion: 'centro',
    fondo: 'transparente'
  },
  {
    id: 'baile',
    nombre: 'Baile de fulia',
    descripcion: 'Marco ámbar y el nombre grande abajo, como los_posts de la plaza.',
    texto: 'abajo',
    tamano: 0.1,
    alineacion: 'centro',
    fondo: 'ambar',
    marco: true
  },
  {
    id: 'presentacion',
    nombre: 'Presentación',
    descripcion: 'El nombre arriba, con la marca debajo.',
    texto: 'arriba',
    tamano: 0.075,
    alineacion: 'centro',
    fondo: 'transparente'
  },
  {
    id: 'tutorial',
    nombre: 'Tutorial',
    descripcion: 'El nombre arriba y despejado, para no tapar las manos.',
    texto: 'arriba',
    tamano: 0.07,
    alineacion: 'izquierda',
    fondo: 'oscuro'
  },
  {
    id: 'tienda',
    nombre: 'Negro tienda',
    descripcion: 'Fondo oscuro y texto claro, para clips de fondo claro.',
    texto: 'abajo',
    tamano: 0.09,
    alineacion: 'centro',
    fondo: 'oscuro'
  },
  {
    id: 'foto',
    nombre: 'Foto grande',
    descripcion: 'El vídeo reducido arriba y el nombre ocupando el resto.',
    texto: 'abajo',
    tamano: 0.1,
    alineacion: 'izquierda',
    fondo: 'oscuro',
    videoEncogido: true
  }
];

export const plantillaPorId = (id) => PLANTILLAS.find((p) => p.id === id) ?? PLANTILLAS[0];

/** Tamaños en los que se prueba el texto, de mayor a menor. */
const FACTORES = [1, 0.85, 0.72, 0.6];
/** Margen a los lados del lienzo: el texto nunca toca el borde. */
const MARGEN = 0.86;

/**
 * Reparte el nombre en una o dos líneas, midiendo con el mismo `measureText` que
 * se usa al dibujar. Sin esto, un nombre largo se salía del lienzo o tapaba el
 * tambor.
 *
 * Se parte por palabras, nunca por la mitad de una: cortar "María" a la mitad se
 * lee fatal. Las tildes y la eñe las cuenta `measureText` sola.
 *
 * El orden importa. Primero se prueba si el texto entero cabe en UNA línea, y
 * sólo si no cabe se busca el corte en dos. Al revés, "Ana María" salía partido
 * en dos líneas siempre, aunque sobrara medio lienzo.
 *
 * @returns {{ lineas: string[], tamanoPx: number }}
 */
export function repartirNombre(nombre, medir) {
  const limpio = (nombre ?? '').trim().replace(/\s+/g, ' ');
  const texto = limpio || NOMBRE_POR_DEFECTO;
  const ancho = medir.ancho * MARGEN;

  for (const factor of FACTORES) {
    const tamanoPx = Math.round(medir.tamano * factor);
    if (medir.texto(texto, tamanoPx) <= ancho) return { lineas: [texto], tamanoPx };
    const corte = mejorCorte(texto.split(' '), medir, tamanoPx, ancho);
    if (corte) return { lineas: corte, tamanoPx };
  }

  // Ni encogido cabe en dos líneas. Se parte por la mitad y se recorta lo que
  // sobresalga: es el caso de un nombre larguísimo, que el límite de caracteres
  // hace raro pero no imposible.
  const tamanoPx = Math.round(medir.tamano * FACTORES[FACTORES.length - 1]);
  const palabras = texto.split(' ');
  const mitad = Math.ceil(palabras.length / 2);
  const lineas = [palabras.slice(0, mitad).join(' '), palabras.slice(mitad).join(' ')].filter(Boolean);
  return { lineas: recortar(lineas, tamanoPx, medir.texto, ancho), tamanoPx };
}

/**
 * El corte en dos que deja las líneas más parejas y ambas dentro del ancho, o
 * `null` si con este tamaño no hay ningún corte que quepa.
 */
function mejorCorte(palabras, medir, tamanoPx, ancho) {
  let mejor = null;
  for (let i = 1; i < palabras.length; i++) {
    const a = palabras.slice(0, i).join(' ');
    const b = palabras.slice(i).join(' ');
    if (medir.texto(a, tamanoPx) > ancho || medir.texto(b, tamanoPx) > ancho) continue;
    const desvio = Math.abs(medir.texto(a, tamanoPx) - medir.texto(b, tamanoPx));
    if (!mejor || desvio < mejor.desvio) mejor = { a, b, desvio };
  }
  return mejor ? [mejor.a, mejor.b] : null;
}

/** Si aun así una palabra no cabe, se recorta con puntos suspensivos. */
function recortar(lineas, tamanoPx, medirTexto, ancho) {
  return lineas.map((l) => {
    if (medirTexto(l, tamanoPx) <= ancho) return l;
    let corta = l;
    while (corta.length > 1 && medirTexto(`${corta}…`, tamanoPx) > ancho) corta = corta.slice(0, -1);
    return `${corta}…`;
  });
}
/**
 * Deja un medidor de texto listo para un lienzo.
 *
 * Se pasa la función en vez de medir aquí para que este módulo no dependa del
 * DOM y se pueda probar en node: `measureText` es de `CanvasRenderingContext2D`.
 */
export function medidor(ctx) {
  return {
    ancho: ctx.canvas.width,
    tamano: 0,
    texto: (t, px) => {
      ctx.font = `800 ${px}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
      return ctx.measureText(t).width;
    }
  };
}