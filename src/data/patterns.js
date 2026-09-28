/**
 * Patrones del secuenciador.
 *
 * Sólo entran los cuatro tambores de la fulia. Cada patrón declara además con
 * qué articulación se toca cada tambor, porque la baqueta de laurel y la mano
 * abierta están siempre disponibles a la vez en el fulia: la prima y el cruzao
 * suenan con madera y el pujao con palma, o al revés según el carácter del
 * ritmo. La paila sólo admite mano.
 */
export const PATTERNS = [
  {
    id: 'guaira-tradicional',
    name: 'Golpe Guaireño Tradicional (6/8)',
    description:
      'El ritmo clásico de la costa de La Guaira: la paila marca la cáscara continua mientras pujao y cruzao amarran el tumbao.',
    bpm: 124,
    articulation: { prima: 'laurel', cruzao: 'laurel', pujao: 'mano', paila: 'mano' },
    steps: {
      prima: [true, false, false, true, false, true, false, true, false, true, true, false],
      cruzao: [false, true, false, false, true, false, false, true, false, false, true, false],
      pujao: [true, false, false, false, true, false, true, false, false, true, false, false],
      paila: [true, false, true, true, false, true, true, false, true, true, false, true]
    },
    accents: {
      prima: [true, false, false, false, false, true, false, true, false, false, true, false],
      cruzao: [false, true, false, false, true, false, false, true, false, false, true, false],
      pujao: [true, false, false, false, true, false, true, false, false, false, false, false],
      paila: [true, false, false, true, false, false, true, false, false, true, false, false]
    }
  },
  {
    id: 'san-millan',
    name: 'Cumaco San Millán / Naiguatá',
    description:
      'Formato festivo acelerado con repique fuerte en la prima y acento cruzado entre cruzao y pujao.',
    bpm: 132,
    articulation: { prima: 'laurel', cruzao: 'mano', pujao: 'laurel', paila: 'mano' },
    steps: {
      prima: [true, false, true, true, false, true, true, true, false, true, false, true],
      cruzao: [false, true, false, true, false, false, false, true, false, true, false, false],
      pujao: [true, false, false, true, false, false, true, false, false, true, false, false],
      paila: [true, true, false, true, true, false, true, true, false, true, true, false]
    },
    accents: {
      prima: [true, false, false, true, false, false, true, false, false, true, false, false],
      cruzao: [false, true, false, false, false, false, false, true, false, false, false, false],
      pujao: [true, false, false, false, false, false, true, false, false, false, false, false],
      paila: [true, false, false, true, false, false, true, false, false, true, false, false]
    }
  },
  {
    id: 'tarma-palo',
    name: 'Tambor de Tarma / Chichiriviche',
    description:
      'Métrica pesada e hipnótica, con acentuación fuerte en los palos de la paila y el pujao profundo.',
    bpm: 118,
    articulation: { prima: 'laurel', cruzao: 'laurel', pujao: 'mano', paila: 'mano' },
    steps: {
      prima: [false, true, false, true, false, true, false, true, true, false, true, false],
      cruzao: [true, false, false, true, false, false, true, false, false, true, false, false],
      pujao: [true, false, false, false, false, true, true, false, false, false, false, true],
      paila: [true, false, true, false, true, true, true, false, true, false, true, true]
    },
    accents: {
      prima: [false, false, false, true, false, true, false, false, true, false, false, false],
      cruzao: [true, false, false, false, false, false, true, false, false, false, false, false],
      pujao: [true, false, false, false, false, false, true, false, false, false, false, false],
      paila: [true, false, false, false, true, false, true, false, false, false, true, false]
    }
  },
  {
    id: 'repique-rapido',
    name: 'Trance y Repique de Costa',
    description: 'Ritmo rápido de clímax con repiques continuos, para el momento de mayor energía.',
    bpm: 138,
    articulation: { prima: 'laurel', cruzao: 'laurel', pujao: 'laurel', paila: 'mano' },
    steps: {
      prima: [true, true, false, true, true, false, true, true, false, true, true, true],
      cruzao: [false, true, true, false, true, true, false, true, true, false, true, false],
      pujao: [true, false, false, true, false, true, true, false, false, true, false, true],
      paila: [true, true, true, true, true, true, true, true, true, true, true, true]
    },
    accents: {
      prima: [true, true, false, false, true, false, true, true, false, false, true, true],
      cruzao: [false, true, false, false, true, false, false, true, false, false, true, false],
      pujao: [true, false, false, false, false, true, true, false, false, false, false, true],
      paila: [true, false, false, true, false, false, true, false, false, true, false, false]
    }
  }
];

/** Patrón por defecto: el golpe guaireño. */
export const DEFAULT_PATTERN_ID = 'guaira-tradicional';
export const patternById = (id) => PATTERNS.find((p) => p.id === id) ?? null;
