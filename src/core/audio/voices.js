// Síntesis en capas v2: cada golpe = ataque (ruido filtrado) + cuerpo (osc con caída)
// + ring (resonancia breve) + aire (resonancia del cuerpo). La paila se toca con las
// manos: slap de palma, no baquetas.
export function voiceSpec(id, pitchRatio = 1) {
  const p = pitchRatio;
  switch (id) {
    case 'prima':
      // Tambor agudo guía: slap brillante, cuerpo definido, ring de membrana
      return [
        { kind: 'noise', duration: 0.035, filter: { type: 'bandpass', freq: 2600 * p, q: 4 }, gain: 0.85, decay: 0.035 },
        { kind: 'osc', type: 'sine', from: 380 * p, to: 210 * p, glide: 0.08, gain: 0.9, decay: 0.22, stop: 0.24 },
        { kind: 'osc', type: 'triangle', from: 1150 * p, to: 900 * p, glide: 0.06, gain: 0.18, decay: 0.12, stop: 0.14 },
        { kind: 'noise', duration: 0.08, filter: { type: 'lowpass', freq: 900 * p }, gain: 0.15, decay: 0.08 }
      ];
    case 'cruzao':
      // Tambor mediano que conversa: slap medio, cuerpo cálido
      return [
        { kind: 'noise', duration: 0.045, filter: { type: 'bandpass', freq: 1500 * p, q: 3 }, gain: 0.7, decay: 0.045 },
        { kind: 'osc', type: 'triangle', from: 240 * p, to: 120 * p, glide: 0.1, gain: 0.95, decay: 0.3, stop: 0.32 },
        { kind: 'osc', type: 'sine', from: 720 * p, to: 660 * p, glide: 0.05, gain: 0.15, decay: 0.15, stop: 0.17 },
        { kind: 'noise', duration: 0.1, filter: { type: 'lowpass', freq: 700 * p }, gain: 0.2, decay: 0.1 }
      ];
    case 'pujao':
      // Tambor grave: palma completa, cuerpo profundo y largo, sub-armónico
      return [
        { kind: 'noise', duration: 0.08, filter: { type: 'lowpass', freq: 500 * p }, gain: 0.5, decay: 0.08 },
        { kind: 'osc', type: 'sine', from: 110 * p, to: 48 * p, glide: 0.16, gain: 1.1, decay: 0.55, stop: 0.6 },
        { kind: 'osc', type: 'sine', from: 55 * p, to: 40 * p, glide: 0.12, gain: 0.5, decay: 0.4, stop: 0.44 },
        { kind: 'osc', type: 'triangle', from: 260 * p, to: 200 * p, glide: 0.08, gain: 0.12, decay: 0.2, stop: 0.22 }
      ];
    case 'paila':
      // Se toca con las manos: slap de palma con cuerpo hueco y grave
      return [
        { kind: 'noise', duration: 0.05, filter: { type: 'bandpass', freq: 1900 * p, q: 2.5 }, gain: 0.9, decay: 0.05 },
        { kind: 'noise', duration: 0.09, filter: { type: 'lowpass', freq: 800 * p }, gain: 0.45, decay: 0.09 },
        { kind: 'osc', type: 'sine', from: 260 * p, to: 130 * p, glide: 0.09, gain: 0.7, decay: 0.2, stop: 0.22 },
        { kind: 'osc', type: 'triangle', from: 900 * p, to: 700 * p, glide: 0.05, gain: 0.12, decay: 0.1, stop: 0.12 }
      ];
    case 'maracas':
      // Doble sacudida: semilla contra la pared en dos ráfagas cortas
      return [
        { kind: 'noise', duration: 0.05, filter: { type: 'bandpass', freq: 6000 * p, q: 1 }, gain: 0.5, decay: 0.05 },
        { kind: 'noise', duration: 0.045, at: 0.018, filter: { type: 'bandpass', freq: 7200 * p, q: 1 }, gain: 0.35, decay: 0.045 }
      ];
    case 'cuatro':
      // Cordófono pulsado: nota con armónica, ataque de uña y resonancia del cuerpo
      return [
        { kind: 'noise', duration: 0.02, filter: { type: 'highpass', freq: 2500 * p }, gain: 0.2, decay: 0.02 },
        { kind: 'osc', type: 'triangle', from: 294 * p, to: 294 * p, glide: 0, gain: 0.55, decay: 0.35, stop: 0.38 },
        { kind: 'osc', type: 'sine', from: 588 * p, to: 588 * p, glide: 0, gain: 0.15, decay: 0.18, stop: 0.2 },
        { kind: 'noise', duration: 0.12, filter: { type: 'lowpass', freq: 500 * p }, gain: 0.1, decay: 0.12 }
      ];
    default:
      return [];
  }
}
