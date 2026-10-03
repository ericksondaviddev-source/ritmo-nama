/**
 * Visualizador del estudio rítmico.
 *
 * Va dentro de la sección del Midipad, no en una sección aparte: así lo que se
 * ve es la misma composición que se está tocando, sin duplicar estado ni
 * obligar a aprender dos cosas distintas. Este módulo sólo pinta.
 *
 * Los controles de exportación (formato, nombre, MP3/MP4) viven en el modal de
 * exportación del Midipad, que es quien los usa; aquí sólo se expone el estilo,
 * que comparten los dos.
 */
import { ESTILOS, createVisualizer } from '../core/visualizer/index.js';
import { DRUMS } from '../data/drums.js';

export function mountVisualizador(root, { engine, getContext, audio: composicion } = {}) {
  if (!root || !composicion) return null;

  const drums = DRUMS.map(({ id, name, color }) => ({ id, name, color }));

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

      <p class="mt-2 text-xs text-zinc-600">
        Arrastra para rotar el 3D · Toca el ♪ para escuchar la demo
      </p>
    </div>`;

  const canvas = root.querySelector('[data-vz-canvas]');
  const estiloSel = root.querySelector('[data-viz-estilo]');
  const desc = root.querySelector('[data-vz-desc]');
  const avisoCarga = root.querySelector('[data-vz-carga]');

  if (!canvas) {
    console.error('[visualizador] falta el lienzo: se aborta el montaje.');
    return null;
  }

  const visualizadorInstance = createVisualizer({
    canvas,
    composicion,
    alTocarElRitmo: composicion.alTocarElRitmo,
    drums,
    getContext
  });
  if (!visualizadorInstance) return null;

  // Cambiar de estilo es asíncrono (el 3D baja sus modelos). Quien pida el
  // cambio —el modal al exportar— espera esta promesa antes de grabar.
  let cambioEstilo = Promise.resolve(true);

  async function aplicarEstilo(id) {
    const def = ESTILOS.find((e) => e.id === id);
    if (desc) desc.textContent = def?.descripcion ?? '';
    avisoCarga?.classList.toggle('hidden', !def?.necesitaWebGL);
    const ok = await visualizadorInstance.setEstilo(id);
    if (!ok) {
      if (desc) desc.textContent = 'Ese estilo no se pudo cargar en este navegador.';
      estiloSel.value = visualizadorInstance.estilo;
      avisoCarga?.classList.add('hidden');
      return false;
    }
    if (def?.necesitaWebGL) esperarCarga();
    return true;
  }

  estiloSel?.addEventListener('change', () => {
    cambioEstilo = aplicarEstilo(estiloSel.value);
  });

  let sondeo = 0;
  function esperarCarga() {
    clearInterval(sondeo);
    const idEstilo = estiloSel.value;
    sondeo = setInterval(() => {
      if (estiloSel.value !== idEstilo || !visualizadorInstance.cargando) {
        clearInterval(sondeo);
        avisoCarga?.classList.add('hidden');
      }
    }, 120);
  }

  // El visualizador sigue al transporte: cuando la composición empieza a
  // sonar, pinta; cuando se para, se limpia.
  const alEstado = composicion.subscribe((s) => {
    if (s.reproduciendo) {
      if (!visualizadorInstance.isRunning) visualizadorInstance.start();
    } else if (visualizadorInstance.isRunning) {
      visualizadorInstance.stop();
    }
  });
  if (composicion.state.reproduciendo) visualizadorInstance.start();

  // Dimensiones pedidas por el modal de exportación (formato 720/1080). Mientras
  // estén activas, el lienzo mantiene esa resolución aunque se cambie de estilo:
  // los estilos 2D leen `canvas.width` y el 3D recibe `ajustar`, así que el
  // encuadre de la grabación no se mueve a mitad de preview ni de exportación.
  let dimsExport = null;

  function aplicarDims() {
    if (dimsExport) visualizadorInstance.setDimensiones(dimsExport.ancho, dimsExport.alto);
  }

  return {
    visualizador: visualizadorInstance,
    getEstilo: () => estiloSel?.value ?? visualizadorInstance.estilo,
    /**
     * Aplica un estilo y devuelve la promesa de que quedó puesto: el modal de
     * exportación la espera antes de empezar a grabar, para no capturar un
     * lienzo a medio cargar. Si había una resolución de exportación activa, se
     * re-aplica después del cambio de estilo (un estilo nuevo puede haber
     * sustituido el elemento del canvas).
     */
    setEstiloExport(valor) {
      if (!ESTILOS.some((e) => e.id === valor)) return cambioEstilo;
      if (estiloSel.value !== valor) {
        estiloSel.value = valor;
        estiloSel.dispatchEvent(new Event('change'));
      }
      return cambioEstilo.then((ok) => {
        if (ok) aplicarDims();
        return ok;
      });
    },
    /**
     * Fija la resolución de salida del lienzo (o la restaura con null). Lo usa
     * el modal: preview y grabación ven exactamente el mismo encuadre que luego
     * se exporta.
     */
    setDimensionesExport(dims) {
      dimsExport = dims && dims.ancho && dims.alto ? dims : null;
      if (dimsExport) visualizadorInstance.setDimensiones(dimsExport.ancho, dimsExport.alto);
      else visualizadorInstance.restaurarDimensiones();
    },
    destroy() {
      clearInterval(sondeo);
      alEstado?.();
    }
  };
}

export { ESTILOS } from '../core/visualizer/index.js';
