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

  const fuenteVideo = new CanvasSource(lienzo, {
    codec: eleccion.codec,
    quality: new Quality('high'),
    keyFrameInterval: 2
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

  // Audio: intentamos leer muestras; si la API no las expone, seguimos sin audio.
  let audioIter = null;
  if (pistaAudio && typeof pistaAudio.samples === 'function') {
    try {
      audioIter = pistaAudio.samples();
    } catch {
      audioIter = null;
    }
  }

  let ultimoCede = performance.now();

  for (let i = 0; i < total; i++) {
    const t = i / FPS;

    // Vídeo
    const lienzoFrame = await sink.getCanvas(t);
    dibujarFotograma(ctx, {
      fotograma: lienzoFrame ? (lienzoFrame.canvas ?? lienzoFrame) : null,
      plantilla,
      nombre,
      formato
    });
    await fuenteVideo.add(t, 1 / FPS);

    // Audio: leemos el siguiente bloque de muestras (cada 1/FPS segundos)
    if (fuenteAudio && audioIter) {
      const dur = 1 / FPS;
      for await (const muestra of audioIter) {
        if (muestra.timestamp >= t + dur) break;
        if (muestra.timestamp >= t) {
          await fuenteAudio.add(muestra);
        }
      }
    }

    alProgresar?.((i + 1) / total);

    if (performance.now() - ultimoCede > 40) {
      await ceder();
      ultimoCede = performance.now();
    }
  }

  await fuenteVideo.close();
  if (fuenteAudio) await fuenteAudio.close();
  await salida.finalize();

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