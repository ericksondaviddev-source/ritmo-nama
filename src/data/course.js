/**
 * Minicurso de fulia: una lección por tambor.
 *
 * El vocabulario es el de la fulia de la costa: prima, cruzao y pujao son
 * tamboritas de doble parche y se tocan con las dos manos a la vez, baqueta de
 * laurel en una y mano abierta en la otra. La paila no lleva baqueta: se
 * percutie solo con las manos y suena a timbal.
 *
 * El texto es también el guion que consume scripts/tts-course.mjs, así que
 * `concepto` y `tecnica` deben leerse en voz alta sin rarezas. Cada módulo
 * apunta a un patrón del secuenciador para que se escuche mientras se lee.
 */
export const COURSE_INTRO = {
  titulo: 'Velorio de Cruz de Mayo',
  intro:
    'Del 2 de mayo al 6 de junio La Guaira vive el velorio de Cruz de Mayo. Se arma una cruz de madera en la plaza, se reza el rosario y se canta con décimas y guazas. La música no es un adorno: es la velación. Esa noche se toca la fulia, el tambor de tres tambores que acompaña al velorio, y al otro lado de la plaza responde el tumbao. Nadie aplaude ni nadie baila mientras se reza: el tumbao es un silencio respetuoso, el rezo es el que golpea.'
};

export const COURSE = [
  {
    instrument: 'prima',
    title: 'La Prima',
    concepto:
      'La prima es la más pequeña de las tres y la más aguda. Su parche da la nota: marca el tiempo y llama a los demás a entrar. En la fulia quien lleva la prima dirige la rueda, y su repique es la señal para arrancar.',
    tecnica:
      'Doble parche, así que tienes dos manos: la baqueta de laurel en una y la mano abierta en la otra. Con la baqueta marcas el tiempo; con la palma abres el sonido cuando quieres levantar la rueda. El golpe nace del rebote de la muñeca, no de la fuerza del brazo.',
    patternId: 'guaira-tradicional',
    articulation: 'laurel'
  },
  {
    instrument: 'cruzao',
    title: 'El Cruzao',
    concepto:
      'El cruzao es la mediana y se trenza con la prima: entra en los huecos que ella deja. Juntos forman el diálogo de la fulia. En algunas variantes el cruzao se omite y quedan prima y pujao, pero cuando está, es el que da el sabor y la síncopa.',
    tecnica:
      'Igual que la prima, doble parche y dos manos. Con la baqueta de laurel haces el cruce seco y con la mano abierta acomodas el fraseo. Golpea los espacios libres, sin pisar la melodía de la prima: escucha primero, responde después.',
    patternId: 'san-millan',
    articulation: 'mano'
  },
  {
    instrument: 'pujao',
    title: 'El Pujao',
    concepto:
      'El pujao es el más grande y el más grave: es el suelo de todo. Cuando suenan prima y cruzao arriba, el pujao sostiene el peso. Es el que se deja improvisar: el que floretea en cada cambio de turno del baile.',
    tecnica:
      'Doble parche y las dos manos igual: baqueta de laurel en una, mano abierta en la otra. El pujao pide peso y cuerpo, así que golpea cerca del borde para un sonido profundo y seco, no para una nota aguda. Es el tambor que marca el cambio de turno del baile, y su frase se improvisa y se respeta.',
    patternId: 'tarma-palo',
    articulation: 'mano'
  },
  {
    instrument: 'paila',
    title: 'La Paila',
    concepto:
      'La paila no lleva baqueta: se toca únicamente con las manos. Suena a timbal, seca y con el anillo de la concha, y es la que marca el tiempo de la rueda. Hay quien la trata como un idiófono y golpea la madera o el aro; el efecto es el mismo carácter seco y metálico.',
    tecnica:
      'Solo palmas, alternadas, con muñeca suelta. Busca un sonido parejo y brillante, sin apagarlo. Como no lleva baqueta, su articulación es siempre de mano: es el tambor que fija el pulso cuando el resto se adorna.',
    patternId: 'repique-rapido',
    articulation: 'mano'
  }
];
