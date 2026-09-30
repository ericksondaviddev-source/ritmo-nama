import { PATTERNS } from '../data/patterns.js';
import { COURSE, COURSE_INTRO } from '../data/course.js';
import { ARTICULATIONS } from '../data/drums.js';
import { playSoloLoop } from '../core/audio/loop.js';
import { reclamar } from '../core/audio/transport.js';

function patternStrip(mod) {
  const pattern = PATTERNS.find((p) => p.id === mod.patternId);
  const steps = pattern.steps[mod.instrument];
  const accents = pattern.accents[mod.instrument];
  const artic = ARTICULATIONS[mod.articulation] ?? ARTICULATIONS.laurel;
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
    <p class="mt-1 text-[11px] text-zinc-600">12 pasos · métrica 6/8 · <span class="text-amber-500/80">■</span> acento</p>
    <p class="mt-0.5 text-[11px] text-zinc-600" title="${artic.hint}">Se toca: <span class="text-zinc-400">${artic.label}</span></p>`;
}

export function mountCourse(root, { engine } = {}) {
  if (!root) return null;

  root.className = 'border-b border-zinc-900 py-16';
  root.innerHTML = `
    <div class="mx-auto max-w-6xl px-4">
      <div class="max-w-2xl">
        <span class="text-xs font-bold uppercase tracking-widest text-amber-500">Mini-curso</span>
        <h2 id="course-title" class="mt-2 text-3xl font-extrabold tracking-tight text-zinc-50 sm:text-4xl">
          Aprende la fulia <span class="text-amber-400">tambor por tambor</span>
        </h2>
        <p class="mt-3 text-zinc-400">La fulia son cuatro tambores. Aquí está qué hace cada uno, cómo se toca con laurel y con la mano, y el patrón que lo respalda.</p>
      </div>

      <section class="mt-8 rounded-3xl glass p-6">
        <h3 class="text-lg font-extrabold text-zinc-100">${COURSE_INTRO.titulo}</h3>
        <p class="mt-2 text-sm leading-relaxed text-zinc-400">${COURSE_INTRO.intro}</p>
      </section>

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
              <button
                type="button"
                data-course-narration="${mod.instrument}"
                aria-label="Escuchar la narración de ${mod.title}"
                class="shrink-0 rounded-full bg-zinc-800 p-3.5 text-lg text-zinc-300 transition-all hover:bg-zinc-700 hover:text-zinc-100"
              >
                <span aria-hidden="true">🔊</span>
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
  const narrations = {};

  for (const mod of COURSE) {
    const audio = new Audio(`/assets/audio/course/${mod.instrument}.mp3`);
    audio.preload = 'auto';
    narrations[mod.instrument] = audio;
  }

  function stopActive() {
    active?.stop();
    active = null;
    const prev = root.querySelector(`[data-course-play="${activeInstrument}"]`);
    if (prev) prev.setAttribute('aria-pressed', 'false');
    activeInstrument = null;
    // La narración también se para. Antes esta función estaba duplicada y la
    // segunda pisaba a la primera, así que al detener un loop la voz seguía
    // sonando encima: dos audios a la vez y un botón que mintió.
    for (const mod of COURSE) {
      const audio = narrations[mod.instrument];
      if (audio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
      const btn = root.querySelector(`[data-course-narration="${mod.instrument}"]`);
      if (btn) btn.setAttribute('aria-pressed', 'false');
    }
  }

  // Un solo loop sonando: si arranca el Midipad o una grabación, éste se para.
  const transporte = reclamar({ stop: stopActive });

  for (const mod of COURSE) {
    const btn = root.querySelector(`[data-course-play="${mod.instrument}"]`);
    btn.addEventListener('click', () => {
      if (activeInstrument === mod.instrument) {
        stopActive();
        transporte.release();
        return;
      }
      stopActive();
      transporte.start();
      active = playSoloLoop({
        engine,
        patternId: mod.patternId,
        drumId: mod.instrument,
        articulation: mod.articulation
      });
      if (active) {
        activeInstrument = mod.instrument;
        btn.setAttribute('aria-pressed', 'true');
      } else {
        transporte.release();
      }
    });
    const nBtn = root.querySelector(`[data-course-narration="${mod.instrument}"]`);
    nBtn.addEventListener('click', () => {
      const audio = narrations[mod.instrument];
      if (!audio) return;
      if (!audio.paused) { audio.pause(); audio.currentTime = 0; nBtn.setAttribute('aria-pressed', 'false'); return; }
      audio.play().catch(() => {});
      nBtn.setAttribute('aria-pressed', 'true');
      audio.addEventListener('ended', () => { nBtn.setAttribute('aria-pressed', 'false'); }, { once: true });
    });
  }

  return {
    destroy() {
      transporte.release();
      stopActive();
    }
  };
}
