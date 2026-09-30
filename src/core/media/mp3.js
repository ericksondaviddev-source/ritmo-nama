/**
 * Exportar a MP3.
 *
 * El motor renderiza la composición en un OfflineAudioContext (barato e
 * instantáneo, a diferencia de grabar el WAV en directo), y aquí ese búfer se
 * codifica a MP3 con lamejs. Por eso un MP3 de 5 minutos sale en segundos.
 *
 * lamejs entra en diferido (unos 250 KB) y sólo se descarga cuando alguien
 * pulsa "Descargar MP3": quien sólo va a escuchar la demo no lo paga.
 */
import { renderExport } from './render.js';

const TASA_MUESTRAS = 44100;
const CANALES = 2;
const BITRATE = 128;

let encoderPromise = null;

async function cargarLame() {
  if (!encoderPromise) {
    encoderPromise = (async () => {
      const mod = await import('@breezystack/lamejs');
      return mod.default ?? mod;
    })();
  }
  return encoderPromise;
}

const aInt16 = (float) => {
  const s = float < 0 ? float * 0x8000 : float * 0x7fff;
  return s < -0x8000 ? -0x8000 : s > 0x7fff ? 0x7fff : s | 0;
};

/** Búfer de audio -> Blob MP3. */
export async function aMp3(audioBuffer, { bitrate = BITRATE } = {}) {
  const lame = await cargarLame();
  const numCanales = Math.min(CANALES, audioBuffer.numberOfChannels);
  const codificador = new lame.Mp3Encoder(numCanales, audioBuffer.sampleRate, bitrate);

  const izq = audioBuffer.getChannelData(0);
  const der = numCanales > 1 ? audioBuffer.getChannelData(1) : izq;

  const bloque = 1152; // tamaño que espera lamejs
  const partes = [];
  const izquierda = new Int16Array(bloque);
  const derecha = new Int16Array(bloque);

  for (let i = 0; i < izq.length; i += bloque) {
    const n = Math.min(bloque, izq.length - i);
    for (let k = 0; k < n; k++) {
      izquierda[k] = aInt16(izq[i + k]);
      derecha[k] = aInt16(der[i + k]);
    }
    const trozo = numCanales > 1
      ? codificador.encodeBuffer(izquierda.subarray(0, n), derecha.subarray(0, n))
      : codificador.encodeBuffer(izquierda.subarray(0, n));
    if (trozo.length) partes.push(new Int8Array(trozo));
  }
  const fin = codificador.flush();
  if (fin.length) partes.push(new Int8Array(fin));

  return new Blob(partes, { type: 'audio/mpeg' });
}

/**
 * Renderiza la composición y la devuelve como MP3. Es instantáneo aunque la
 * pista sea larga, porque el render es offline.
 */
export async function exportarMp3(
  composicion,
  { ciclos = 8, duracionSeg = null, voz = null, bitrate = BITRATE, engine, getContext, alProgresar = null } = {}
) {
  if (!composicion) return null;
  if (!engine) throw new Error('exportarMp3 necesita el motor de audio: sin él el render sale en silencio.');
  // El render se lleva casi todo el tiempo (a 300 s son ~7 min contra ~30 s de
  // codificado), así que el progreso que se ve es el del render: el bucle de
  // codificación se declara como terminado al empezar.
  const buffer = await renderExport(composicion, {
    ciclos,
    duracionSeg,
    voiceBuffer: voz,
    muestra: TASA_MUESTRAS,
    engine,
    getContext,
    alProgresar: (f) => alProgresar?.(f * 0.9)
  });
  if (!buffer) return null;
  alProgresar?.(0.92);
  const blob = await aMp3(buffer, { bitrate });
  alProgresar?.(1);
  return { blob, buffer };
}
