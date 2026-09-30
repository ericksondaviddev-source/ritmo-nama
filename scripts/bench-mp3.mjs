/**
 * Cuánto cuesta realmente codificar a MP3 con lamejs.
 *
 * lamejs es JS puro, así que el coste crece con los minutos de audio. Este
 * script mide el tiempo por minuto para decidir con números cuál es un tope
 * razonable en vez de adivinar. Se ejecuta a mano, no forma parte del build.
 *
 *   node scripts/bench-mp3.mjs
 */
import lamejs from '@breezystack/lamejs';

const TASA = 44100;

function ruido(segundos) {
  const n = Math.round(segundos * TASA);
  const izq = new Float32Array(n);
  const der = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    izq[i] = Math.sin(i * 0.05) * 0.4 + Math.sin(i * 0.011) * 0.3;
    der[i] = Math.sin(i * 0.047) * 0.4 + Math.sin(i * 0.013) * 0.3;
  }
  return { izq, der };
}

function codificar(izq, der) {
  const enc = new lamejs.Mp3Encoder(2, TASA, 128);
  const bloque = 1152;
  const partes = [];
  const a = new Int16Array(bloque);
  const b = new Int16Array(bloque);
  const conv = (f) => {
    const s = f < 0 ? f * 0x8000 : f * 0x7fff;
    return s < -0x8000 ? -0x8000 : s > 0x7fff ? 0x7fff : s | 0;
  };
  for (let i = 0; i < izq.length; i += bloque) {
    const n = Math.min(bloque, izq.length - i);
    for (let k = 0; k < n; k++) {
      a[k] = conv(izq[i + k]);
      b[k] = conv(der[i + k]);
    }
    const t = enc.encodeBuffer(a.subarray(0, n), b.subarray(0, n));
    if (t.length) partes.push(t);
  }
  const fin = enc.flush();
  if (fin.length) partes.push(fin);
  return partes.reduce((s, p) => s + p.length, 0);
}

console.log('segundos\tkB MP3\tms reales\tveces mas rapido que en vivo');
for (const seg of [15, 30, 60, 120, 300]) {
  const { izq, der } = ruido(seg);
  const t0 = performance.now();
  const bytes = codificar(izq, der);
  const ms = performance.now() - t0;
  console.log(
    `${seg}\t${Math.round(bytes / 1024)}\t${Math.round(ms)}\t${(seg * 1000 / ms).toFixed(2)}x`
  );
}
