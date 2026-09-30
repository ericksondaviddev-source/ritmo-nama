/**
 * Soft clip: la red de seguridad que garantiza que la salida nunca pase de 1.
 *
 * El DynamicsCompressor va por delante y trabaja "en la media", pero en un golpe
 * de cuatro tambores a la vez con acento puede pasarse: se midió un pico de
 * 1,44. Comprimir no es un tope. Esta curva se aplica después, así que el
 * resultado nunca se recorta digitalmente: lo que pasaría de 1 se aplana con
 * una tangente hiperbólica, que suena como un compresor y no como un corte.
 *
 * Es una función pura, sin Web Audio, para poder comprobarla en los tests.
 */

/**
 * Curva para un WaveShaperNode: entrada -1..1, salida siempre dentro de -1..1.
 *
 * Con una tangente normalizada a 1 el cuerpo del golpe salía MÁS alto que la
 * entrada (0,5 -> 0,67), y un compresor jamás puede subir el nivel. Por eso hay
 * una zona lineal: por debajo de la rodilla la señal pasa intacta, y sólo a
 * partir de ahí se comprime. Así es transparente en el uso normal y sólo actúa
 * cuando de verdad hay pico.
 */
export function curvaSoftClip(n = 2048, limite = 1, rodilla = 0.6) {
  const curva = new Float32Array(n);
  const k = Math.max(0, Math.min(0.95, rodilla));
  const resto = 1 - k;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1; // -1 .. 1
    const a = Math.abs(x);
    const salida = a <= k ? a : k + resto * Math.tanh((a - k) / resto);
    curva[i] = limite * Math.sign(x || 1) * salida;
  }
  return curva;
}

/** Aplica la curva. Devuelve false si el contexto no tiene WaveShaper. */
export function conectarSoftClip(ctx, destino, { limite = 1 } = {}) {
  if (typeof ctx.createWaveShaper !== 'function') return false;
  const shaper = ctx.createWaveShaper();
  shaper.curve = curvaSoftClip(2048, limite);
  shaper.oversample = '4x'; // reduce la distorsión del propio recorte
  shaper.connect(destino);
  return true;
}
