export const PATTERNS = [
  {
    id: 'guaira-tradicional',
    name: 'Golpe Guaireño Tradicional (6/8)',
    description:
      'El ritmo clásico de la costa de La Guaira: la Paila marca la cáscara continua mientras Pujao y Cruzao amarran el tumbao.',
    bpm: 124,
    steps: {
      prima: [true, false, false, true, false, true, false, true, false, true, true, false],
      cruzao: [false, true, false, false, true, false, false, true, false, false, true, false],
      pujao: [true, false, false, false, true, false, true, false, false, true, false, false],
      paila: [true, false, true, true, false, true, true, false, true, true, false, true],
      maracas: [true, false, true, true, false, true, true, false, true, true, false, true],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    },
    accents: {
      prima: [true, false, false, false, false, true, false, true, false, false, true, false],
      cruzao: [false, true, false, false, true, false, false, true, false, false, true, false],
      pujao: [true, false, false, false, true, false, true, false, false, false, false, false],
      paila: [true, false, false, true, false, false, true, false, false, true, false, false],
      maracas: [true, false, false, true, false, false, true, false, false, true, false, false],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    }
  },
  {
    id: 'san-millan',
    name: 'Cumaco San Millán / Naiguatá',
    description:
      'Formato festivo acelerado con repique fuerte en La Prima y acento cruzado entre Cruzao y Pujao.',
    bpm: 132,
    steps: {
      prima: [true, false, true, true, false, true, true, true, false, true, false, true],
      cruzao: [false, true, false, true, false, false, false, true, false, true, false, false],
      pujao: [true, false, false, true, false, false, true, false, false, true, false, false],
      paila: [true, true, false, true, true, false, true, true, false, true, true, false],
      maracas: [true, true, false, true, true, false, true, true, false, true, true, false],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    },
    accents: {
      prima: [true, false, false, true, false, false, true, false, false, true, false, false],
      cruzao: [false, true, false, false, false, false, false, true, false, false, false, false],
      pujao: [true, false, false, false, false, false, true, false, false, false, false, false],
      paila: [true, false, false, true, false, false, true, false, false, true, false, false],
      maracas: [true, false, false, true, false, false, true, false, false, true, false, false],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    }
  },
  {
    id: 'tarma-palo',
    name: 'Tambor de Tarma / Chichiriviche',
    description:
      'Métrica pesada e hipnótica, con acentuación fuerte en los palos de La Paila y el Pujao profundo.',
    bpm: 118,
    steps: {
      prima: [false, true, false, true, false, true, false, true, true, false, true, false],
      cruzao: [true, false, false, true, false, false, true, false, false, true, false, false],
      pujao: [true, false, false, false, false, true, true, false, false, false, false, true],
      paila: [true, false, true, false, true, true, true, false, true, false, true, true],
      maracas: [true, false, true, false, true, true, true, false, true, false, true, true],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    },
    accents: {
      prima: [false, false, false, true, false, true, false, false, true, false, false, false],
      cruzao: [true, false, false, false, false, false, true, false, false, false, false, false],
      pujao: [true, false, false, false, false, false, true, false, false, false, false, false],
      paila: [true, false, false, false, true, false, true, false, false, false, true, false],
      maracas: [true, false, false, false, true, false, true, false, false, false, true, false],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    }
  },
  {
    id: 'repique-rapido',
    name: 'Trance y Repique de Costa',
    description: 'Ritmo rápido de clímax con repiques continuos, para el momento de mayor energía.',
    bpm: 138,
    steps: {
      prima: [true, true, false, true, true, false, true, true, false, true, true, true],
      cruzao: [false, true, true, false, true, true, false, true, true, false, true, false],
      pujao: [true, false, false, true, false, true, true, false, false, true, false, true],
      paila: [true, true, true, true, true, true, true, true, true, true, true, true],
      maracas: [true, true, true, true, true, true, true, true, true, true, true, true],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    },
    accents: {
      prima: [true, true, false, false, true, false, true, true, false, false, true, true],
      cruzao: [false, true, false, false, true, false, false, true, false, false, true, false],
      pujao: [true, false, false, false, false, true, true, false, false, false, false, true],
      paila: [true, false, false, true, false, false, true, false, false, true, false, false],
      maracas: [true, false, false, true, false, false, true, false, false, true, false, false],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    }
  }
];
