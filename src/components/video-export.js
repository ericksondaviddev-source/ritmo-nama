import { PATTERNS } from '../data/patterns.js';
import { DRUMS } from '../data/drums.js';
import { createVisualizer } from '../core/audio/visualizer.js';

const MAX_SEC = 30;
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm'
];

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export function mountVideoExport(root, { engine, getContext }) {
  if (!root || !engine) return null;

  const stemIds = DRUMS.map((d) => d.id);
  const stemVisibility = Object.fromEntries(stemIds.map((id) => [id, true]));
  let style = 'barras';
  let patternId = 'guaira-tradicional';

  const bpmFor = (id) => PATTERNS.find((p) => p.id === id)?.bpm ?? 124;

  root.className = 'border-b border-zinc-900 py-16';
  root.innerHTML = `
    <div class="mx-auto max-w-6xl px-4">
      <span class="text-xs font-bold uppercase tracking-widest text-amber-500">Estudio Rítmico</span>
      <h2 id="video-title" class="mt-2 text-3xl font-extrabold tracking-tight text-zinc-50 sm:text-4xl">
        Exporta tu estudio <span class="text-amber-400">en vídeo</span>
      </h2>
      <p class="mt-3 text-zinc-400">Visualizador 2D sincronizado al AudioContext + MediaRecorder. 100% en el navegador.</p>

      <div class="mt-6 grid gap-4 sm:grid-cols-3">
        <div class="rounded-3xl glass p-4">
          <label class="text-xs font-black uppercase tracking-wide text-zinc-400" for="vp-pattern">Patrón</label>
          <select id="vp-pattern" data-vp-pattern class="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
            ${PATTERNS.map((p) => `<option value="${p.id}" ${p.id === patternId ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="rounded-3xl glass p-4">
          <label class="text-xs font-black uppercase tracking-wide text-zinc-400" for="vp-style">Estilo visual</label>
          <select id="vp-style" data-vp-style class="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
            <option value="barras" selected>Barras</option>
            <option value="ondas-circulares">Ondas circulares</option>
            <option value="anillos-reactivos">Anillos reactivos</option>
          </select>
        </div>
        <div class="rounded-3xl glass p-4">
          <span class="text-xs font-black uppercase tracking-wide text-zinc-400">Stems visibles</span>
          <div data-vp-stems class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            ${stemIds.map((id) => {
              const d = DRUMS.find((x) => x.id === id);
              return `<label class="flex items-center gap-1 text-zinc-400">
                <input type="checkbox" data-vp-stem="${id}" checked class="accent-amber-500" />
                <span style="color:${d?.color}">${d?.name ?? id}</span>
              </label>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="mt-4 rounded-3xl glass p-2">
        <canvas data-vp-canvas width="960" height="320" class="w-full rounded-2xl bg-zinc-950" aria-label="Visualizador rítmico"></canvas>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" data-vp-record class="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-zinc-950 transition-all hover:bg-amber-400">
          ⏺ Grabar vídeo
        </button>
        <button type="button" data-vp-stop disabled class="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-3 text-sm font-bold text-zinc-300 transition-colors hover:bg-zinc-700">
          ■ Detener
        </button>
        <span data-vp-status role="status" aria-live="polite" class="text-xs text-zinc-500"></span>
      </div>
    </div>`;

  const canvas = root.querySelector('[data-vp-canvas]');
  const status = root.querySelector('[data-vp-status]');
  const recordBtn = root.querySelector('[data-vp-record]');
  const stopBtn = root.querySelector('[data-vp-stop]');
  const patternSel = root.querySelector('[data-vp-pattern]');
  const styleSel = root.querySelector('[data-vp-style]');
  const stemChecks = [...root.querySelectorAll('[data-vp-stem]')];

  let visualizer = null;
  let recorder = null;
  let audioDest = null;
  let videoStream = null;
  let chunks = [];
  let recording = false;
  let maxTimer = null;
  let mime = '';

  // Los controles se bloquean durante la toma: cambiarlos en caliente
  // reiniciaría el visualizador y dejaría el canvas congelado.
  function setControlsDisabled(disabled) {
    recordBtn.disabled = disabled;
    stopBtn.disabled = !disabled;
    patternSel.disabled = disabled;
    styleSel.disabled = disabled;
    for (const chk of stemChecks) chk.disabled = disabled;
  }

  function syncStems() {
    for (const chk of stemChecks) {
      stemVisibility[chk.dataset.vpStem] = chk.checked;
    }
  }

  // El estilo sí se puede cambiar en caliente sin tocar el audio.
  styleSel.addEventListener('change', () => {
    style = styleSel.value;
    visualizer?.setStyle(style);
  });

  // Patrón y stems solo aplican a la próxima grabación.
  patternSel.addEventListener('change', () => {
    patternId = patternSel.value;
  });
  for (const chk of stemChecks) chk.addEventListener('change', syncStems);

  function cleanupStreams() {
    audioDest?.stream.getTracks().forEach((t) => t.stop());
    audioDest = null;
    videoStream?.getTracks().forEach((t) => t.stop());
    videoStream = null;
  }

  function clearMaxTimer() {
    if (maxTimer !== null) clearTimeout(maxTimer);
    maxTimer = null;
  }

  recordBtn.addEventListener('click', () => {
    if (recording) return;

    // Detecta capacidades ANTES de tocar la UI: si algo falta, avisa y
    // deja el botón utilizable.
    if (typeof MediaRecorder === 'undefined') {
      status.textContent = 'Este navegador no soporta MediaRecorder.';
      return;
    }
    const chosenMime = pickMime();
    if (chosenMime === null) {
      status.textContent = 'Este navegador no soporta grabación WebM.';
      return;
    }
    if (typeof canvas.captureStream !== 'function') {
      status.textContent = 'Este navegador no soporta captura de canvas.';
      return;
    }
    const ctx = getContext?.();
    if (!ctx) {
      status.textContent = 'No se pudo iniciar el audio.';
      return;
    }

    mime = chosenMime;
    recording = true;
    setControlsDisabled(true);
    status.textContent = 'Grabando vídeo…';

    // Audio capturado por un MediaStreamDestination conectado al master.
    audioDest = ctx.createMediaStreamDestination();
    engine.connectOutput(audioDest);

    videoStream = canvas.captureStream(30);
    const merged = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks()
    ]);

    chunks = [];
    try {
      recorder = new MediaRecorder(merged, mime ? { mimeType: mime } : undefined);
    } catch (err) {
      cleanupStreams();
      engine.disconnectOutput(audioDest);
      recording = false;
      setControlsDisabled(false);
      status.textContent = 'No se pudo iniciar la grabación.';
      return;
    }

    visualizer = createVisualizer({
      patternId,
      bpm: bpmFor(patternId),
      swing: 40,
      getContext,
      canvas,
      stemVisibility,
      style,
      engine
    });
    visualizer.start();

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      clearMaxTimer();
      const blob = new Blob(chunks, { type: mime.split(';')[0] || 'video/webm' });
      chunks = [];
      if (blob.size) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ritmo-nama-${patternId}-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // El revoke se difiere: hacerlo al instante puede cancelar la descarga.
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        status.textContent = `Vídeo descargado ✓ (${(blob.size / 1048576).toFixed(1)} MB)`;
      } else {
        status.textContent = 'La grabación quedó vacía.';
      }
      visualizer?.stop();
      engine.disconnectOutput(audioDest);
      cleanupStreams();
      recorder = null;
      recording = false;
      setControlsDisabled(false);
    };
    recorder.onerror = () => {
      status.textContent = 'Error de grabación.';
    };

    recorder.start();
    clearMaxTimer();
    maxTimer = setTimeout(() => {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    }, MAX_SEC * 1000);
  });

  stopBtn.addEventListener('click', () => {
    clearMaxTimer();
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  });

  return {
    destroy() {
      clearMaxTimer();
      visualizer?.destroy();
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      engine.disconnectOutput(audioDest);
      cleanupStreams();
    }
  };
}
