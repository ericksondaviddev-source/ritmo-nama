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
    id: 'drumkid-multicolor',
    name: 'Drumkid Multicolor',
    tagline: 'Splatter artesanal, el más alegre',
    price: '49 $',
    model: '/assets/models/Drumkidmulticolor3D.glb',
    video: '/assets/video/Drumkidmulticolor3D.mp4',
    poster: '/assets/img/drumskidmulticolor.jpg',
    customizable: true
  },
  {
    id: 'drumkid-clasico',
    name: 'Drumkid Clásico',
    tagline: 'Madera natural, clásico de siempre',
    price: '49 $',
    model: '/assets/models/Drumkid3D.glb',
    video: '/assets/video/Drumkid3D.mp4',
    poster: '/assets/img/Red_wooden_drum_with_mallet_20260925130521.jpg',
    customizable: true
  },
  {
    id: 'set-nama',
    name: "Set Na'má",
    tagline: 'Exhibidor con diseños variados',
    price: '49 $ por unidad',
    model: '/assets/models/Mostradordrums.glb',
    video: '/assets/video/mostradordrum.mp4',
    poster: '/assets/img/Colorful_drums_on_wooden_shelf.jpg',
    customizable: false
  },
  {
    id: 'personaliza',
    name: 'Personaliza el tuyo',
    tagline: 'Tú diseñas, nosotros fabricamos',
    price: 'A medida',
    isCta: true,
    customizes: 'drumkid-multicolor'
  }
];

export const FINISHES = {
  wood: [
    { id: 'original', label: 'Original', hex: '#ffffff' },
    { id: 'nogal', label: 'Nogal', hex: '#7c4a26' },
    { id: 'caoba', label: 'Caoba', hex: '#9a3a28' },
    { id: 'oro', label: 'Oro viejo', hex: '#c08a2e' }
  ],
  head: [
    { id: 'original', label: 'Original', hex: '#ffffff' },
    { id: 'marfil', label: 'Marfil', hex: '#f1e3c6' },
    { id: 'negro', label: 'Negro', hex: '#3f3f46' },
    { id: 'rojo', label: 'Rojo fulia', hex: '#c2413a' }
  ],
  trim: [
    { id: 'original', label: 'Original', hex: '#ffffff' },
    { id: 'dorado', label: 'Dorado', hex: '#d9a441' },
    { id: 'verde', label: 'Verde tambor', hex: '#3f9b7d' },
    { id: 'coral', label: 'Coral', hex: '#e0615a' }
  ]
};

export const FINISH_ZONES = [
  { id: 'wood', label: 'Madera del cilindro' },
  { id: 'head', label: 'Parches' },
  { id: 'trim', label: 'Lazos y baqueta' }
];

// Acabados de referencia para la personalización (el fabricante los hace a mano)
export const PALETTES = [
  { id: 'splatter-clasico', label: 'Splatter Clásico', colors: ['#dc2626', '#f59e0b', '#3b82f6'] },
  { id: 'rojo-fulia', label: 'Rojo Fulia', colors: ['#b91c1c', '#dc2626', '#7f1d1d'] },
  { id: 'azul-guaira', label: 'Azul Guaira', colors: ['#1d4ed8', '#3b82f6', '#0ea5e9'] },
  { id: 'verde-tambor', label: 'Verde Tambor', colors: ['#047857', '#059669', '#10b981'] },
  { id: 'negro-caoba', label: 'Negro Caoba', colors: ['#1c1917', '#44403c', '#78716c'] }
];
