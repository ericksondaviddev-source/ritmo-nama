export const KIT_INCLUIDO = [
  'Doble parche sintÃ©tico impermeable',
  'Baqueta profesional de obsequio',
  'Forro de tela de obsequio',
  'GarantÃ­a de 6 meses',
  'Acceso al minicurso de fulia',
  'Acceso a la mini-app MidiPad'
];

// Cada producto es un acabado real y existente: no hay recolores ficticios.
// `model` sÃ³lo existe cuando hay escaneo 3D del tambor; el acabado se ve tal
// cual en el modelo porque las texturas son del objeto real.
export const PRODUCTS = [
  {
    id: 'azul-rayas',
    name: 'Tambor Azul Rayas',
    tagline: 'Cilindro turquesa con galones negros y cuerda',
    price: '49 $',
    model: '/assets/models/EscaneoAzul.glb',
    poster: '/assets/img/escaneo-azul.jpg',
    foto: '/assets/img/tambor-azul-rayas.jpg',
    video: '/assets/video/kit-disenos-1.mp4',
    customizable: true
  },
  {
    id: 'gris-plateado',
    name: 'Tambor Gris Plateado',
    tagline: 'Cuerpo oscuro con parche rojo y cuerda blanca',
    price: '49 $',
    model: '/assets/models/EscaneoGris.glb',
    poster: '/assets/img/escaneo-gris.jpg',
    video: '/assets/video/kit-disenos-2.mp4',
    customizable: true
  },
  {
    id: 'negro-chispas',
    name: 'Tambor Negro Chispas',
    tagline: 'Negro con cuerda blanca y etiqueta dorada',
    price: '49 $',
    model: '/assets/models/EscaneoNegro.glb',
    poster: '/assets/img/escaneo-negro.jpg',
    video: '/assets/video/kit-disenos-3.mp4',
    customizable: true
  },
  {
    id: 'madera-clara',
    name: 'Tambor Madera Clara',
    tagline: 'Madera clara, sin pintar',
    price: '49 $',
    model: '/assets/models/EscaneoMaderaClara.glb',
    poster: null, // falta la foto del taller; el 3D ya estÃ¡ listo
    video: null,
    customizable: true
  },
  {
    id: 'madera-oscura',
    name: 'Tambor Madera Oscura',
    tagline: 'Madera oscura, tono profundo',
    price: '49 $',
    model: '/assets/models/EscaneoMaderaOscura.glb',
    poster: null, // falta la foto del taller; el 3D ya estÃ¡ listo
    video: null,
    customizable: true
  },
  {
    id: 'rayas',
    name: 'Tambor Rayas',
    tagline: 'Rayas verticales, pintado a mano',
    price: '49 $',
    model: null,
    poster: '/assets/img/tambor-rayas.jpg',
    video: null,
    customizable: false
  },  {
    id: 'kit-clasico',
    name: 'Kit ClÃ¡sico',
    tagline: 'Tambor, baqueta y forro de obsequio',
    price: '49 $',
    model: null,
    poster: '/assets/img/kit-clasico.jpg',
    video: '/assets/video/multicolor-estrella.mp4',
    customizable: false
  },
  {
    id: 'personaliza',
    name: 'Personaliza el tuyo',
    tagline: 'TÃº eliges el acabado, nosotros lo fabricamos',
    price: 'A medida',
    isCta: true,
    customizes: 'azul-rayas'
  }
];

// Productos que tienen escaneo 3D y se pueden girar en el configurador.
export const MODELOS_3D = PRODUCTS.filter((p) => p.model).map((p) => p.id);

// Acabados disponibles = los productos reales, cada uno con su imagen.
// No es un selector de color: es un selector de tambor existente.
export const ACABADOS = PRODUCTS.filter((p) => !p.isCta).map((p) => ({
  id: p.id,
  label: p.name,
  image: p.poster,
  model: p.model
}));

export const PRODUCTO_POR_DEFECTO = 'azul-rayas';

// VÃ­deos del taller y de la comunidad, fuera del catÃ¡logo de producto.
// `ancho: true` los reserva para una franja apaisada: en vertical se ven
// pequeÃ±os y en horizontal son el propio protagonista.
export const VIDEOS_TALLER = [
  {
    id: 'plaza',
    src: '/assets/video/en-la-plaza.mp4',
    poster: '/assets/img/en-la-plaza.jpg',
    titulo: 'En la plaza, en familia',
    texto: 'La noche se prende antes de que suene el primer golpe.',
    ancho: true
  },
  {
    id: 'taller',
    src: '/assets/video/paseo-taller.mp4',
    poster: null,
    titulo: 'Paseo por el taller',
    texto: 'Del vaso al parche, paso a paso.',
    ancho: false
  },
  {
    id: 'personas',
    src: '/assets/video/personas-tambores.mp4',
    poster: null,
    titulo: 'Tambores en la fiesta',
    texto: 'Cuando suena la fulia, el barrio se junta.',
    ancho: false
  }
];
