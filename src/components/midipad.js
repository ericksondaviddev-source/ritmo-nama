import { ARTICULATIONS, DRUMS } from '../data/drums.js';
import { PATTERNS } from '../data/patterns.js';
import { createMidipadAudio } from '../core/audio/midipad.js';
import { reclamarConAviso } from '../core/audio/transport.js';

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

        <div class="mt-6 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-4">
          <button type="button" data-record-loop class="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/20">⏺ Grabar loop (60 s)</button>
          <button type="button" data-record-voice class="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-bold text-zinc-300 transition-colors hover:bg-zinc-700">🎤 Grabar voz</button>
          <button type="button" data-export-wav class="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-bold text-amber-300 transition-colors hover:bg-zinc-700">⭳ Exportar WAV</button>
          <span data-padstatus role="status" aria-live="polite" class="text-xs text-zinc-500"></span>
        </div>
        <p data-padaviso class="mt-2 hidden text-xs text-amber-500/90"></p>
        <audio data-loopplayback controls class="mt-3 hidden w-full"></audio>
      </div>
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
    transporte.start();
    audio.start();
    playBtn.disabled = true;
    stopBtn.disabled = false;
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
  const exportBtn = root.querySelector('[data-export-wav]');
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

  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true;
    status.textContent = 'Renderizando WAV…';
    const wav = await audio.renderExport({ cycles: 2, voiceBuffer });
    exportBtn.disabled = false;
    status.textContent = '';
    if (wav) {
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ritmo-nama-midipad.wav';
      a.click();
      URL.revokeObjectURL(url);
      status.textContent = 'WAV descargado ✓';
    } else {
      status.textContent = 'No se pudo exportar';
    }
  });

  // Pre-warm al primer gesto en la página (spec §8)
  const warm = () => {
    audio.warmUp();
    window.removeEventListener('pointerdown', warm);
  };
  window.addEventListener('pointerdown', warm, { once: true });

  // Carga inicial del primer preset
  audio.applyPreset(presets[0].id);
  refreshGrid();

  return {
    destroy() {
      unsubscribe?.();
      transporte.release();
      audio.stop();
      if (loopRecorder && loopRecorder.state !== 'inactive') loopRecorder.stop();
      if (voiceRecorderActive && voiceRecorderActive.state !== 'inactive') voiceRecorderActive.stop();
      if (voiceStream) for (const t of voiceStream.getTracks()) t.stop();
      if (playback?.src) URL.revokeObjectURL(playback.src);
    }
  };
}
