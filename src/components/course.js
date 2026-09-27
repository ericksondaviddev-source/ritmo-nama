import { PATTERNS } from '../data/patterns.js';
import { COURSE } from '../data/course.js';
import { playSoloLoop } from '../core/audio/loop.js';

function patternStrip(mod) {
  const pattern = PATTERNS.find((p) => p.id === mod.patternId);
  const steps = pattern.steps[mod.instrument];
  const accents = pattern.accents[mod.instrument];
  return `
    <div class="flex gap-1" role="img" aria-label="Patrón de ${mod.title}: 12 pasos en 6/8">
      ${steps
        .map(
          (hit, i) => `
        <span
          class="h-3 flex-1 rounded-sm ${hit ? (accents[i] ? 'bg-amber-400' : 'bg-amber-500/60') : 'bg-zinc-800'}"
          title="Paso ${i + 1}${hit ? (accents[i] ? ' · acento' : ' · golpe') : ''}"
        ></span>`
        )
        .join('')}
    </div>
    <p class="mt-1 text-[11px] text-zinc-600">12 pasos · métrica 6/8 · <span class="text-amber-500/80">■</span> acento</p>`;
}

export function mountCourse(root, { engine } = {}) {
  if (!root) return null;

  root.className = 'border-b border-zinc-900 py-16';
  root.innerHTML = `
    <div class="mx-auto max-w-6xl px-4">
      <div class="max-w-2xl">
        <span class="text-xs font-bold uppercase tracking-widest text-amber-500">Mini-curso</span>
        <h2 id="course-title" class="mt-2 text-3xl font-extrabold tracking-tight text-zinc-50 sm:text-4xl">
          Aprende la fulia <span class="text-amber-400">voz por voz</span>
        </h2>
        <p class="mt-3 text-zinc-400">Cuatro módulos para niños: qué hace cada instrumento, cómo tocarlo sin lastimarte y su patrón rítmico.</p>
      </div>

      <div class="mt-8 grid gap-4 sm:grid-cols-2">
        ${COURSE.map(
          (mod) => `
          <article data-module="${mod.instrument}" class="rounded-3xl glass p-6">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-xl font-extrabold text-zinc-100">${mod.title}</h3>
                <p class="mt-2 text-sm leading-relaxed text-zinc-400">${mod.concepto}</p>
              </div>
              <button
                type="button"
                data-course-play="${mod.instrument}"
                aria-pressed="false"
                aria-label="Escuchar el patrón de ${mod.title} en loop"
                class="shrink-0 rounded-full bg-amber-500 p-3.5 text-lg text-zinc-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400"
              >
                <span aria-hidden="true">▶</span>
              </button>
            </div>
            <div class="mt-4 rounded-2xl glass p-4">
              <h4 class="text-xs font-black uppercase tracking-wide text-zinc-400">Cómo tocarlo</h4>
              <p class="mt-1.5 text-sm leading-relaxed text-zinc-400">${mod.tecnica}</p>
            </div>
            <div class="mt-4">${patternStrip(mod)}</div>
          </article>`
        ).join('')}
      </div>
    </div>`;

  let active = null;
  let activeInstrument = null;

  function stopActive() {
    active?.stop();
    active = null;
    const prev = root.querySelector(`[data-course-play="${activeInstrument}"]`);
    if (prev) prev.setAttribute('aria-pressed', 'false');
    activeInstrument = null;
  }

  for (const mod of COURSE) {
    const btn = root.querySelector(`[data-course-play="${mod.instrument}"]`);
    btn.addEventListener('click', () => {
      if (activeInstrument === mod.instrument) {
        stopActive();
        return;
      }
      stopActive();
      active = playSoloLoop({ engine, patternId: mod.patternId, drumId: mod.instrument });
      if (active) {
        activeInstrument = mod.instrument;
        btn.setAttribute('aria-pressed', 'true');
      }
    });
  }

  return {
    destroy() {
      stopActive();
    }
  };
}
