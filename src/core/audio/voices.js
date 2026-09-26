export const PAILA_PARTIALS = [840, 1420, 2650, 4100];

export function voiceSpec(id, pitchRatio = 1) {
  const p = pitchRatio;
  switch (id) {
    case 'pujao':
      return [
        { kind: 'osc', type: 'sine', from: 130 * p, to: 48 * p, glide: 0.18, gain: 1.0, decay: 0.45, stop: 0.48 },
        { kind: 'noise', duration: 0.05, filter: { type: 'lowpass', freq: 600 * p }, gain: 0.4, decay: 0.06 }
      ];
    case 'cruzao':
      return [
        { kind: 'osc', type: 'triangle', from: 220 * p, to: 110 * p, glide: 0.12, gain: 0.9, decay: 0.28, stop: 0.3 },
        { kind: 'noise', duration: 0.04, filter: { type: 'bandpass', freq: 1200 * p, q: 3 }, gain: 0.5, decay: 0.04 }
      ];
    case 'prima':
      return [
        { kind: 'osc', type: 'sine', from: 380 * p, to: 210 * p, glide: 0.08, gain: 0.85, decay: 0.18, stop: 0.2 },
        { kind: 'noise', duration: 0.03, filter: { type: 'bandpass', freq: 2400 * p, q: 4 }, gain: 0.7, decay: 0.03 }
      ];
    case 'paila':
      return [
        ...PAILA_PARTIALS.map((freq, i) => ({
          kind: 'osc',
          type: i % 2 === 0 ? 'sine' : 'square',
          from: freq * p,
          to: freq * p,
          glide: 0,
          gain: 0.3 / (i + 1),
          decay: 0.03 + i * 0.015,
          stop: 0.04 + i * 0.015
        })),
        { kind: 'noise', duration: 0.02, filter: { type: 'highpass', freq: 3200 * p }, gain: 0.8, decay: 0.025 }
      ];
    case 'maracas':
      return [
        { kind: 'noise', duration: 0.06, filter: { type: 'bandpass', freq: 6500 * p, q: 1.2 }, gain: 0.55, decay: 0.06 }
      ];
    case 'cuatro':
      return [
        { kind: 'osc', type: 'triangle', from: 294 * p, to: 294 * p, glide: 0, gain: 0.6, decay: 0.3, stop: 0.32 },
        { kind: 'noise', duration: 0.03, filter: { type: 'highpass', freq: 1800 * p }, gain: 0.3, decay: 0.04 }
      ];
    default:
      return [];
  }
}
