const CACHE = new WeakMap();
const IMPULSE_CACHE = new WeakMap();

export const NOISE_SECONDS = 1;
export const REVERB_SECONDS = 1.6;

export function getNoiseBuffer(ctx) {
  let buffer = CACHE.get(ctx);
  if (!buffer) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS));
    buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    CACHE.set(ctx, buffer);
  }
  return buffer;
}

// Impulso de reverb procedural: ruido estéreo con decaimiento exponencial suavizado
export function getReverbImpulse(ctx) {
  let buffer = IMPULSE_CACHE.get(ctx);
  if (!buffer) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * REVERB_SECONDS));
    buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * Math.pow(1 - i / length, 2.8);
      }
    }
    IMPULSE_CACHE.set(ctx, buffer);
  }
  return buffer;
}

export function noiseOffset(ctx) {
  void ctx;
  const usableSeconds = Math.max(0, NOISE_SECONDS - 0.25);
  return Math.random() * usableSeconds;
}
