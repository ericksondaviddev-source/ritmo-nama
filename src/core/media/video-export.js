/**
 * Exportar un clip con la marca y el nombre.
 *
 * Todo ocurre en el navegador: el vídeo se decodifica fotograma a fotograma, se
 * dibuja con la plantilla encima en un lienzo, se codifica y se muxea. No se
 * sube nada a ningún servidor, así que el vídeo de una persona no sale de su
 * móvil.
 *
 * LA PREVISUALIZACIÓN NO ES UN RENDER
 *
 * Antes de exportar hay una previsualización en vivo, que es un `<video>` normal
 * con un lienzo encima: instantánea y gratis. El render de aquí sólo se lanza al
 * pulsar descargar, porque codificar 10 segundos puede tardar entre 10 y 40
 * segundos según el teléfono.
 *
 * EL AUDIO SE RE-CODIFICA (AAC)
 *
 * No copiamos los paquetes originales porque la API de mediabunny no expone
 * `packets()` en `InputAudioTrack`. Re-codificar AAC es barato (10-30s tardan
 * milisegundos) y evita dolores de cabeza con codecs. La calidad "high" da
 * 128-192 kbps, más que suficiente para voz y tambores.
 *
 * EL HILO SE CEDE
 *
 * Se devuelve el control al navegador cada ~40 ms. Sin eso, la interfaz se
 * congela durante segundos y el visitante cree que la página se ha colgado:
 * es justo lo contrario de "puedes seguir mirando".
 */
import { dibujarFotograma } from './dibujar.js';

const FPS = 30;

let modPromise = null;
function cargarMediabunny() {
  if (!modPromise) modPromise = import('mediabunny');
  return modPromise;
}

export function puedeExportar() {
  return typeof globalThis.VideoEncoder === 'function' && typeof globalThis.VideoDecoder === 'function';
}

export async function elegirFormato() {
  if (!puedeExportar()) return null;
  const mb = await cargarMediabunny();
  for (const [codec, etiqueta, ext] of [
    ['avc', 'MP4', 'mp4'],
    ['vp9', 'WebM', 'webm'],
    ['vp8', 'WebM', 'webm']
  ]) {
    try {
      if (await mb.canEncodeVideo(codec, new mb.Quality('high'))) return { codec, etiqueta, ext };
    } catch {}
  }
  return null;
}

export async function exportarClip({ blob, plantilla, nombre, formato, alProgresar }) {
  const eleccion = await elegirFormato();
  if (!eleccion) {
    throw new Error('Este navegador no sabe exportar vídeo. Prueba con Chrome o con Safari actualizado.');
  }
  const mb = await cargarMediabunny();
  const {
    Input, BlobSource, Output, Mp4OutputFormat, WebMOutputFormat, BufferTarget,
    CanvasSource, AudioSampleSource, Quality, ALL_FORMATS
  } = mb;

  const entrada = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const pistaVideo = await entrada.getPrimaryVideoTrack();
  if (!pistaVideo) throw new Error('Ese fichero no tiene vídeo.');

  const salida = new Output({
    format: eleccion.ext === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target: new BufferTarget()
  });

  const lienzo = crearLienzoDeSalida(formato.ancho, formato.alto);
  const ctx = lienzo.getContext('2d');

  // Bitrate según la resolución: 3 Mbps rinden para 720 (y el archivo queda
  // ligerito para descargar, ~5,5 MB por 15 s); 5 para 1080. `prefer-hardware`
  // le pide al navegador usar el codificador de vídeo de la gráfica si existe —
  // en portátiles eso pasa la codificación de "minutos" a "segundos"; sin
  // gráfica dedicada se cae solo al software.
  const bitrate = Math.max(formato.ancho, formato.alto) >= 1920 ? 5_000_000 : 3_000_000;
  const fuenteVideo = new CanvasSource(lienzo, {
    codec: eleccion.codec,
    quality: new Quality({ bitrate }),
    keyFrameInterval: 2,
    hardwareAcceleration: 'prefer-hardware'
  });
  salida.addVideoTrack(fuenteVideo, { frameRate: FPS });

  // Audio: decodificamos las muestras del original y las re-codificamos a AAC.
  let pistaAudio = await entrada.getPrimaryAudioTrack();
  const fuenteAudio = pistaAudio
    ? new AudioSampleSource({ codec: 'aac', quality: new Quality('high') })
    : null;
  if (fuenteAudio) salida.addAudioTrack(fuenteAudio);

  await salida.start();

  const duracion = await pistaVideo.computeDuration();
  const total = Math.max(1, Math.round(duracion * FPS));

  const sink = new (await import('mediabunny')).CanvasSink(
    pistaVideo,
    { poolSize: 2, fit: 'fill' }
  );

  // Fotogramas en orden secuencial. `canvases()` decodifica cada paquete una
  // sola vez (y precarga un par por delante); la alternativa, `getCanvas(t)`
  // fotograma a fotograma, re-buscaba desde el keyframe anterior en CADA
  // llamada y una codificación de 15 s tardaba casi 5 minutos en vez de
  // media docena de segundos.
  const iterFotogramas = sink.canvases(0, duracion);
  let proximo = iterFotogramas.next();

  // Audio: intentamos leer muestras; si la API no las expone, seguimos sin audio.
  let audioIter = null;
  if (pistaAudio && typeof pistaAudio.samples === 'function') {
    try {
      audioIter = pistaAudio.samples();
    } catch {
      audioIter = null;
    }
  }

  // Entrega de audio con "peek": la muestra que se lee se guarda y se emite en
  // el fotograma que le toca. Antes cada fotograma hacía `for await` + `break`:
  // `break` invoca `return()` del iterador (o tira la muestra frontera), así
  // que el audio se cortaba o se perdía en el primer fotograma.
  let pendiente = null;
  async function entregarAudio(hasta) {
    while (fuenteAudio && audioIter) {
      if (!pendiente) {
        const r = await audioIter.next();
        if (r.done) {
          audioIter = null;
          return;
        }
        pendiente = r.value;
      }
      if (pendiente.timestamp >= hasta) return;
      await fuenteAudio.add(pendiente);
      pendiente = null;
    }
  }

  let ultimoCede = performance.now();
  let ultimoFotograma = null;
  const depurar = globalThis.__RITMO_EXPORT_DEBUG === 1;
  const tInicio = depurar ? performance.now() : 0;
  if (depurar) console.log(`[export-debug] frames=${total} ${formato.ancho}×${formato.alto} codec=${eleccion.codec} bitrate=${bitrate}`);
  let msIter = 0;
  let msAdd = 0;
  let msDraw = 0;
  let msAudio = 0;
  // Depuración en vivo: `window.__exportDebug()` devuelve el estado del bucle.
  const dbg = { i: 0, iter: 0, draw: 0, add: 0, audio: 0 };
  if (depurar) globalThis.__exportDebug = dbg;

  for (let i = 0; i < total; i++) {
    const t = i / FPS;

    // Vídeo: siguiente fotograma del iterador; si la grabación trae menos
    // fotogramas que los esperados, se sostiene el último (como hacía
    // getCanvas con "el último ≤ t").
    if (depurar) dbg.fase = 'iter';
    let marca = depurar ? performance.now() : 0;
    const r = await proximo;
    if (depurar) msIter += performance.now() - marca;
    if (!r.done) {
      ultimoFotograma = r.value;
      proximo = iterFotogramas.next();
    }    if (depurar) dbg.fase = 'draw';
    marca = depurar ? performance.now() : 0;
    dibujarFotograma(ctx, {
      fotograma: ultimoFotograma ? (ultimoFotograma.canvas ?? ultimoFotograma) : null,
      plantilla,
      nombre,
      formato
    });
    if (depurar) msDraw += performance.now() - marca;
    if (depurar) dbg.fase = 'add';
    marca = depurar ? performance.now() : 0;
    await fuenteVideo.add(t, 1 / FPS);
    if (depurar) msAdd += performance.now() - marca;

    // Audio: muestras con timestamp < t + 1/FPS (las del tramo de este frame)
    if (depurar) dbg.fase = 'audio';
    marca = depurar ? performance.now() : 0;
    if (fuenteAudio && audioIter) await entregarAudio(t + 1 / FPS);
    if (depurar) msAudio += performance.now() - marca;
    if (depurar) dbg.fase = 'libre';

    if (depurar && (i + 1) % 60 === 0) {
      console.log(`[export-debug] ${i + 1}/${total} iter=${msIter | 0}ms draw=${msDraw | 0}ms add=${msAdd | 0}ms audio=${msAudio | 0}ms`);
    }

    if (depurar) {
      dbg.i = i + 1;
      dbg.iter = msIter | 0;
      dbg.draw = msDraw | 0;
      dbg.add = msAdd | 0;
      dbg.audio = msAudio | 0;
    }
    alProgresar?.((i + 1) / total);

    if (performance.now() - ultimoCede > 40) {
      await ceder();
      ultimoCede = performance.now();
    }
  }

  // Cierra el iterador si quedaron fotogramas sin leer (libera el decoder).
  try {
    await iterFotogramas?.return?.();
  } catch {
    /* ya estaba cerrado */
  }

  await fuenteVideo.close();
  if (fuenteAudio) await fuenteAudio.close();
  await salida.finalize();
  if (depurar) console.log(`[export-debug] TOTAL ${(performance.now() - tInicio) | 0} ms`);

  return {
    blob: new Blob([salida.target.buffer], {
      type: eleccion.ext === 'mp4' ? 'video/mp4' : 'video/webm'
    }),
    nombre: nombreArchivo(nombre, eleccion.ext)
  };
}

function crearLienzoDeSalida(ancho, alto) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(ancho, alto);
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  return c;
}

function ceder() {
  return new Promise((r) => setTimeout(r, 0));
}

export function nombreArchivo(nombre, ext) {
  const limpio = (nombre ?? '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .slice(0, 40);
  return `ritmo-nama-${limpio || 'clip'}.${ext}`;
}