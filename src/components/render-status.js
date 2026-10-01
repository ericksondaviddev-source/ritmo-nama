import {
  FASE,
  formatearPeso,
  observarTrabajo,
  textoFase,
  cerrarTrabajo
} from '../core/media/trabajos.js';

/**
 * Indicador del trabajo de exportar.
 *
 * Va FIJO en la esquina y vive fuera del editor a propósito. El render tarda
 * entre 10 y 40 segundos, y si el aviso viviera dentro de la sección, el
 * visitante que bajó a ver el catálogo se lo habría perdido: volvía a un botón
 * que ya no decía nada, sin saber si el trabajo seguía vivo o se había perdido.
 *
 * Aquí el aviso se ve desde cualquier punto de la página, y además dice dos
 * cosas que el usuario necesita: cuánto lleva y cuánto queda. Con eso puede
 * decidir si esperar o seguir mirando la landing mientras.
 */
export function mountRenderStatus(doc = document) {
  const root = doc.createElement('div');
  root.setAttribute('data-render-status', '');
  root.setAttribute('role', 'status');
  // Se anuncia en vivo, pero no en cada tick: se cambia el texto sólo cuando
  // cambia el mensaje de verdad, no con el porcentaje, o el lector de pantalla
  // leería un número cada 500 ms.
  root.setAttribute('aria-live', 'polite');
  root.className =
    'pointer-events-none fixed inset-x-3 bottom-3 z-50 flex justify-center sm:inset-x-auto sm:right-4 sm:bottom-4 sm:justify-end';
  root.innerHTML = `
    <div data-panel class="pointer-events-auto hidden w-full max-w-sm items-start gap-3 rounded-2xl border border-amber-500/30 bg-zinc-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur">
      <span data-giro class="mt-0.5 shrink-0" aria-hidden="true">
        <svg viewBox="0 0 24 24" class="h-5 w-5 animate-spin text-amber-400" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="9" stroke-opacity="0.25"></circle>
          <path d="M21 12a9 9 0 0 0-9-9" stroke-linecap="round"></path>
        </svg>
      </span>
      <div class="min-w-0 flex-1">
        <p data-titulo class="text-sm font-bold text-zinc-50"></p>
        <p data-detalle class="mt-0.5 text-xs text-zinc-400"></p>
        <div data-barra class="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div data-relleno class="h-full rounded-full bg-amber-500 transition-[width] duration-300" style="width:0%"></div>
        </div>
        <div class="mt-3 flex gap-2">
          <a
            data-descargar
            class="hidden rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-zinc-950 transition-colors hover:bg-amber-400"
            download
          >Descargar</a>
          <button
            type="button"
            data-cerrar
            class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800"
          >Cerrar</button>
        </div>
      </div>
    </div>`;
  doc.body.appendChild(root);

  const panel = root.querySelector('[data-panel]');
  const giro = root.querySelector('[data-giro]');
  const titulo = root.querySelector('[data-titulo]');
  const detalle = root.querySelector('[data-detalle]');
  const barra = root.querySelector('[data-barra]');
  const relleno = root.querySelector('[data-relleno]');
  const botonDescargar = root.querySelector('[data-descargar]');
  const botonCerrar = root.querySelector('[data-cerrar]');

  botonCerrar.addEventListener('click', () => cerrarTrabajo());

  const fuera = observarTrabajo((t) => {
    if (!t) {
      panel.classList.add('hidden');
      panel.classList.remove('flex');
      return;
    }

    panel.classList.remove('hidden');
    panel.classList.add('flex');
    titulo.textContent = textoFase(t.fase);
    relleno.style.width = `${Math.round(t.progreso * 100)}%`;

    // El giro sólo mientras se renderiza: cuando ya terminó o falló, un spinner
    // girando miente.
    const trabajando = t.fase === FASE.renderizando;
    giro.classList.toggle('hidden', !trabajando);
    barra.classList.toggle('hidden', t.fase === FASE.error);

    if (t.fase === FASE.renderizando) {
      const pct = Math.round(t.progreso * 100);
      const eta = t.etaSeg ? ` · unos ${t.etaSeg} s más` : '';
      // Se dice explícitamente que puede seguir mirando: es la razón de que el
      // indicador sea fijo y no bloquee nada.
      detalle.textContent = `${pct} %${eta} — puedes seguir viendo la página.`;
      botonDescargar.classList.add('hidden');
      botonCerrar.textContent = 'Cancelar';
    } else if (t.fase === FASE.listo) {
      detalle.textContent = `${formatearPeso(t.tamanoBytes)} · se descargará al pulsar`;
      botonDescargar.classList.remove('hidden');
      botonDescargar.href = t.blobUrl ?? '#';
      botonDescargar.download = t.nombreArchivo ?? 'ritmo-nama.mp4';
      botonCerrar.textContent = 'Cerrar';
    } else if (t.fase === FASE.error) {
      detalle.textContent = t.error ?? '';
      botonDescargar.classList.add('hidden');
      botonCerrar.textContent = 'Cerrar';
    }
  });

  return {
    root,
    destroy() {
      fuera();
      root.remove();
    }
  };
}