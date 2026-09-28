/**
 * Definición de la fulia: qué tambores la forman y cómo se golpea cada uno.
 *
 * Prima, cruzao y pujao son tamboritas de doble parche (bimembranófonos) y en el
 * fulia se tocan con las dos manos a la vez: baqueta de laurel en una y mano
 * abierta en la otra. La paila no lleva baqueta: se percute solo con las manos
 * y suena a timbal, seca y con anillo de concha.
 *
 * Este módulo es la única fuente de verdad: la síntesis (voices.js), el
 * secuenciador y el curso leen las articulaciones de aquí, de modo que añadir
 * un tambor nuevo no obliga a tocar el motor de audio.
 */

export const ARTICULATIONS = {
  laurel: {
    id: 'laurel',
    label: 'Baqueta de laurel',
    hint: 'Golpe seco de madera de laurel: ataque brillante y membrana abierta'
  },
  mano: {
    id: 'mano',
    label: 'Mano abierta',
    hint: 'Palma abierta sobre el parche: golpe ancho y más apagado'
  }
};

export const DRUMS = [
  {
    id: 'prima',
    name: 'La Prima',
    role: 'El pulso y los repiques',
    detail: 'La más pequeña: aguda, marca el tiempo y sostiene la base',
    color: '#f43f5e',
    size: 'pequeña',
    base: 380,
    articulations: ['laurel', 'mano'],
    defaultArticulation: 'laurel',
    optional: false
  },
  {
    id: 'cruzao',
    name: 'El Cruzao',
    role: 'Síncopa y sabor',
    detail: 'Mediana: se trenza con la prima y en algunas variantes se omite',
    color: '#10b981',
    size: 'mediana',
    base: 240,
    articulations: ['laurel', 'mano'],
    defaultArticulation: 'laurel',
    optional: true
  },
  {
    id: 'pujao',
    name: 'El Pujao',
    role: 'Gravedad y fuerza',
    detail: 'El más grande y grave: el que improvisa y florece',
    color: '#6366f1',
    size: 'grande',
    base: 110,
    articulations: ['laurel', 'mano'],
    defaultArticulation: 'mano',
    optional: false
  },
  {
    id: 'paila',
    name: 'La Paila',
    role: 'El aro que marca el tiempo',
    detail: 'Sin baqueta: solo con las manos, seca y con anillo de timbal',
    color: '#f59e0b',
    size: 'grande',
    base: 260,
    articulations: ['mano'],
    defaultArticulation: 'mano',
    optional: false
  }
];

const BY_ID = new Map(DRUMS.map((d) => [d.id, d]));

export const drumIds = () => DRUMS.map((d) => d.id);
export const getDrum = (id) => BY_ID.get(id) ?? null;
export const isDrum = (id) => BY_ID.has(id);

/** Articulaciones permitidas de un tambor; vacío si el id no existe. */
export const articulationsFor = (id) => BY_ID.get(id)?.articulations ?? [];

export const defaultArticulationFor = (id) =>
  BY_ID.get(id)?.defaultArticulation ?? 'laurel';

/** ids de las capas de una línea de patrón que existen hoy en el secuenciador. */
export const sequencerDrums = () => DRUMS.filter((d) => !d.optional || d.id === 'cruzao');
