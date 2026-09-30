/**
 * Render offline de la composición a un AudioBuffer.
 *
 * No graba en tiempo real: renderiza en un OfflineAudioContext, así que una
 * pista de 5 minutos sale en un segundo. Es lo que usan tanto el WAV como el
 * MP3, y por eso las dos descargas son instantáneas mientras que el vídeo, que
 * sí se graba en directo, tarda lo que dure la pista.
 */
import { stepDurationSec, swingOffsetSec } from '../audio/timing.js';

export async function renderExport(
  composicion,
  { ciclos = 2, voiceBuffer = null, muestra = 44100, engine = null, getContext = null } = {}
) {
  if (!composicion) return null;
  // Sin motor no se agenda nada y el resultado sería un fichero de silencio:
  // mejor fallar aquí que descargar un MP3 mudo.
  if (!engine) throw new Error('renderExport necesita el motor de audio.');
  const comp = composicion.snapshot();
  const solo = comp.stemIds.some((id) => comp.mixer[id]?.solo);
  const paso = stepDurationSec(comp.bpm);
  const base = ciclos * 12 * paso;
  const duracion = base + (voiceBuffer ? voiceBuffer.duration : 0) + 0.5;

  const Offline = globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext;
  if (!Offline) return null;
  const offline = new Offline(2, Math.ceil(duracion * muestra), muestra);

  for (let ciclo = 0; ciclo < ciclos; ciclo++) {
    for (let step = 0; step < 12; step++) {
      const t = 0.05 + ciclo * 12 * paso + step * paso + swingOffsetSec(comp.bpm, comp.swing, step);
      for (const id of comp.stemIds) {
        const celda = comp.steps[id]?.[step];
        if (!celda) continue;
        const m = comp.mixer[id];
        if (!m || m.mute) continue;
        if (solo && !m.solo) continue;
        engine.trigger(id, {
          time: t,
          accent: celda === 2,
          volume: m.volume,
          pan: m.pan,
          pitchShift: m.tuning,
          articulation: comp.articulation[id],
          context: offline
        });
      }
    }
  }

  if (voiceBuffer) {
    const src = offline.createBufferSource();
    src.buffer = voiceBuffer;
    src.connect(offline.destination);
    src.start(0.05);
  }

  return offline.startRendering();
}
