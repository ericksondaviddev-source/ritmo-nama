/**
 * Render offline de la composición a un AudioBuffer.
 *
 * No graba en tiempo real: renderiza en un OfflineAudioContext, así que una
 * pista corta sale en un segundo. Es lo que usan tanto el WAV como el MP3, y por
 * eso son mucho más rápidos que el vídeo, que sí se graba en directo.
 *
 * POR QUÉ SE RENDERIZA POR BLOQUES
 *
 * La primera versión pintaba la pista entera en un solo OfflineAudioContext y
 * el coste crecía de forma brutalmente superlineal. Medido con el motor real
 * (preset guaireño, 124 BPM):
 *
 *     10 s ->   4,7 s de render
 *     20 s ->  12,5 s
 *     30 s ->  30,7 s
 *     60 s -> 123,8 s
 *
 * Duplicar el audio multiplicaba el trabajo por ~2,5, así que los 5 minutos del
 * selector hubiesen tardado horas. El motivo es que cada golpe añade nodos al
 * grafo (osciladores, fuentes de ruido, filtros, paneo) y OfflineAudioContext
 * acaba evaluando el grafo entero muchísimas veces.
 *
 * Renderizando bloques cortos y concatenando, cada bloque tiene un grafo
 * acotado y el coste total es lineal con la duración. Se pierde la cola de la
 * reverberación en la costura, así que cada bloque va precedido de un pequeño
 * margen que se descarta: los golpes que caen en ese margen suenan igual y
 * cubren la reverb del bloque anterior.
 */
import { stepDurationSec, swingOffsetSec } from '../audio/timing.js';

/**
 * Margen de solape entre bloques, para no cortar la cola de la reverb.
 * Tiene que ser mayor que la cola audible del impulso (1,6 s) con holgura.
 */
const SOLAPE_SEG = 2.5;

/**
 * Duración de audio que se renderiza de una vez.
 *
 * El coste por bloque es aproximadamente proporcional a (segundos × golpes),
 * porque cada bloque vuelve a construir el grafo del master y a pagar la
 * convolución sobre todo su contenido. Se eligió 20 s tras medir en Chrome con
 * el motor real: es el punto en el que un bloque de 5 minutos completo sale en
 * un tiempo razonable sin que la costura sea audible.
 */
const BLOQUE_SEG = 20;

const Offline = () =>
  globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext ?? null;

/**
 * Programa en `offline` los golpes que caen en [desde, hasta). Los tiempos se
 * escriben relativos al bloque: el contexto empieza en su 0, así que un golpe
 * global de 40 s va en 40 - desde.
 */
function agendar({ offline, engine }, comp, { solo, desde, hasta, paso }) {
  // El primer golpe de la pista está en 0.05 s.
  const primerCiclo = Math.max(0, Math.floor((desde - 0.05) / (12 * paso)));
  for (let ciclo = primerCiclo; ; ciclo++) {
    const base = 0.05 + ciclo * 12 * paso;
    if (base >= hasta) break;
    for (let step = 0; step < 12; step++) {
      const global = base + step * paso + swingOffsetSec(comp.bpm, comp.swing, step);
      if (global < desde || global >= hasta) continue;
      const t = global - desde;
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
}

export async function renderExport(
  composicion,
  {
    ciclos = 2,
    duracionSeg = null,
    voiceBuffer = null,
    muestra = 44100,
    engine = null,
    getContext = null,
    alProgresar = null
  } = {}
) {
  if (!composicion) return null;
  // Sin motor no se agenda nada y el resultado sería un fichero de silencio:
  // mejor fallar aquí que descargar un MP3 mudo.
  if (!engine) throw new Error('renderExport necesita el motor de audio.');
  const OfflineCtx = Offline();
  if (!OfflineCtx) return null;

  const comp = composicion.snapshot();
  const solo = comp.stemIds.some((id) => comp.mixer[id]?.solo);
  const paso = stepDurationSec(comp.bpm);
  // Se puede pedir por duración (lo que entiende el selector) o por ciclos. La
  // duración manda si viene: un número fijo de ciclos daba ~30 s a 124 BPM,
  // muy lejos de los 5 minutos que promete el botón.
  const repeticiones = Number.isFinite(duracionSeg)
    ? Math.max(1, Math.ceil(duracionSeg / (12 * paso)))
    : ciclos;
  const duracionPista = repeticiones * 12 * paso;
  const duracionTotal = duracionPista + (voiceBuffer ? voiceBuffer.duration : 0) + 0.5;

  // Una sola pasada si es corto: partirlo en bloques sólo añade pegado.
  if (duracionPista <= BLOQUE_SEG + SOLAPE_SEG) {
    const offline = new OfflineCtx(2, Math.ceil(duracionTotal * muestra), muestra);
    agendar({ offline, engine }, comp, {
      solo,
      desde: 0,
      hasta: duracionPista,
      paso
    });
    if (voiceBuffer) {
      const src = offline.createBufferSource();
      src.buffer = voiceBuffer;
      src.connect(offline.destination);
      src.start(0.05);
    }
    alProgresar?.(1);
    return offline.startRendering();
  }

  // Pista larga: bloques solapados, cada uno con un grafo acotado.
  const piezas = [];
  const largo = Math.ceil(duracionTotal * muestra);
  for (let desde = 0; desde < duracionPista; desde += BLOQUE_SEG) {
    const hasta = Math.min(duracionPista, desde + BLOQUE_SEG + SOLAPE_SEG);
    const ultimoBloque = desde + BLOQUE_SEG >= duracionPista;
    const muestras = Math.ceil((hasta - desde + (voiceBuffer ? voiceBuffer.duration : 0) + 0.5) * muestra);
    const offline = new OfflineCtx(2, Math.max(muestras, 1), muestra);
    agendar({ offline, engine }, comp, { solo, desde, hasta, paso });
    piezas.push({ buffer: await offline.startRendering(), desde, ultimoBloque });
    alProgresar?.(Math.min(1, (desde + BLOQUE_SEG) / duracionPista));
  }

  // Cada bloque aporta sólo su tramo propio (`BLOQUE_SEG`); el resto es la cola
  // de reverb, que ya entra con el bloque siguiente. Pegarla también duplicaría
  // la cola en cada costura y se oiría un eco en cada empalme. El último bloque
  // sí aporta su cola entera: no hay nadie detrás que la cubra.
  const destino = new OfflineCtx(2, Math.max(largo, 1), muestra);
  const out = destino.createBuffer(2, largo, muestra);
  for (const { buffer, desde, ultimoBloque } of piezas) {
    const inicio = Math.floor(desde * muestra);
    const fin = ultimoBloque ? buffer.length : Math.floor(BLOQUE_SEG * muestra);
    const propio = Math.max(0, Math.min(fin, buffer.length, largo - inicio));
    if (propio <= 0) continue;
    for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c++) {
      out.getChannelData(c).set(buffer.getChannelData(c).subarray(0, propio), inicio);
    }
  }

  if (voiceBuffer) {
    const total = voiceBuffer.length;
    for (let c = 0; c < Math.min(2, voiceBuffer.numberOfChannels); c++) {
      out.getChannelData(c).set(voiceBuffer.getChannelData(c).subarray(0, total), 0);
    }
  }

  alProgresar?.(1);
  return out;
}
