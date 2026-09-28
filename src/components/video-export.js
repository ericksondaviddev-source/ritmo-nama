import { PATTERNS } from '../data/patterns.js';
import { DRUMS } from '../data/drums.js';
import { createVisualizer } from '../core/audio/visualizer.js';

export function mountVideoExport(root, { engine, getContext }) {
  if (!root) return null;
  if (!engine) return null;

  const stemIds = DRUMS.map((d) => d.id);
  const stemVisibility = Object.fromEntries(stemIds.map((id) => [id, true]));
  const [style, setStyle] = ['barras'];
  const [patternId, setPatternId] = ['guaira-tradicional'];

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
          <label class="text-xs font-black uppercase tracking-wide text-zinc-400">Patrón</label>
          <select data-vp-pattern class="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
            ${PATTERNS.map((p) => `<option value="${p.id}" ${p.id === patternId ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="rounded-3xl glass p-4">
          <label class="text-xs font-black uppercase tracking-wide text-zinc-400">Estilo visual</label>
          <select data-vp-style class="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
            <option value="barras" ${style === 'barras' ? 'selected' : ''}>Barras</option>
            <option value="ondas-circulares" ${style === 'ondas-circulares' ? 'selected' : ''}>Ondas circulares</option>
            <option value="anillos-reactivos" ${style === 'anillos-reactivos' ? 'selected' : ''}>Anillos reactivos</option>
          </select>
        </div>
        <div class="rounded-3xl glass p-4">
          <label class="text-xs font-black uppercase tracking-wide text-zinc-400">Stems visibles</label>
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
        <button type="button" data-vp-stop disabled class="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-3 text-sm font-bold text-zinc-300 transition-colors hover:bg-zinc-700" disabled>
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

  function getVisibleStems() {
    return stemIds.filter((id) => stemVisibility[id]);
  }

  function updateStems() {
    for (const chk of stemChecks) {
      stemVisibility[chk.dataset.vpStem] = chk.checked;
    }
    if (visualizer) visualizer.stop();
    visualizer = createVisualizer({
      patternId, bpm: PATTERNS.find((p) => p.id === patternId)?.bpm ?? 124,
      swing: 40, getContext, canvas, stemVisibility, style
    });
  }

  patternSel.addEventListener('change', () => {
    setPatternId(patternSel.value);
    updateStems();
  });
  styleSel.addEventListener('change', () => {
    setStyle(styleSel.value);
    updateStems();
  });
  for (const chk of stemChecks) {
    chk.addEventListener('change', updateStems);
  }

  recordBtn.addEventListener('click', async () => {
    if (recording) return;
    recording = true;
    status.textContent = 'Renderizando vídeo…';
    recordBtn.disabled = true;
    stopBtn.disabled = false;

    // Inicia visualizador
    visualizer = createVisualizer({
      patternId,
      bpm: PATTERNS.find((p) => p.id === patternId)?.bpm ?? 124,
      swing: 40, getContext, canvas, stemVisibility, style
    });
    visualizer.start();

    // Audio dest para capturar el sonido
    const ctx = getContext?.();
    if (ctx && typeof ctx.createMediaStreamDestination === 'function') {
      audioDest = ctx.createMediaStreamDestination();
      engine.connectOutput(audioDest);
    }

    // Video stream del canvas
    videoStream = canvas.captureStream(30);

    // Mergir streams
    const audioTracks = audioDest?.stream.getAudioTracks() ?? [];
    const mergedStream = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks]);

    const mime = ['video/webm;codecs=vp9,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    chunks = [];
    recorder = new MediaRecorder(mergedStream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(';')[0] || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ritmo-nama-${patternId}-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      status.textContent = 'Vídeo descargado ✓';
      recording = false;
      recordBtn.disabled = false;
      stopBtn.disabled = true;
      visualizer?.stop();
      engine.disconnectOutput(audioDest);
      audioDest?.stream.getTracks().forEach((t) => t.stop());
      audioDest = null;
    };

    recorder.start();
    status.textContent = 'Grabando vídeo… (30 s máx)';
    setTimeout(() => {
      if (recording && recorder?.state !== 'inactive') {
        recorder.stop();
      }
    }, 30000);
  });

  stopBtn.addEventListener('click', () => {
    if (recorder?.state !== 'inactive') recorder.stop();
  });

  return {
    destroy() {
      visualizer?.destroy();
      if (recorder?.state !== 'inactive') recorder.stop();
      audioDest?.stream.getTracks().forEach((t) => t.stop());
      videoStream?.getTracks().forEach((t) => t.stop());
    }
  };
}
