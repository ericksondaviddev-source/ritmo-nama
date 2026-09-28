// Visualizador 2D sincronizado al reloj de AudioContext.
// Dispara el patrón real a través del engine y dibuja todos los stems
// activos del step en curso, filtrando por los stems visibles.
import { createScheduler } from './scheduler.js';
import { stepDurationSec } from './timing.js';
import { PATTERNS } from '../../data/patterns.js';
import { DRUMS } from '../../data/drums.js';

const DRUM_BY_ID = new Map(DRUMS.map((d) => [d.id, d]));

export function createVisualizer({
  patternId,
  bpm,
  swing = 40,
  getContext,
  canvas,
  stemVisibility,
  style = 'barras',
  engine = null
}) {
  const pattern = PATTERNS.find((p) => p.id === patternId);
  if (!pattern || !canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const audioCtx = getContext?.();
  const stepSec = stepDurationSec(bpm || pattern.bpm || 124);

  // Fila por step: todos los stems que suenan en ese step (o []).
  const hitMap = Array.from({ length: 12 }, (_, step) =>
    Object.keys(pattern.steps)
      .filter((stemId) => pattern.steps[stemId]?.[step])
      .map((stemId) => ({
        stemId,
        color: DRUM_BY_ID.get(stemId)?.color ?? '#f43f5e',
        accent: Boolean(pattern.accents?.[stemId]?.[step])
      }))
  );

  const visible = (id) => stemVisibility?.[id] !== false;

  let running = false;
  let animFrame = null;
  let scheduler = null;
  // Cola de steps agendados: { step, time, fired }.
  // onStep se adelanta ~100 ms, así que el audio se programa a futuro pero
  // el dibujo solo avanza cuando ctx.currentTime alcanza ese instante.
  let queue = [];
  let activeStep = -1;
  let stepStartAt = 0;

  function triggerStep(step, time) {
    if (!engine) return;
    // El filtro de stems manda también sobre el audio: si un stem no se ve,
    // tampoco debe oírse. Si no, el vídeo sería incoherente.
    for (const hit of hitMap[step]) {
      if (!visible(hit.stemId)) continue;
      engine.trigger(hit.stemId, { time, accent: hit.accent });
    }
  }

  function advanceQueue(now) {
    let advanced = false;
    while (queue.length && queue[0].time <= now) {
      const due = queue.shift();
      activeStep = due.step;
      stepStartAt = due.time;
      advanced = true;
    }
    // Evita que el primer fotograma dibuje un step en blanco.
    if (!queue.length && advanced && !stepStartAt) stepStartAt = now;
  }

  function drawFrame() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;

    if (running) {
      const now = audioCtx ? audioCtx.currentTime : performance.now() / 1000;
      advanceQueue(now);
      const progress = Math.min(Math.max((now - stepStartAt) / stepSec, 0), 1);

      for (let i = 0; i < 12; i++) {
        const stepIdx = (activeStep - 11 + i + 12) % 12;
        const hits = hitMap[stepIdx].filter((hit) => visible(hit.stemId));
        const isNow = stepIdx === activeStep;
        const color = hits[0]?.color ?? '#3f3f46';

        if (style === 'barras') {
          const barW = (w - 24) / 12;
          const x = 12 + i * barW;
          const barH = isNow ? 40 + progress * (h - 80) : 4;
          ctx.fillStyle = color;
          ctx.globalAlpha = isNow ? 0.9 : hits.length ? 0.3 : 0.12;
          ctx.fillRect(x, cy + 40 - barH, barW - 2, barH);
        } else {
          // Ondas circulares / anillos: un anillo por cada stem visible.
          hits.forEach((hit, n) => {
            if (style === 'anillos-reactivos' && !isNow) return;
            const spread = 1 + n * 0.35;
            const r = (isNow ? (20 + progress * (Math.min(w, h) / 2 - 40)) * spread : 14 + n * 10);
            const alpha = isNow ? (1 - progress) * 0.8 : 0.14;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = hit.color;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = hit.accent ? 4 : 2;
            ctx.stroke();
          });
        }
      }
      ctx.globalAlpha = 1;
    }
    animFrame = requestAnimationFrame(drawFrame);
  }

  function start() {
    if (running) return;
    if (!audioCtx) return;
    queue = [];
    activeStep = -1;
    stepStartAt = 0;
    scheduler = createScheduler({
      getContext,
      bpm: bpm || pattern.bpm || 124,
      swing,
      onStep(step, time) {
        // El audio se agenda con precisión de sample; el video, no.
        triggerStep(step, time);
        queue.push({ step, time });
      }
    });
    running = true;
    scheduler.start();
    animFrame = requestAnimationFrame(drawFrame);
  }

  function stop() {
    scheduler?.stop();
    scheduler = null;
    running = false;
    queue = [];
    activeStep = -1;
    if (animFrame !== null) cancelAnimationFrame(animFrame);
    animFrame = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return {
    start,
    stop,
    /** Cambia el estilo en caliente sin reiniciar la grabación. */
    setStyle(next) {
      style = next;
    },
    get isRunning() {
      return running;
    },
    destroy: stop
  };
}
