const CACHE = new WeakMap();

export const NOISE_SECONDS = 1;

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

export function noiseOffset(ctx) {
  void ctx;
  const usableSeconds = Math.max(0, NOISE_SECONDS - 0.25);
  return Math.random() * usableSeconds;
}
