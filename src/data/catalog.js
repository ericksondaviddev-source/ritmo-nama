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
 */
const D = (carpeta, hay) => {
  const base = `/assets/drums/${carpeta}`;
  return {
    modelo: hay.modelo ? `${base}/modelo.glb` : null,
    foto: hay.foto ? `${base}/foto.webp` : null,
    video: hay.video ? `${base}/video.mp4` : null
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
    ...D('AzulRayas', { modelo: true, foto: true }),
    personalizable: true
  },
  {
    id: 'gris-plateado',
    name: 'Tambor Gris Plateado',
    tagline: 'Cuerpo oscuro con parche rojo y cuerda blanca',
    precio: '49 $',
    ...D('GrisPlateado', { modelo: true, foto: true }),
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
    ...D('Rayas', { modelo: true, foto: true }),
    personalizable: true
  },
  {
    id: 'rojo-con-kit',
    name: 'Tambor Rojo con Kit',
    tagline: 'Cuerpo rojo con baqueta y forro de obsequio',
    precio: '49 $',
    ...D('RojoConKit', { modelo: true }),
    personalizable: true
  },
  {
    id: 'kit-clasico',
    name: 'Kit Clásico',
    tagline: 'Tambor, baqueta y forro de obsequio',
    precio: '49 $',
    modelo: null,
    foto: '/assets/drums/KitClasico/foto.webp',
    video: '/assets/drums/KitClasico/video.mp4',
    personalizable: false
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
 * Vídeos de taller. El de la plaza vive ahora en el hero como fondo, así que
 * aquí sólo queda material del taller a la espera de los nuevos clips.
 */
export const VIDEOS_TALLER = [
  { id: 'paseo', src: '/assets/video/paseo-taller.mp4', titulo: 'Paseo por el taller', texto: 'Del vaso al parche, paso a paso.', vertical: true },
  { id: 'recorrido', src: '/assets/video/recorrido-taller.mp4', titulo: 'Recorrido por el taller', texto: 'Cómo nace un tambor, de principio a fin.', vertical: false },
  // El primero de los tres "kit ... varios diseños" es el del Kit Clásico, y
  // vive en su carpeta; los otros dos son variantes del mismo kit.
  { id: 'kit-1', src: '/assets/video/kit-disenos-1.mp4', titulo: 'El kit en varios diseños', texto: 'Tambor, baqueta y forro en cada acabado.', vertical: true },
  { id: 'kit-2', src: '/assets/video/kit-disenos-2.mp4', titulo: 'Distintos acabados', texto: 'El mismo kit, pintado de otra manera.', vertical: true }
];

export const HERO = {
  // Fondo desenfocado y atenuado: el original es de 640x360 y se ve borroso a
  // pantalla completa, así que va como textura, no como protagonista.
  videoFondo: '/assets/hero/plaza-fondo.mp4',
  posterFondo: '/assets/hero/plaza-fondo.jpg',
  modelo: '/assets/drums/Tricolor/modelo.glb',
  audioReal: '/assets/audio/fulia-la-guaira-30s.webm'
};
