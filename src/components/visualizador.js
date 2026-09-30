/**
 * Visualizador y descargas del estudio rítmico.
 *
 * Va dentro de la sección del Midipad, no en una sección aparte: así lo que se
 * ve es la misma composición que se está tocando, sin duplicar estado ni
 * obligar a aprender dos cosas distintas. Este módulo sólo pinta y descarga.
 */
import { ESTILOS, createVisualizer } from '../core/visualizer/index.js';
import { createGrabador, descargar, puedeGrabar, formatoSoportado } from '../core/media/grabador.js';
import { exportarMp3 } from '../core/media/mp3.js';
import { renderExport } from '../core/media/render.js';
import { encodeWav16 } from '../core/audio/wav.js';
import { DRUMS } from '../data/drums.js';
import { reclamarConAviso } from '../core/audio/transport.js';

const LIMITE_CORTO = 300; // 5 minutos
const LIMITE_ABIERTO = Infinity;

export function mountVisualizador(root, { engine, getContext, audio: composicion } = {}) {
  if (!root || !composicion) return null;

  const drums = DRUMS.map(({ id, name, color }) => ({ id, name, color }));
  const grabable = puedeGrabar();
  // formatoSoportado() devuelve el descriptor entero; aquí sólo su etiqueta.
  const formato = formatoSoportado()?.etiqueta ?? null;

  root.innerHTML = `
    <div class="mt-8 rounded-3xl glass p-4 sm:p-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-sm font-black uppercase tracking-wide text-zinc-300">Tu ritmo, en vivo</h3>
        <div class="flex items-center gap-2">
          <label class="sr-only" for="viz-estilo">Estilo del visualizador</label>
          <select
            id="viz-estilo"
            data-viz-estilo
            class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-200"
          >
            ${ESTILOS.map(
              (e, i) =>
                `<option value="${e.id}" ${i === 0 ? 'selected' : ''}>${e.nombre}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <p data-vz-desc class="mt-1 text-xs text-zinc-500">${ESTILOS[0].descripcion}</p>

      <div class="mt-4 overflow-hidden rounded-2xl bg-zinc-950">
        <canvas
          data-vz-canvas
          width="960"
          height="360"
          class="aspect-[8/3] w-full"
          aria-label="Visualizador de tu ritmo"
        ></canvas>
        <p data-vz-carga class="hidden py-10 text-center text-sm text-zinc-500">
          Cargando los tambores en 3D…
        </p>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-vz-mp3
          class="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400"
        >
          ⭳ Descargar MP3
        </button>
        <button
          type="button"
          data-vz-mp4
          class="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-bold text-amber-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          ${grabable ? '' : 'disabled'}
        >
          ${grabable ? `⏺ Grabar vídeo (${formato})` : '⏺ Grabar vídeo no disponible'}
        </button>
        <select
          data-vz-limite
          aria-label="Duración del vídeo"
          class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
        >
          <option value="${LIMITE_CORTO}">Hasta 5 minutos</option>
          <option value="libre">Sin límite</option>
        </select>
        <span data-vz-status role="status" aria-live="polite" class="text-xs text-zinc-500"></span>
      </div>
      <p class="mt-2 text-xs text-zinc-600">
        El MP3 se sintetiza en el móvil, así que tarda del orden de minuto y medio por cada
        minuto de audio (verás el %). El vídeo se graba en tiempo real: 5 minutos de vídeo
        tardan 5 minutos.
      </p>
    </div>`;

  const canvas = root.querySelector('[data-vz-canvas]');
  // Un solo atributo mal escrito tumbaba la sección entera con un null.addEventListener.
  // Ahora cada pieza es opcional y se avisa por consola, pero el resto vive.
  const estiloSel = root.querySelector('[data-viz-estilo]');
  const desc = root.querySelector('[data-vz-desc]');
  const status = root.querySelector('[data-vz-status]');
  const mp3Btn = root.querySelector('[data-vz-mp3]');
  const mp4Btn = root.querySelector('[data-vz-mp4]');
  const limiteSel = root.querySelector('[data-vz-limite]');
  const avisoCarga = root.querySelector('[data-vz-carga]');

  if (!canvas) {
    console.error('[visualizador] falta el lienzo: se aborta el montaje.');
    return null;
  }
  for (const [nombre, el] of Object.entries({ estiloSel, desc, status, mp3Btn, mp4Btn, limiteSel })) {
    if (!el) console.warn(`[visualizador] falta ${nombre}: esa parte queda desactivada.`);
  }

  const visualizador = createVisualizer({
    canvas,
    composicion,
    alTocarElRitmo: composicion.alTocarElRitmo,
    drums,
    getContext
  });
  if (!visualizador) return null;

  const avisar = (t) => {
    if (status) status.textContent = t;
  };
  const grabador = createGrabador({
    canvas,
    engine,
    getContext,
    limiteSeg: LIMITE_CORTO,
    alCambiarEstado: avisar
  });
  // Al entrar o salir del estilo 3D el elemento del lienzo se sustituye: el
  // grabador tiene que seguir al nuevo o se grabaría un lienzo en negro.
  visualizador.setAlCambiarLienzo?.((nuevo) => grabador.setLienzo(nuevo));

  // El visualizador pinta mientras suena; no puede sonar a la vez que la
  // grabación de vídeo, porque se oiría el doble.
  const transporte = reclamarConAviso({ stop: () => visualizador.stop() }, () => {
    avisar('Se paró el visualizador: entró otra grabación.');
  });

  estiloSel?.addEventListener('change', async () => {
    const def = ESTILOS.find((e) => e.id === estiloSel.value);
    desc.textContent = def?.descripcion ?? '';
    avisoCarga?.classList.toggle('hidden', !def?.necesitaWebGL);
    const ok = await visualizador.setEstilo(estiloSel.value);
    if (!ok) {
      desc.textContent = 'Ese estilo no se pudo cargar en este navegador.';
      estiloSel.value = visualizador.estilo;
      avisoCarga?.classList.add('hidden');
      return;
    }
    // Los modelos 3D siguen cargando en segundo plano: el aviso se queda hasta
    // que el estilo termine, para que el hueco vacío no parezca un fallo.
    if (def?.necesitaWebGL) esperarCarga();
  });

  // El visualizador expone `cargando`; se sondea hasta que termine. Si el
  // visitante cambia de estilo antes, el contador se cancela solo.
  let sondeo = 0;
  function esperarCarga() {
    clearInterval(sondeo);
    const idEstilo = estiloSel.value;
    sondeo = setInterval(() => {
      if (estiloSel.value !== idEstilo || !visualizador.cargando) {
        clearInterval(sondeo);
        avisoCarga?.classList.add('hidden');
      }
    }, 120);
  }

  // El visualizador sigue al transporte: cuando la composición empieza a
  // sonar, pinta; cuando se para, se limpia. Se suscribe al estado en vez de
  // parchear métodos, así que funciona igual llame quien llame a start/stop.
  const alEstado = composicion.subscribe((s) => {
    if (s.reproduciendo) {
      if (!visualizador.isRunning) visualizador.start();
    } else if (visualizador.isRunning) {
      visualizador.stop();
    }
  });
  // Si ya venía sonando (montaje en caliente), se pone al día.
  if (composicion.state.reproduciendo) visualizador.start();

  mp3Btn?.addEventListener('click', async () => {
    mp3Btn.disabled = true;
    const objetivo = duracionObjetivo();
    // El render no es instantáneo: va por bloques y tarda del orden de 1,4x la
    // duración (medido en Chrome con el motor real). Sin esto el botón parece
    // colgado durante minutos, y en un móvil, mucho más.
    const inicio = performance.now();
    status.textContent = `Renderizando MP3… 0 %`;
    try {
      const { blob, buffer } = await exportarMp3(composicion, {
        duracionSeg: objetivo,
        engine,
        getContext,
        alProgresar: (f) => {
          const pct = Math.round(f * 100);
          const transcurrido = (performance.now() - inicio) / 1000;
          const restante = f > 0.02 ? Math.round(transcurrido / f - transcurrido) : null;
          status.textContent =
            `Renderizando MP3… ${pct} %` +
            (restante !== null && restante > 1 ? ` · unos ${restante} s más` : '');
        }
      });
      if (!blob) {
        status.textContent = 'No se pudo generar el audio.';
        return;
      }
      descargar(blob, `ritmo-nama-${composicion.state.patternId ?? 'mi-estudio'}.mp3`);
      const kb = Math.round(blob.size / 1024);
      const seg = Math.round(buffer.duration);
      const tope = limiteSel?.value === 'libre' ? ` (tope de ${TOPE_MP3} s en "sin límite")` : '';
      status.textContent = `MP3 descargado ✓ (${kb} KB, ${seg} s)${tope}`;
    } catch (err) {
      console.error('[visualizador] MP3:', err);
      status.textContent = 'No se pudo generar el MP3 en este navegador.';
    } finally {
      mp3Btn.disabled = false;
    }
  });

  mp4Btn?.addEventListener('click', async () => {
    if (grabador.grabando) {
      const r = await grabador.detener();
      if (r?.blob) {
        descargar(r.blob, `ritmo-nama-${r.ext}-${Math.round(r.segundos)}s.${r.ext}`);
        status.textContent = `Vídeo descargado ✓ (${(r.blob.size / 1048576).toFixed(1)} MB, ${r.segundos} s)`;
      }
      mp4Btn.textContent = `⏺ Grabar vídeo (${formato})`;
      transporte.release();
      return;
    }

    limiteSel.disabled = true;
    mp4Btn.disabled = true;
    // El vídeo es en tiempo real: se muestra el contador mientras corre.
    const reloj = setInterval(() => {
      mp4Btn.textContent = `■ Detener (${grabador.segundos}s)`;
    }, 500);

    const r = await grabador.grabar();
    clearInterval(reloj);

    if (!r.ok) {
      status.textContent = r.motivo;
      limiteSel.disabled = false;
      mp4Btn.disabled = false;
      return;
    }
    if (r.formato !== 'MP4') {
      status.textContent = 'Tu navegador no graba MP4: se guardará en WebM, que se abre igual.';
    }
    transporte.start();
    visualizador.start();
    limiteSel.disabled = false;
    mp4Btn.disabled = false;
    mp4Btn.textContent = '■ Detener';
  });

  // Techo del MP3 en modo "sin límite": el render es offline y barato, pero
  // renderizar indefinidamente no termina nunca, así que se corta aquí y se
  // avisa en el mensaje en vez de dejar al usuario esperando.
  const TOPE_MP3 = 60;

  /**
   * El selector manda sobre las dos descargas. El MP3 lo traduce a duración
   * objetivo (el render es offline, así que no cuesta tiempo real) y el vídeo lo
   * aplica como corte en tiempo real, que es lo único que un MediaRecorder sabe
   * hacer.
   */
  const duracionObjetivo = () =>
    limiteSel?.value === 'libre' ? TOPE_MP3 : Number(limiteSel.value);

  limiteSel?.addEventListener('change', () => {
    grabador.limiteSeg = limiteSel.value === 'libre' ? LIMITE_ABIERTO : Number(limiteSel.value);
  });

  // El WAV sigue existiendo por debajo: es lo que usa el grabador de loop.
  root.dataset.wavDisponible = '1';

  return {
    visualizador,
    destroy() {
      transporte.release();
      alEstado?.();
      grabador.destroy();
      visualizador.destroy();
    }
  };
}
