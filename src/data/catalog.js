/**
 * Catálogo de tambores.
 *
 * Un tambor = una carpeta en `public/assets/drums/<Carpeta>/` con sus tres
 * medios: `modelo.glb`, `foto.webp` y `video.mp4`. Aquí sólo se declara qué es
 * cada tambor y a qué medios apunta; los archivos se generan con
 * `npm run media:drums` y se validan con `npm run check:assets`.
 *
 * `foto` y `video` pueden venir a null: el producto entra igual (tiene su 3D)
 * y la tarjeta lo dice con un marcador, en vez de una imagen rota.
 */
/**
 * Un tambor = una carpeta en `public/assets/drums/<Carpeta>/` con sus medios.
 *
 * Se declara sólo lo que ya existe en esa carpeta: si un medio todavía no ha
 * llegado del taller, va a null y la tarjeta lo dice con su marcador, en vez de
 * apuntar a un archivo roto. El test `catalog.test.js` falla si aquí se declara
 * algo que no esté en disco, así que la lista no puede desincronizarse.
 *
 * También exige lo contrario: todos los medios de un producto salen de la misma
 * carpeta. Se rompió una vez al fusionar el Kit Clásico con el Tambor Rojo, que
 * dejaron repartidos entre dos carpetas.
 */
const D = (carpeta, hay) => {
  const base = `/assets/drums/${carpeta}`;
  return {
    modelo: hay.modelo ? `${base}/modelo.glb` : null,
    foto: hay.foto ? `${base}/foto.webp` : null,
    video: hay.video ? `${base}/video.mp4` : null,
    // Póster del vídeo: un fotograma a los 2 s. Sin él, una tarjeta con vídeo
    // muestra la foto y un vídeo del taller muestra un rectángulo negro hasta
    // que se pulsa reproducir.
    poster: hay.video ? `${base}/video.webp` : null
  };
};

export const KIT_INCLUIDO = [
  'Doble parche sintético impermeable',
  'Baqueta profesional de obsequio',
  'Forro de tela de obsequio',
  'Garantía de 6 meses',
  'Acceso al minicurso de fulia',
  'Acceso a la mini-app MidiPad'
];

export const PRODUCTS = [
  {
    id: 'tricolor',
    name: 'Tambor Tricolor',
    tagline: 'Salpicado rojo, amarillo y azul: el más alegre',
    precio: '49 $',
    ...D('Tricolor', { modelo: true, foto: true, video: true }),
    personalizable: true,
    destacado: true
  },
  {
    id: 'azul-rayas',
    name: 'Tambor Azul Rayas',
    tagline: 'Cilindro turquesa con galones negros y cuerda',
    precio: '49 $',
    ...D('AzulRayas', { modelo: true, foto: true, video: true }),
    personalizable: true
  },
  {
    id: 'madera-clara',
    name: 'Tambor Madera Clara',
    tagline: 'Madera clara, sin pintar',
    precio: '49 $',
    ...D('MaderaClara', { modelo: true, foto: true, video: true }),
    personalizable: true
  },
  {
    id: 'madera-oscura',
    name: 'Tambor Madera Oscura',
    tagline: 'Madera oscura, tono profundo',
    precio: '49 $',
    ...D('MaderaOscura', { modelo: true, foto: true, video: true }),
    personalizable: true
  },
  {
    id: 'rayas',
    name: 'Tambor Rayas',
    tagline: 'Rayas verticales, pintado a mano',
    precio: '49 $',
    ...D('Rayas', { modelo: true, foto: true, video: true }),
    personalizable: true
  },
  {
    // El 3D venía del Tambor Rojo y la foto y el vídeo del Kit Clásico: eran el
    // mismo producto en dos fichas, una con modelo y sin material del taller y
    // otra al revés. Fusionadas en una, la ficha tiene las tres cosas.
    id: 'rojo-con-kit',
    name: 'Tambor Rojo con Kit',
    tagline: 'Tambor, baqueta y forro de obsequio',
    precio: '49 $',
    ...D('RojoConKit', { modelo: true, foto: true, video: true }),
    personalizable: true
  },
  {
    id: 'personaliza',
    name: 'Personaliza el tuyo',
    tagline: 'Tú eliges el acabado, nosotros lo fabricamos',
    precio: 'A medida',
    isCta: true,
    customizes: 'tricolor'
  }
];

const reales = () => PRODUCTS.filter((p) => !p.isCta);

/** Tambores que se pueden girar en el configurador. */
export const MODELOS_3D = reales()
  .filter((p) => p.modelo)
  .map((p) => p.id);

/**
 * Acabados = los productos reales, cada uno con su foto. No es un selector de
 * color: es un selector de tambor que existe.
 */
export const ACABADOS = reales().map((p) => ({
  id: p.id,
  label: p.name,
  image: p.foto,
  modelo: p.modelo
}));

export const PRODUCTO_POR_DEFECTO = 'tricolor';

/**
 * Lo que falta por tambor. Se muestra en el taller y sirve de lista de trabajo:
 * el 3D suele llegar antes que la foto y el vídeo.
 */
export const MEDIOS_PENDIENTES = reales()
  .map((p) => {
    const falta = [];
    if (!p.modelo) falta.push('3D');
    if (!p.foto) falta.push('foto');
    if (!p.video) falta.push('vídeo');
    return falta.length ? { id: p.id, name: p.name, falta } : null;
  })
  .filter(Boolean);

/**
 * Vídeos del taller.
 *
 * Todos llevan `poster`: sin él, la sección es una rejilla de rectángulos negros
 * porque van con `preload="none"`, que es justo lo que parece que no ha cargado.
 *
 * No se incluyen aquí los clips de los tambores: esos salen en su propia tarjeta
 * del catálogo, donde sí se ven al pasar el dedo o el ratón.
 */
const V = (id, archivo, titulo, texto, vertical) => ({
  id,
  src: `/assets/video/${archivo}.mp4`,
  poster: `/assets/video/${archivo}.webp`,
  titulo,
  texto,
  vertical
});

export const VIDEOS_TALLER = [
  // Horizontales arriba, a dos columnas.
  V('recorrido', 'recorrido-taller', 'Recorrido por el taller', 'Cómo nace un tambor, de principio a fin.', false),
  V('en-la-plaza', 'en-la-plaza', 'En la plaza, en familia', 'La fulia sonando donde se arma el velorio.', false),
  V('madera-clara', 'madera-clara', 'Madera clara', 'La madera tal cual, sin pintar.', false),
  V('madera-oscura', 'madera-oscura', 'Madera oscura', 'El mismo tono de madera, más profundo.', false),
  // Verticales, a tres columnas.
  V('paseo', 'paseo-taller', 'Paseo por el taller', 'Del vaso al parche, paso a paso.', true),
  V('diseno-azul', 'diseno-azul', 'Diseño Azul', 'Un tambor pintado a mano en turquesa.', true),
  V('multicolor', 'multicolor-estrella', 'Estrella multicolor', 'Salpicado de colores para el que despierte.', true),
  V('kit-1', 'kit-disenos-1', 'El kit en varios diseños', 'Tambor, baqueta y forro en cada acabado.', true),
  V('kit-2', 'kit-disenos-2', 'Distintos acabados', 'El mismo kit, pintado de otra manera.', true)
];

export const HERO = {
  // Los niños tocando sustituyen a la plaza. Es vertical (360x640) y el tambor
  // 3D va a la derecha: en horizontal el niño quedaba encogido en una banda
  // estrecha al lado del texto.
  videoFondo: '/assets/hero/ninos-tocando.mp4',
  posterFondo: '/assets/hero/ninos-tocando.webp',
  modelo: '/assets/drums/Tricolor/modelo.glb',
  audioReal: '/assets/audio/fulia-la-guaira-30s.webm'
};
