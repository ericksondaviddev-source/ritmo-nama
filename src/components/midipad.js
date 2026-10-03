import { ARTICULATIONS, DRUMS } from '../data/drums.js';
import { PATTERNS } from '../data/patterns.js';
import { ESTILOS } from '../core/visualizer/index.js';
import { createMidipadAudio } from '../core/audio/midipad.js';
import { reclamarConAviso } from '../core/audio/transport.js';
import { mountVisualizador } from './visualizador.js';
import { exportarMp3 } from '../core/media/mp3.js';
import { exportarClip, puedeExportar, nombreArchivo } from '../core/media/video-export.js';
import { createGrabador, puedeGrabar, descargar, MAX_SIN_LIMITE } from '../core/media/grabador.js';
import {
  formatoSalida,
  PLANTILLAS,
  plantillaPorId,
  MAX_NOMBRE,
  NOMBRE_POR_DEFECTO
} from '../core/media/plantillas.js';
import { dibujarFotograma } from '../core/media/dibujar.js';

const RECORD_MAX_MS = 60000;

const CELL_CLASS = {
  0: 'bg-zinc-800 hover:bg-zinc-700',
  1: 'bg-amber-500/50 hover:bg-amber-400/60',
  2: 'bg-amber-400 hover:bg-amber-300 shadow-lg shadow-amber-500/40'
};

/**
 * Selector de articulación. Sólo aparece si el tambor admite más de una: la
 * paila no lleva baqueta, así que no tiene nada que elegir.
 */
function articulationControl(drum) {
  const opciones = drum.articulations ?? [];
  if (opciones.length < 2) {
    return `<span class="w-32 shrink-0 text-right text-[10px] uppercase tracking-wide text-zinc-600">${ARTICULATIONS[opciones[0]]?.label ?? ''}</span>`;
  }
  return `
    <label class="sr-only" for="art-${drum.id}">Cómo tocar ${drum.name}</label>
    <select
      id="art-${drum.id}"
      data-articulation="${drum.id}"
      class="w-32 shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-zinc-300"
    >
      ${opciones
        .map(
          (a) =>
            `<option value="${a}" ${a === drum.defaultArticulation ? 'selected' : ''}>${ARTICULATIONS[a]?.label ?? a}</option>`
        )
        .join('')}
    </select>`;
}

export function mountMidipad(root, { engine, getContext, audio: shared } = {}) {
  if (!root) return null;

  // Comparte la composición con el exportador de vídeo; si esta sección se monta
  // sola (pruebas) crea la suya.
  const audio = shared ?? createMidipadAudio({ engine, getContext });
  if (!audio) return null;

  const presets = PATTERNS.map((p) => ({ id: p.id, name: p.name, bpm: p.bpm }));

  root.className = 'border-b border-zinc-900 py-16';
  root.innerHTML = `
    <div class="mx-auto max-w-6xl px-4">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span class="text-xs font-bold uppercase tracking-widest text-amber-500">MidiPad Pro</span>
          <h2 id="midipad-title" class="mt-2 text-3xl font-extrabold tracking-tight text-zinc-50 sm:text-4xl">
            Tu estudio <span class="text-amber-400">rítmico 6/8</span>
          </h2>
          <p class="mt-3 text-zinc-400">Toca los pads, dibuja tu patrón, ajusta el mixer y exporta en WAV real.</p>
        </div>
        <button type="button" data-fullscreen class="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:border-amber-500/60 hover:text-amber-300">
          ⛶ Pantalla completa
        </button>
      </div>

      <div data-padpanel class="mt-8 rounded-3xl glass p-4 sm:p-6">
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" data-play class="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-zinc-950 transition-all hover:bg-amber-400">▶ Tocar</button>
          <button type="button" data-stop class="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-3 text-sm font-bold text-zinc-300 transition-colors hover:bg-zinc-700" disabled>■ Parar</button>
          <label class="flex items-center gap-2 text-sm text-zinc-400">Preset
            <select data-preset class="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200">
              ${presets.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </label>
          <label class="flex flex-1 min-w-40 items-center gap-2 text-sm text-zinc-400">BPM <span data-bpm-value class="w-8 font-bold text-amber-400">124</span>
            <input type="range" data-bpm min="80" max="180" step="1" value="124" class="flex-1 accent-amber-500" />
          </label>
          <label class="flex flex-1 min-w-40 items-center gap-2 text-sm text-zinc-400">Swing <span data-swing-value class="w-8 font-bold text-amber-400">40%</span>
            <input type="range" data-swing min="0" max="60" step="1" value="40" class="flex-1 accent-amber-500" />
          </label>
        </div>

        <div data-grid class="mt-6 space-y-2" style="touch-action: none;"></div>

        <div class="mt-6">
          <h3 class="text-sm font-black uppercase tracking-wide text-zinc-300">Mixer</h3>
          <div data-mixer class="mt-3 space-y-2"></div>
          <label class="mt-4 flex items-center gap-3 text-sm text-zinc-400">Master
            <input type="range" data-master min="0" max="1" step="0.01" value="0.85" class="flex-1 accent-amber-500" />
            <span data-master-value class="w-10 text-right font-bold text-amber-400">85%</span>
          </label>
        </div>

        <div class="mt-6 flex flex-wrap items-center gap-3">
          <span class="text-xs font-black uppercase tracking-widest text-zinc-400">Progreso</span>
          <div class="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div data-progreso-barra class="h-full w-0 rounded-full bg-amber-500 transition-all duration-500"></div>
          </div>
          <span data-progreso-texto role="status" class="text-xs text-zinc-400">Paila · 0/3 escuchas</span>
          <button
            type="button"
            data-progreso-reiniciar
            class="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[11px] font-bold text-zinc-400 transition-colors hover:text-zinc-200"
          >Reiniciar</button>
        </div>

        <div class="mt-6 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4">
          <button type="button" data-record-loop class="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/20">⏺ Grabar loop (60 s)</button>
          <button type="button" data-record-voice class="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-bold text-zinc-300 transition-colors hover:bg-zinc-700">🎤 Grabar voz</button>
          <button type="button" data-export class="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400">⬇ Exportar</button>
          <span data-padstatus role="status" aria-live="polite" class="text-xs text-zinc-500"></span>
        </div>
        <p data-padaviso class="mt-2 hidden text-xs text-amber-500/90"></p>
        <audio data-loopplayback controls class="mt-3 hidden w-full"></audio>
      </div>
      <div data-visualizador></div>
    </div>`;

  // Grid: 6 stems × 12 celdas
  const grid = root.querySelector('[data-grid]');
  const cellEls = {};
  const cellClass = (s) => CELL_CLASS[s] ?? CELL_CLASS[0];

  function buildGrid() {
    grid.innerHTML = DRUMS.map(
      (d) => `
      <div class="flex flex-wrap items-center gap-2">
        <span class="flex w-24 shrink-0 items-center gap-1.5 text-xs font-bold text-zinc-400 ${d.optional ? 'italic text-zinc-500' : ''}">
          <span class="h-2 w-2 shrink-0 rounded-full" style="background:${d.color}"></span>${d.name}
        </span>
        <div class="flex flex-1 gap-1.5">
          ${audio.state.steps[d.id]
            .map(
              (_, i) => `
            <button
              type="button"
              data-cell="${d.id}" data-step="${i}"
              aria-label="${d.name}, paso ${i + 1}"
              class="h-9 flex-1 rounded-md transition-colors ${cellClass(audio.state.steps[d.id][i])}"
            ></button>`
            )
            .join('')}
        </div>
        ${articulationControl(d)}
      </div>`
    ).join('');

    // Indicador visual 6/8: "tres y tres"
    // Agregar grupos resaltados después del paso 3 y paso 9
    const groupingMarkers = document.createDocumentFragment();
    for (let i = 0; i < DRUMS.length; i++) {
      const drum = DRUMS[i];
      const step3 = document.createElement('div');
      step3.className = 'grouping-68 bg-zinc-800/60 rounded-xl p-1 my-0.5 text-xs text-zinc-400 absolute top-full left-1/2 -translate-x-1/2 mt-1';
      step3.textContent = '3';
      const step9 = document.createElement('div');
      step9.className = 'grouping-68 bg-zinc-800/60 rounded-xl p-1 my-0.5 text-xs text-zinc-400 absolute top-full left-1/2 -translate-x-1/2 mt-1';
      step9.textContent = '3';
      // Insertar después del tercer paso (índice 3) y noveno paso (índice 9)
      const cells = grid.querySelectorAll(`[data-cell="${drum.id}"]`);
      if (cells.length > 3) cells[3].parentNode.insertBefore(step3, cells[3].nextSibling);
      if (cells.length > 9) cells[9].parentNode.insertBefore(step9, cells[9].nextSibling);
    }

    for (const d of DRUMS) {
      cellEls[d.id] = [...grid.querySelectorAll(`[data-cell="${d.id}"]`)];
    }
    for (const sel of grid.querySelectorAll('[data-articulation]')) {
      sel.addEventListener('change', () => {
        audio.setArticulation(sel.dataset.articulation, sel.value);
        audio.playHit(sel.dataset.articulation, undefined, 1); // se oye el cambio
      });
    }
  }
  buildGrid();

  function updateCell(drumId, i) {
    const el = cellEls[drumId]?.[i];
    if (el) el.className = `h-9 flex-1 rounded-md transition-colors ${cellClass(audio.state.steps[drumId][i])}`;
  }
  function refreshGrid() {
    for (const d of DRUMS) for (let i = 0; i < 12; i++) updateCell(d.id, i);
    refreshArticulations();
  }

  function refreshArticulations() {
    for (const sel of grid.querySelectorAll('[data-articulation]')) {
      const actual = audio.state.articulation[sel.dataset.articulation];
      if (actual) sel.value = actual;
    }
  }

  // La rejilla y los selectores son dos vistas del mismo estado: si otra sección
  // (o el exportador de vídeo) cambia la composición, esto se entera. Pero al
  // tocar una celda el propio manejador ya repinta esa celda, así que aquí sólo
  // se repinta cuando el cambio viene de fuera: si no, cada toque recorrería las
  // 48 celdas del DOM.
  let ultimo = { patron: audio.state.patternId, artic: articulacionSignature() };
  const unsubscribe = audio.subscribe(() => {
    const patron = audio.state.patternId;
    const artic = articulacionSignature();
    if (patron !== ultimo.patron) {
      ultimo = { patron, artic };
      refreshGrid();
      return;
    }
    if (artic !== ultimo.artic) {
      ultimo.artic = artic;
      refreshArticulations();
    }
  });

  function articulacionSignature() {
    return DRUMS.map((d) => `${d.id}:${audio.state.articulation[d.id]}`).join('|');
  }

  // Pads multi-touch: pointerdown cicla y hace preview del golpe
  grid.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('[data-cell]');
    if (!btn) return;
    e.preventDefault();
    const drumId = btn.dataset.cell;
    const step = Number(btn.dataset.step);
    const next = audio.toggleCell(drumId, step);
    updateCell(drumId, step);
    const ctx = getContext?.();
    if (next > 0 && ctx) audio.playHit(drumId, ctx.currentTime, next);
  });

  // Teclado: Enter/Espacio sobre una celda enfocada (los botones disparan click, no pointerdown)
  grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const btn = e.target.closest('[data-cell]');
    if (!btn) return;
    e.preventDefault();
    const drumId = btn.dataset.cell;
    const step = Number(btn.dataset.step);
    const next = audio.toggleCell(drumId, step);
    updateCell(drumId, step);
    const ctx = getContext?.();
    if (next > 0 && ctx) audio.playHit(drumId, ctx.currentTime, next);
  });

  // Transporte. Sólo un reproductor puede sonar: si arranca otro (el curso, el
  // exportador de vídeo), éste se para y su botón vuelve a.enabled.
  const playBtn = root.querySelector('[data-play]');
  const stopBtn = root.querySelector('[data-stop]');
  const reposo = () => {
    playBtn.disabled = false;
    stopBtn.disabled = true;
  };
  const transporte = reclamarConAviso({ stop: () => audio.stop() }, reposo);

  playBtn.addEventListener('click', () => {
    try {
      transporte.start();
      audio.start();
      playBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {
      // Si el audio no arranca, el transporte no puede quedar tomado: si no,
      // el curso y la grabación no podrían volver a sonar.
      audio.stop();
      transporte.release();
      reposo();
      console.error('[midipad] no se pudo iniciar el transporte:', err);
    }
  });
  stopBtn.addEventListener('click', () => {
    audio.stop();
    transporte.release();
    reposo();
  });

  const presetSel = root.querySelector('[data-preset]');
  presetSel.addEventListener('change', () => {
    audio.applyPreset(presetSel.value);
    refreshGrid();
    root.querySelector('[data-bpm]').value = audio.state.bpm;
    root.querySelector('[data-bpm-value]').textContent = audio.state.bpm;
  });

  const bpmInput = root.querySelector('[data-bpm]');
  bpmInput.addEventListener('input', () => {
    audio.setBpm(Number(bpmInput.value));
    root.querySelector('[data-bpm-value]').textContent = audio.state.bpm;
  });
  const swingInput = root.querySelector('[data-swing]');
  swingInput.addEventListener('input', () => {
    audio.setSwing(Number(swingInput.value));
    root.querySelector('[data-swing-value]').textContent = `${audio.state.swing}%`;
  });
  const masterInput = root.querySelector('[data-master]');
  masterInput.addEventListener('input', () => {
    audio.setMaster(Number(masterInput.value));
    root.querySelector('[data-master-value]').textContent = `${Math.round(audio.state.master * 100)}%`;
  });

  // Progreso secuencial: 3 escuchas por tambor, en orden Paila→Prima→Pujao→
  // Cruzao. El núcleo lo cuenta por compás completo y lo guarda; aquí sólo se
  // pinta.
  const NOMBRES_PASO = ['Paila', 'Prima', 'Pujao', 'Cruzao'];
  const progresoBarra = root.querySelector('[data-progreso-barra]');
  const progresoTexto = root.querySelector('[data-progreso-texto]');

  function pintarProgreso() {
    const p = audio.state.progresoSecuencial;
    const fraccion = p.completado ? 1 : (p.pasoActual + p.escuchasRealizadas / p.maxEscuchas) / 4;
    progresoBarra.style.width = `${Math.round(fraccion * 100)}%`;
    progresoTexto.textContent = p.completado
      ? '¡Completado! 🥁'
      : `${NOMBRES_PASO[p.pasoActual]} · ${p.escuchasRealizadas}/${p.maxEscuchas} escuchas`;
  }
  root.querySelector('[data-progreso-reiniciar]')?.addEventListener('click', () => {
    audio.reiniciarProgreso();
  });
  const unsubscribeProgreso = audio.subscribe(pintarProgreso);
  pintarProgreso();

  // Mixer
  const mixerEl = root.querySelector('[data-mixer]');
  mixerEl.innerHTML = DRUMS.map(
    (d) => `
    <div data-mixer-row="${d.id}" class="flex flex-wrap items-center gap-2 rounded-xl bg-zinc-950/50 px-3 py-2">
      <span class="w-20 text-xs font-bold text-zinc-400">${d.name}</span>
      <label class="flex flex-1 min-w-32 items-center gap-1.5 text-[11px] text-zinc-500">Vol
        <input type="range" data-mx="volume" data-mx-stem="${d.id}" min="0" max="1.5" step="0.05" value="1" class="flex-1 accent-amber-500" />
      </label>
      <label class="flex flex-1 min-w-32 items-center gap-1.5 text-[11px] text-zinc-500">Pan
        <input type="range" data-mx="pan" data-mx-stem="${d.id}" min="-1" max="1" step="0.1" value="0" class="flex-1 accent-amber-500" />
      </label>
      <label class="flex flex-1 min-w-32 items-center gap-1.5 text-[11px] text-zinc-500">Afin.
        <input type="range" data-mx="tuning" data-mx-stem="${d.id}" min="-12" max="12" step="1" value="0" class="flex-1 accent-amber-500" />
      </label>
      <button type="button" data-mx="solo" data-mx-stem="${d.id}" aria-pressed="false" class="rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-400 transition-colors hover:text-zinc-200">Solo</button>
      <button type="button" data-mx="mute" data-mx-stem="${d.id}" aria-pressed="false" class="rounded-lg border border-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-400 transition-colors hover:text-zinc-200">Mute</button>
    </div>`
  ).join('');

  mixerEl.addEventListener('input', (e) => {
    const input = e.target.closest('input[data-mx]');
    if (!input) return;
    audio.setMixer(input.dataset.mxStem, { [input.dataset.mx]: Number(input.value) });
  });
  mixerEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mx]');
    if (!btn) return;
    const key = btn.dataset.mx;
    const current = audio.state.mixer[btn.dataset.mxStem][key];
    audio.setMixer(btn.dataset.mxStem, { [key]: !current });
    btn.setAttribute('aria-pressed', String(!current));
    btn.classList.toggle('!bg-amber-500/20', !current);
    btn.classList.toggle('!text-amber-300', !current);
  });

  // Fullscreen
  const panel = root.querySelector('[data-padpanel]');
  const fsBtn = root.querySelector('[data-fullscreen]');
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else panel.requestFullscreen?.().catch(() => {});
  });

  // Grabación + export
  const status = root.querySelector('[data-padstatus]');
  const aviso = root.querySelector('[data-padaviso]');
  const playback = root.querySelector('[data-loopplayback]');
  const recordLoopBtn = root.querySelector('[data-record-loop]');
  const recordVoiceBtn = root.querySelector('[data-record-voice]');
  const ctx = getContext?.();
  const canRecord =
    typeof window.MediaRecorder !== 'undefined' &&
    typeof ctx?.createMediaStreamDestination === 'function';

  let loopRecorder = null;
  let voiceRecorderActive = null;
  let voiceBuffer = null;
  let voiceStream = null;

  function showAviso(text) {
    aviso.textContent = text;
    aviso.classList.remove('hidden');
  }

  if (!canRecord) {
    recordLoopBtn.disabled = true;
    recordVoiceBtn.disabled = true;
    showAviso('Tu navegador no permite grabar. Prueba en Chrome o Edge.');
  }

  recordLoopBtn.addEventListener('click', () => {
    if (loopRecorder) {
      // Segundo clic: detener antes de los 60 s
      if (loopRecorder.state !== 'inactive') loopRecorder.stop();
      return;
    }
    if (!canRecord) return;
    const dest = ctx.createMediaStreamDestination();
    engine.connectOutput(dest);
    const mime = ['audio/webm;codecs=opus', 'audio/webm'].find((m) => window.MediaRecorder.isTypeSupported(m)) ?? '';
    const rec = new MediaRecorder(dest.stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(';')[0] || 'audio/webm' });
      playback.src = URL.createObjectURL(blob);
      playback.classList.remove('hidden');
      status.textContent = 'Loop grabado ✓';
      recordLoopBtn.textContent = '⏺ Grabar loop (60 s)';
      loopRecorder = null;
    };
    loopRecorder = rec;
    recordLoopBtn.textContent = '■ Detener grabación';
    status.textContent = 'Grabando loop… (máx 60 s)';
    rec.start();
    setTimeout(() => {
      if (rec.state !== 'inactive') rec.stop();
    }, RECORD_MAX_MS);
  });

  recordVoiceBtn.addEventListener('click', async () => {
    if (voiceStream) {
      if (voiceRecorderActive?.state !== 'inactive') voiceRecorderActive.stop();
      return;
    }
    if (!canRecord) return;
    try {
      voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      voiceStream = null;
      showAviso('¡Pide permiso a tus papás para grabar tu voz!');
      return;
    }
    const mime = ['audio/webm;codecs=opus', 'audio/webm'].find((m) => window.MediaRecorder.isTypeSupported(m)) ?? '';
    const rec = new MediaRecorder(voiceStream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    rec.onstop = async () => {
      for (const track of voiceStream.getTracks()) track.stop();
      voiceStream = null;
      voiceRecorderActive = null;
      recordVoiceBtn.textContent = '🎤 Grabar voz';
      try {
        const blob = new Blob(chunks, { type: mime.split(';')[0] || 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        voiceBuffer = await ctx.decodeAudioData(arrayBuffer);
        status.textContent = 'Voz grabada ✓ (se mezcla en el export)';
      } catch {
        status.textContent = 'No se pudo decodificar la voz';
      }
    };
    voiceRecorderActive = rec;
    recordVoiceBtn.textContent = '■ Detener voz';
    status.textContent = 'Grabando voz… (habla sobre la base)';
    rec.start();
    setTimeout(() => {
      if (rec.state !== 'inactive') rec.stop();
    }, RECORD_MAX_MS);
  });

  // El export en WAV se sustituyó por MP3 y MP4, que viven en el visualizador
  // (src/components/visualizador.js) porque van con el vídeo.

  // Pre-warm al primer gesto en la página (spec §8)
  const warm = () => {
    audio.warmUp();
    window.removeEventListener('pointerdown', warm);
  };
  window.addEventListener('pointerdown', warm, { once: true });

  // Carga inicial del primer preset
  audio.applyPreset(presets[0].id);
  refreshGrid();

  // El visualizador vive dentro de esta misma sección: comparte la composición,
  // así que no hay dos estudios distintos que aprender.
  const visualizador = mountVisualizador(root.querySelector('[data-visualizador]'), {
    engine,
    getContext,
    audio
  });

  // === EXPORT MODAL ===
  const exportBtn = root.querySelector('[data-export]');
  const exportModal = crearModalExportador({ root, audio, visualizador, engine, getContext });

  exportBtn?.addEventListener('click', () => {
    exportModal.abrir();
  });

  // Función para crear el modal de exportación
  function crearModalExportador({ root, audio, visualizador, engine, getContext }) {
    let modal = null;
    let previewInterval = null;
    // true mientras dura una exportación: el modal no se cierra a mitad.
    let exportando = false;
    // Estilo que tenía el visitante al abrir: se devuelve al cerrar.
    let estiloDeAntes = null;

    function onEscape(e) {
      if (e.key === 'Escape') cerrar();
    }

    function cerrar() {
      if (exportando) return;
      if (previewInterval) {
        clearInterval(previewInterval);
        previewInterval = null;
      }
      // Lienzo otra vez en su resolución nativa y estilo original.
      visualizador.setDimensionesExport(null);
      if (estiloDeAntes && visualizador.getEstilo() !== estiloDeAntes) {
        visualizador.setEstiloExport(estiloDeAntes);
      }
      estiloDeAntes = null;
      document.removeEventListener('keydown', onEscape);
      if (modal) {
        modal.remove();
        modal = null;
      }
    }

    function abrir() {
      if (modal) return;
      estiloDeAntes = visualizador.getEstilo();

      // Crear el modal
      modal = document.createElement('div');
      modal.setAttribute('data-export-modal', '');
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
      modal.innerHTML = `
        <div class="relative w-full max-w-4xl mx-4 my-8 bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-zinc-800">
            <h2 class="text-lg font-bold text-zinc-50">Exportar vídeo</h2>
            <button type="button" data-modal-cerrar class="p-2 rounded-lg hover:bg-zinc-800 transition-colors" aria-label="Cerrar">
              <svg class="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="p-4 overflow-y-auto max-h-[70vh]">
            <div class="flex gap-4 mb-4" role="tablist">
              <button role="tab" data-tab="mp3" aria-selected="true" class="px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 font-semibold">MP3</button>
              <button role="tab" data-tab="mp4" aria-selected="false" class="px-4 py-2 rounded-lg text-zinc-300 hover:bg-zinc-800 transition-colors">MP4</button>
            </div>
            
            <div role="tabpanel" data-panel="mp3" class="space-y-4">
              <div>
                <label for="export-mp3-nombre" class="block text-sm font-medium text-zinc-300 mb-1">Nombre del archivo</label>
                <input type="text" id="export-mp3-nombre" maxlength="${MAX_NOMBRE}" placeholder="Mi ritmo" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none">
              </div>
              <div>
                <label for="export-mp3-duracion" class="block text-sm font-medium text-zinc-300 mb-1">Duración</label>
                <select id="export-mp3-duracion" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none">
                  <option value="15">15 segundos</option>
                  <option value="30" selected>30 segundos</option>
                  <option value="60">60 segundos</option>
                </select>
              </div>
              <p class="text-xs text-zinc-500">Máx. ${MAX_NOMBRE} caracteres. Si lo dejas vacío: "${NOMBRE_POR_DEFECTO}". Si grabaste tu voz, se mezcla en el MP3.</p>
              <button type="button" id="btn-generar-mp3" class="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
                ⭳ Generar MP3
              </button>
              <p id="export-estado-mp3" class="text-center text-xs text-zinc-500" aria-live="polite"></p>
            </div>
            
            <div role="tabpanel" data-panel="mp4" class="hidden space-y-4">
              <div id="preview-box" class="rounded-xl bg-zinc-950 overflow-hidden relative h-[280px] w-full">
                <canvas id="preview-canvas" class="absolute inset-0 h-full w-full" aria-label="Vista previa del vídeo"></canvas>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="export-estilo" class="block text-sm font-medium text-zinc-300 mb-1">Estilo</label>
                  <select id="export-estilo" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none">
                    ${ESTILOS.map((e) => `<option value="${e.id}">${e.nombre}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label for="export-formato" class="block text-sm font-medium text-zinc-300 mb-1">Formato</label>
                  <select id="export-formato" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none">
                    <option value="vertical">Vertical 9:16 (Reels/Shorts)</option>
                    <option value="horizontal">Horizontal 16:9 (YouTube)</option>
                  </select>
                </div>
                <div>
                  <label for="export-calidad" class="block text-sm font-medium text-zinc-300 mb-1">Calidad</label>
                  <select id="export-calidad" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none">
                    <option value="720" selected>720p — rápido</option>
                    <option value="1080">1080p — alta</option>
                  </select>
                </div>
                <div>
                  <label for="export-mp4-duracion" class="block text-sm font-medium text-zinc-300 mb-1">Duración</label>
                  <select id="export-mp4-duracion" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none">
                    <option value="15" selected>15 segundos</option>
                    <option value="30">30 segundos</option>
                    <option value="60">60 segundos</option>
                  </select>
                </div>
                <div class="col-span-2">
                  <label for="export-plantilla" class="block text-sm font-medium text-zinc-300 mb-1">Plantilla</label>
                  <select id="export-plantilla" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none">
                    ${PLANTILLAS.map((p) => `<option value="${p.id}">${p.nombre}</option>`).join('')}
                  </select>
                </div>
                <div class="col-span-2">
                  <label for="export-nombre" class="block text-sm font-medium text-zinc-300 mb-1">Nombre / Canción</label>
                  <input type="text" id="export-nombre" maxlength="${MAX_NOMBRE}" placeholder="Tu nombre o el nombre de la canción" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none">
                  <p class="mt-1 text-xs text-zinc-500">Máx. ${MAX_NOMBRE} caracteres. Si lo dejas vacío: "${NOMBRE_POR_DEFECTO}".</p>
                </div>
                <div class="col-span-2 pt-2">
                  <button type="button" id="btn-generar-mp4" class="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
                    ⏺ Generar MP4
                  </button>
                  <p id="export-mp4-nota" class="mt-1 hidden text-xs text-amber-400/90"></p>
                  <p id="export-estado" class="mt-2 text-center text-xs text-zinc-500" aria-live="polite"></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      document.addEventListener('keydown', onEscape);

      // Pestañas MP3 / MP4 (con vista previa en vivo al abrir MP4)
      const tabs = modal.querySelectorAll('[role="tab"]');
      const panels = modal.querySelectorAll('[role="tabpanel"]');

      function mostrarPanel(tab) {
        tabs.forEach((t) => {
          const activo = t === tab;
          t.setAttribute('aria-selected', String(activo));
          t.classList.toggle('bg-amber-500', activo);
          t.classList.toggle('text-zinc-950', activo);
          t.classList.toggle('font-semibold', activo);
          t.classList.toggle('text-zinc-300', !activo);
          t.classList.toggle('hover:bg-zinc-800', !activo);
        });
        panels.forEach((p) => {
          const activo = p.dataset.panel === tab.dataset.tab;
          p.hidden = !activo;
          p.classList.toggle('hidden', !activo);
        });
        if (tab.dataset.tab === 'mp4') {
          aplicarFormatoPreview();
          iniciarPreview();
        } else detenerPreview();
      }

      tabs.forEach((tab) => {
        tab.addEventListener('click', () => mostrarPanel(tab));
      });

      // Estilo actual del visualizador; MP4 sólo en navegadores con WebCodecs.
      const selEstilo = modal.querySelector('#export-estilo');
      if (selEstilo) selEstilo.value = visualizador.getEstilo();
      if (!puedeExportar() || !puedeGrabar()) {
        const btnMp4 = modal.querySelector('#btn-generar-mp4');
        const nota = modal.querySelector('#export-mp4-nota');
        if (btnMp4) btnMp4.disabled = true;
        if (nota) {
          nota.textContent = 'Este navegador no puede exportar MP4 con marca — usa Chrome o Edge. El MP3 sí funciona aquí.';
          nota.classList.remove('hidden');
        }
      }

      // Cerrar modal
      modal.querySelector('[data-modal-cerrar]')?.addEventListener('click', cerrar);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) cerrar();
      });

      // Vista previa WYSIWYG: el lienzo del visualizador se redimensiona al
      // formato de salida (lo mismo que verá la grabación) y cada fotograma se
      // pinta con la MISMA plantilla y nombre que usará el render final
      // (dibujarFotograma), a escala. Lo que se ve aquí es lo que saldrá.
      const previewCanvas = modal.querySelector('#preview-canvas');
      const previewBox = modal.querySelector('#preview-box');
      const previewCtx = previewCanvas ? previewCanvas.getContext('2d') : null;
      const selFormato = modal.querySelector('#export-formato');
      const selCalidad = modal.querySelector('#export-calidad');
      const selPlantilla = modal.querySelector('#export-plantilla');
      const inputNombre = modal.querySelector('#export-nombre');

      function dimsActuales() {
        return formatoSalida(selFormato?.value, selCalidad?.value);
      }

      function aplicarFormatoPreview() {
        if (exportando) return;
        const dims = dimsActuales();
        visualizador.setDimensionesExport(dims);
        if (!previewCanvas || !previewBox) return;
        const ratio = dims.ancho / dims.alto;
        const maxAlto = Math.min(Math.round(window.innerHeight * 0.44), 440);
        const maxAncho = previewBox.parentElement?.clientWidth ?? 480;
        let h = maxAlto;
        let w = h * ratio;
        if (w > maxAncho) {
          w = maxAncho;
          h = w / ratio;
        }
        previewBox.style.width = `${Math.round(w)}px`;
        previewBox.style.height = `${Math.round(h)}px`;
        previewBox.style.marginInline = 'auto';
        const escala = 540 / Math.max(dims.ancho, dims.alto);
        previewCanvas.width = Math.round(dims.ancho * escala);
        previewCanvas.height = Math.round(dims.alto * escala);
      }

      function iniciarPreview() {
        if (previewInterval) return;
        if (!previewCtx) return;
        aplicarFormatoPreview();
        previewInterval = setInterval(() => {
          if (!modal) {
            detenerPreview();
            return;
          }
          // El canvas fuente se busca en cada fotograma: cambiar de estilo al
          // 3D sustituye el elemento del lienzo.
          const fuente = document.querySelector('[data-vz-canvas]');
          if (!fuente) return;
          dibujarFotograma(previewCtx, {
            fotograma: fuente,
            plantilla: plantillaPorId(selPlantilla?.value),
            nombre: inputNombre?.value ?? '',
            formato: { ancho: previewCanvas.width, alto: previewCanvas.height }
          });
        }, 1000 / 30);
      }

      function detenerPreview() {
        if (previewInterval) {
          clearInterval(previewInterval);
          previewInterval = null;
        }
      }

      // Formato o calidad: re-enquadran la caja, el lienzo de grabación y la
      // resolución de salida de una vez, para que coincidan siempre.
      selFormato?.addEventListener('change', aplicarFormatoPreview);
      selCalidad?.addEventListener('change', aplicarFormatoPreview);
      // Cambiar estilo en la preview también lo cambia en el visualizador
      // principal (comparten lienzo): si falla, el select se re-sincroniza.
      selEstilo?.addEventListener('change', () => {
        const valor = selEstilo.value;
        visualizador.setEstiloExport(valor).then((ok) => {
          if (!ok && selEstilo.value === valor) selEstilo.value = visualizador.getEstilo();
        });
      });
      
      // Botón generar MP3
      modal.querySelector('#btn-generar-mp3')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const estado = modal.querySelector('#export-estado-mp3');
        const nombre = (modal.querySelector('#export-mp3-nombre')?.value || '').trim() || NOMBRE_POR_DEFECTO;
        const duracionSeg = Number(modal.querySelector('#export-mp3-duracion')?.value) || 30;
        btn.disabled = true;
        estado.textContent = `Generando MP3… hasta ${duracionSeg} s de audio.`;
        try {
          const res = await exportarMp3(audio, {
            duracionSeg,
            voz: voiceBuffer,
            engine,
            getContext,
            alProgresar: (f) => {
              estado.textContent = `Generando MP3… ${Math.round(f * 100)}%`;
            }
          });
          if (!res?.blob) throw new Error('La exportación de audio salió vacía.');
          descargar(res.blob, nombreArchivo(nombre, 'mp3'));
          estado.textContent = '¡Listo! Descarga iniciada.';
        } catch (err) {
          console.error('[export] MP3 error:', err);
          estado.textContent = 'No se pudo generar el MP3. Intenta otra vez.';
        } finally {
          btn.disabled = false;
        }
      });
      
      // Botón generar MP4
      modal.querySelector('#btn-generar-mp4')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const estado = modal.querySelector('#export-estado');
        const selEstiloMp4 = modal.querySelector('#export-estilo');
        const nombre = (inputNombre?.value || '').trim() || NOMBRE_POR_DEFECTO;
        const plantillaId = selPlantilla?.value;
        const duracionSeg = Number(modal.querySelector('#export-mp4-duracion')?.value) || 15;
        const formato = dimsActuales();
        const estiloId = selEstiloMp4?.value;

        if (exportando || !estado) return;
        exportando = true;
        btn.disabled = true;
        btn.textContent = 'Grabando…';
        if (selEstiloMp4) selEstiloMp4.disabled = true;
        if (selFormato) selFormato.disabled = true;
        if (selCalidad) selCalidad.disabled = true;
        estado.textContent = 'Preparando el vídeo…';

        let grabador = null;
        let reclamado = false;
        let detuvo = false;
        try {
          // Encuadre exacto de salida y estilo elegidos, antes de capturar nada.
          visualizador.setDimensionesExport(formato);
          await visualizador.setEstiloExport(estiloId);
          await new Promise((r) => setTimeout(r, 150));

          const lienzo = document.querySelector('[data-vz-canvas]');
          if (!lienzo) throw new Error('No se encontró el canvas del visualizador.');

          const sonaba = audio.state.reproduciendo;
          grabador = createGrabador({
            canvas: lienzo,
            engine,
            getContext,
            limiteSeg: MAX_SIN_LIMITE,
            alCambiarEstado: (txt) => {
              estado.textContent = txt;
            }
          });

          const res = await grabador.grabar();
          if (!res?.ok) throw new Error(res?.motivo || 'Este navegador no puede grabar MP4.');

          if (!sonaba) {
            transporte.start();
            reclamado = true;
            audio.start();
            playBtn.disabled = true;
            stopBtn.disabled = false;
          }

          await new Promise((r) => setTimeout(r, duracionSeg * 1000));
          const fin = await grabador.detener();
          detuvo = true;
          if (!fin?.blob) throw new Error('La grabación salió vacía.');

          // La grabación ya existe: para preview, audio y visualizador, y
          // congela la página (clase `exportando`). Con todo el sitio activo,
          // el codificador y la página comparten GPU y la exportación cae a
          // ~1 fps; congelada corre a velocidad normal.
          detenerPreview();
          if (audio.state.reproduciendo || reclamado) {
            audio.stop();
            transporte.release();
            reposo();
            reclamado = false;
          }
          document.documentElement.classList.add('exportando');

          estado.textContent = 'Codificando MP4… 0%';
          const out = await exportarClip({
            blob: fin.blob,
            plantilla: plantillaPorId(plantillaId),
            nombre,
            formato,
            alProgresar: (p) => {
              estado.textContent = `Codificando MP4… ${Math.round(p * 100)}%`;
            }
          });
          descargar(out.blob, out.nombre);
          estado.textContent = '¡Listo! Descarga iniciada.';
        } catch (err) {
          console.error('[export] MP4 error:', err);
          estado.textContent = 'Error: ' + err.message;
        } finally {
          document.documentElement.classList.remove('exportando');
          if (grabador) {
            if (!detuvo) {
              try {
                await grabador.detener();
              } catch {
                // ya estaba detenido
              }
            }
            grabador.destroy();
          }
          if (reclamado) {
            audio.stop();
            transporte.release();
            reposo();
          }
          // El estilo no se revierte aquí: el modal sigue abierto mostrando lo
          // que se exportó; al cerrarlo, `cerrar()` restaura el original.
          if (selEstiloMp4) selEstiloMp4.disabled = false;
          if (selFormato) selFormato.disabled = false;
          if (selCalidad) selCalidad.disabled = false;
          btn.disabled = false;
          btn.textContent = '⏺ Generar MP4';
          exportando = false;
          // Si el usuario sigue en la pestaña MP4, la vista previa vuelve.
          const panelMp4 = modal?.querySelector('[data-panel="mp4"]');
          if (panelMp4 && !panelMp4.hidden) iniciarPreview();
        }
      });
    }

    return { abrir, cerrar };
  }

  return {
    visualizador,
    destroy() {
      exportModal?.cerrar();
      unsubscribe?.();
      unsubscribeProgreso?.();
      transporte.release();
      visualizador?.destroy();
      audio.stop();
      if (loopRecorder && loopRecorder.state !== 'inactive') loopRecorder.stop();
      if (voiceRecorderActive && voiceRecorderActive.state !== 'inactive') voiceRecorderActive.stop();
      if (voiceStream) for (const t of voiceStream.getTracks()) t.stop();
      if (playback?.src) URL.revokeObjectURL(playback.src);
    }
  };
}
