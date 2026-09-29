import { articulationsFor, defaultArticulationFor, isDrum } from '../../data/drums.js';

/**
 * SÃƒÂ­ntesis en dos ejes independientes:
 *
 *   MEMBRANE  quÃƒÂ© tambor es  -> cuerpo, tono y resonancia propios de cada parche
 *   ARTIC     cÃƒÂ³mo se golpea  -> el ataque y cÃƒÂ³mo la articulaciÃƒÂ³n altera el cuerpo
 *
 * La voz final es la mezcla de ambos. AsÃƒÂ­ una baqueta de laurel suena a
 * "prima" y a "cruzao" con el mismo ataque de madera, sin duplicar capas, y
 * aÃƒÂ±adir un tambor nuevo no obliga a reescribir los golpes.
 *
 * Capas de un golpe: ataque (ruido filtrado) + cuerpo (oscilador con caÃƒÂ­da) +
 * anillo (resonancia breve) + aire (resonancia del cuerpo del tambor).
 */

const MEMBRANE = {
  prima: {
    body: { kind: 'osc', type: 'sine', from: 380, to: 210, glide: 0.08, gain: 0.9, decay: 0.22, stop: 0.24 },
    ring: { kind: 'osc', type: 'triangle', from: 1150, to: 900, glide: 0.06, gain: 0.18, decay: 0.12, stop: 0.14 },
    air: { kind: 'noise', duration: 0.08, filter: { type: 'lowpass', freq: 900 }, gain: 0.15, decay: 0.08 },
    // La palma abierta apaga el anillo de la membrana.
    ringHold: 0.7
  },
  cruzao: {
    body: { kind: 'osc', type: 'triangle', from: 240, to: 120, glide: 0.1, gain: 0.95, decay: 0.3, stop: 0.32 },
    ring: { kind: 'osc', type: 'sine', from: 720, to: 660, glide: 0.05, gain: 0.15, decay: 0.15, stop: 0.17 },
    air: { kind: 'noise', duration: 0.1, filter: { type: 'lowpass', freq: 700 }, gain: 0.2, decay: 0.1 },
    ringHold: 0.72
  },
  pujao: {
    body: { kind: 'osc', type: 'sine', from: 110, to: 48, glide: 0.16, gain: 1.1, decay: 0.55, stop: 0.6 },
    ring: { kind: 'osc', type: 'triangle', from: 260, to: 200, glide: 0.08, gain: 0.12, decay: 0.2, stop: 0.22 },
    sub: { kind: 'osc', type: 'sine', from: 55, to: 40, glide: 0.12, gain: 0.5, decay: 0.4, stop: 0.44 },
    air: { kind: 'noise', duration: 0.08, filter: { type: 'lowpass', freq: 500 }, gain: 0.16, decay: 0.08 },
    ringHold: 0.8
  },
  paila: {
    // Paila: solo manos. Cuerpo corto y duro mÃƒÂ¡s el anillo de concha que la
    // hace sonar a timbal; ese anillo es justo lo que la distingue.
    body: { kind: 'osc', type: 'sine', from: 260, to: 130, glide: 0.09, gain: 0.7, decay: 0.2, stop: 0.22 },
    ring: { kind: 'osc', type: 'triangle', from: 900, to: 700, glide: 0.05, gain: 0.12, decay: 0.1, stop: 0.12 },
    air: { kind: 'noise', duration: 0.09, filter: { type: 'lowpass', freq: 800 }, gain: 0.18, decay: 0.09 },
    ringHold: 1.25
  }
};

/**
 * ARTIC son modificadores, no capas fijas: `attack` sÃƒÂ­ aporta una capa y el
 * resto escala lo que ya aporta la membrana.
 */
const ARTIC = {
  laurel: {
    label: 'Baqueta de laurel',
    attack: {
      kind: 'noise',
      duration: 0.022,
      filter: { type: 'bandpass', freq: 4200, q: 5 },
      gain: 0.62,
      decay: 0.022
    },
    // Madera dura sobre parche tenso: mÃƒÂ¡s brillo, el anillo suena entero.
    brightMul: 1.12,
    bodyGain: 1,
    ringHold: 1.15,
    airGain: 0.9
  },
  mano: {
    label: 'Mano abierta',
    attack: {
      kind: 'noise',
      duration: 0.055,
      filter: { type: 'bandpass', freq: 1200, q: 1.2 },
      gain: 0.8,
      decay: 0.055
    },
    // La palma amortigua el parche: menos brillo y menos cola.
    brightMul: 0.92,
    bodyGain: 0.85,
    ringHold: 0.75,
    airGain: 1.2
  }
};

const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;

function scaleOsc(skin, layer, ratio, artic) {
  const tail = artic.ringHold * skin.ringHold;
  return {
    ...layer,
    // El tono lo fija `ratio` (afinaciÃƒÂ³n en semitonos). La articulaciÃƒÂ³n NO
    // altera la nota: sÃƒÂ³lo el timbre, asÃƒÂ­ que aquÃƒÂ­ no entra `brightMul`.
    from: r2(layer.from * ratio),
    to: r2(layer.to * ratio),
    gain: r3(layer.gain * artic.bodyGain),
    decay: r3(layer.decay * tail),
    stop: r3(layer.stop * tail)
  };
}

function scaleNoise(skin, layer, ratio, artic) {
  const tail = artic.ringHold * skin.ringHold;
  return {
    ...layer,
    filter: { ...layer.filter, freq: r2(layer.filter.freq * ratio * artic.brightMul) },
    gain: r3(layer.gain * artic.airGain),
    decay: r3(layer.decay * tail)
  };
}

/**
 * Capas de un golpe.
 * @param {string} id           tambor (prima | cruzao | pujao | paila)
 * @param {number} pitchRatio   multiplicador de afinaciÃƒÂ³n (2 = una octava)
 * @param {string} articulation baqueta de laurel o mano abierta
 *
 * Si la articulaciÃƒÂ³n no existe o el tambor no la admite (la paila no lleva
 * baqueta) se usa la de ese tambor, nunca una invÃƒÂ¡lida.
 */
export function voiceSpec(id, pitchRatio = 1, articulation = null) {
  const skin = MEMBRANE[id];
  if (!skin) return [];

  const allowed = articulationsFor(id);
  const chosen = articulation && allowed.includes(articulation) ? articulation : defaultArticulationFor(id);
  const artic = ARTIC[chosen] ?? ARTIC[defaultArticulationFor(id)] ?? ARTIC.laurel;

  const layers = [];
  layers.push(scaleNoise(skin, artic.attack, pitchRatio, artic));
  if (skin.body) layers.push(scaleOsc(skin, skin.body, pitchRatio, artic));
  if (skin.ring) layers.push(scaleOsc(skin, skin.ring, pitchRatio, artic));
  if (skin.sub) layers.push(scaleOsc(skin, skin.sub, pitchRatio, artic));
  if (skin.air) layers.push(scaleNoise(skin, skin.air, pitchRatio, artic));

  return layers;
}

/** Etiqueta legible de la articulaciÃƒÂ³n, para la interfaz y el curso. */
export function articulationLabel(id, articulation = null) {
  const artic = articulation ?? defaultArticulationFor(id);
  return ARTIC[artic]?.label ?? null;
}
