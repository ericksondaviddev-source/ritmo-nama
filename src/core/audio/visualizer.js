// Visualizador 2D sincronizado al reloj de AudioContext.
// Dibuja barras, ondas circulares o anillos reactivos por cada step activo
// del patrón, filtrando solo los stems visibles.
import { createScheduler } from './scheduler.js';
import { stepDurationSec } from './timing.js';
import { PATTERNS } from '../../data/patterns.js';
import { DRUMS } from '../../data/drums.js';

export function createVisualizer({ patternId, bpm, swing, getContext, canvas, stemVisibility, style }) {
  const pattern = PATTERNS.find((p) => p.id === patternId);
  if (!pattern || !canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let currentStep = -1;
  let running = false;
  let animFrame = null;
  let scheduler = null;
  let lastStepTime = 0;

  const stemIds = pattern.steps ? Object.keys(pattern.steps) : [];
  const visible = (id) => stemVisibility[id] !== false;

  function drawFrame() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;

    if (!running) return;

    const stepMs = stepDurationSec(bpm) * 1000;
    const now = performance.now();
    const elapsed = now - lastStepTime;
    const progress = Math.min(elapsed / stepMs, 1);

    for (let i = 0; i < 12; i++) {
      const stepIdx = (currentStep - 11 + i + 12) % 12;
      const stemId = stemIds[stepIdx % stemIds.length] ?? stemIds[i % stemIds.length];
      if (!stemId || !visible(stemId)) continue;
      const hit = pattern.steps[stemId]?.[stepIdx];
      if (!hit) continue;

      const drum = DRUMS.find((d) => d.id === stemId);
      const color = drum?.color ?? '#f43f5e';

      switch (style) {
        case 'barras': {
          const barW = (w - 24) / 12;
          const x = 12 + i * barW;
          const barH = hit ? 40 + progress * (h - 80) : 4;
          ctx.fillStyle = color;
          ctx.globalAlpha = hit ? 0.9 : 0.25;
          ctx.fillRect(x, cy + 40 - barH, barW - 2, barH);
          break;
        }
        case 'ondas-circulares': {
          const r = 20 + progress * (Math.min(w, h) / 2 - 40);
          const alpha = hit ? (1 - progress) * 0.8 : 0.12;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 2;
          ctx.stroke();
          break;
        }
        case 'anillos-reactivos': {
          if (hit) {
            const radius = 10 + progress * 80;
            const alpha = 1 - progress;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 3;
            ctx.stroke();
          }
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    animFrame = requestAnimationFrame(drawFrame);
  }

  function start() {
    if (running) return;
    const audioCtx = getContext?.();
    if (!audioCtx) return;
    const startTime = audioCtx.currentTime + 0.05;
    lastStepTime = performance.now();
    scheduler = createScheduler({
      getContext,
      bpm,
      swing,
      onStep(step) {
        currentStep = step;
        lastStepTime = performance.now();
      }
    });
    scheduler.start();
    running = true;
    drawFrame();
  }

  function stop() {
    scheduler?.stop();
    scheduler = null;
    running = false;
    cancelAnimationFrame(animFrame);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return {
    start,
    stop,
    get isRunning() {
      return running;
    },
    destroy() {
      stop();
    }
  };
}
