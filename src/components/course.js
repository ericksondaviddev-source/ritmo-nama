import { PATTERNS } from '../data/patterns.js';
import { COURSE, COURSE_INTRO, COURSE_QUIZ } from '../data/course.js';
import { ARTICULATIONS } from '../data/drums.js';
import { playSoloLoop } from '../core/audio/loop.js';
import { reclamar } from '../core/audio/transport.js';
import {
  cargarProgreso,
  guardarProgreso,
  marcarVista,
  marcarPatron,
  registrarQuiz,
  reiniciarProgreso,
  resumenProgreso
} from '../core/course-progress.js';

function hitsDe(mod) {
  const pattern = PATTERNS.find((p) => p.id === mod.patternId);
  return pattern.steps[mod.instrument]
    .map((h, i) => (h ? i : null))
    .filter((i) => i !== null);
}

function patternStrip(mod) {
  const pattern = PATTERNS.find((p) => p.id === mod.patternId);
  const steps = pattern.steps[mod.instrument];
  const accents = pattern.accents[mod.instrument];
  const artic = ARTICULATIONS[mod.articulation] ?? ARTICULATIONS.laurel;
  return `
    <div class="flex gap-1 rounded-xl p-1 ring-1 ring-transparent transition-all" data-strip="${mod.instrument}" aria-label="Patrón de ${mod.title}: 12 pasos en 6/8">
      ${steps
        .map(
          (hit, i) => `
        <button
          type="button"
          data-cell="${i}"
          disabled
          class="h-8 flex-1 rounded-md transition-colors ${hit ? (accents[i] ? 'bg-amber-400' : 'bg-amber-500/60') : 'bg-zinc-800'}"
          title="Paso ${i + 1}${hit ? (accents[i] ? ' · acento' : ' · golpe') : ' · silencio'}"
          aria-label="Paso ${i + 1}"
        ></button>`
        )
        .join('')}
    </div>
    <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
      <p class="text-[11px] text-zinc-600">12 pasos · 6/8 · <span class="text-amber-500/80">■</span> acento · <span class="text-zinc-500">${artic.label}</span></p>
      <p class="text-[11px] font-bold" data-practice-status="${mod.instrument}"></p>
    </div>`;
}

function tarjeta(mod, indice) {
  const patrones = PATTERNS.find((p) => p.id === mod.patternId);
  return `
    <article data-module="${mod.instrument}" class="relative rounded-3xl glass p-6 transition-colors">
      <span data-done="${mod.instrument}" class="absolute right-4 top-4 hidden rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-black text-emerald-400">✓ vista</span>
      <div class="flex items-center gap-3">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-sm font-black text-amber-400">${String(indice + 1).padStart(2, '0')}</span>
        <h3 class="text-xl font-extrabold text-zinc-100">${mod.title}</h3>
      </div>
      <p class="mt-3 text-sm leading-relaxed text-zinc-400">${mod.concepto}</p>
      <div class="mt-4 flex items-center gap-2">
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
          aria-pressed="false"
          aria-label="Escuchar la narración de ${mod.title}"
          class="shrink-0 rounded-full bg-zinc-800 p-3.5 text-lg text-zinc-300 transition-all hover:bg-zinc-700 hover:text-zinc-100"
        >
          <span aria-hidden="true">🔊</span>
        </button>
        <button
          type="button"
          data-course-practice="${mod.instrument}"
          aria-pressed="false"
          aria-label="Practicar el patrón de ${mod.title} paso a paso"
          class="shrink-0 rounded-full bg-zinc-800 px-4 py-3 text-xs font-bold text-zinc-300 transition-all hover:bg-zinc-700 hover:text-zinc-100"
        >
          🎯 Practicar
        </button>
      </div>
      <div class="mt-4 rounded-2xl bg-zinc-900/60 p-4">
        <h4 class="text-xs font-black uppercase tracking-wide text-zinc-500">Cómo tocarlo</h4>
        <p class="mt-1.5 text-sm leading-relaxed text-zinc-400">${mod.tecnica}</p>
      </div>
      <div class="mt-4">${patternStrip(mod)}</div>
      <p class="mt-3 text-[11px] leading-relaxed text-zinc-600">${patrones.bpm} BPM · práctica: toca los pasos resaltados en orden</p>
    </article>`;
}

function plantilla() {
  return `
    <div class="mx-auto max-w-6xl px-4">
      <div class="max-w-2xl">
        <span class="text-xs font-bold uppercase tracking-widest text-amber-500">Mini-curso</span>
        <h2 id="course-title" class="mt-2 text-3xl font-extrabold tracking-tight text-zinc-50 sm:text-4xl">
          Aprende la fulia <span class="text-amber-400">tambor por tambor</span>
        </h2>
        <p class="mt-3 text-zinc-400">La fulia son cuatro tambores. Aquí está qué hace cada uno, cómo se toca con laurel y con la mano, y el patrón que lo respalda. Tu avance queda guardado en este navegador.</p>
      </div>

      <section class="mt-8 rounded-3xl glass p-6">
        <h3 class="text-lg font-extrabold text-zinc-100">${COURSE_INTRO.titulo}</h3>
        <p class="mt-2 text-sm leading-relaxed text-zinc-400">${COURSE_INTRO.intro}</p>
      </section>

      <div class="mt-6 flex items-center gap-4">
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuemin="0" aria-valuemax="9" aria-label="Progreso del minicurso">
          <div data-progress-fill class="h-full w-0 rounded-full bg-amber-500 transition-all duration-500"></div>
        </div>
        <span data-progress-text class="whitespace-nowrap text-xs font-bold text-zinc-400">0 de 9</span>
        <button type="button" data-progress-reset class="whitespace-nowrap text-[11px] uppercase tracking-wider text-zinc-600 transition-colors hover:text-zinc-400">Reiniciar</button>
      </div>

      <div class="mt-8 grid gap-4 sm:grid-cols-2">
        ${COURSE.map(tarjeta).join('')}
      </div>

      <section class="mt-8 rounded-3xl glass p-6" data-quiz>
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="max-w-xl">
            <span class="text-xs font-bold uppercase tracking-widest text-amber-500">Reto de oído</span>
            <h3 class="mt-1 text-lg font-extrabold text-zinc-100">${COURSE_QUIZ.titulo}</h3>
            <p class="mt-2 text-sm leading-relaxed text-zinc-400">${COURSE_QUIZ.intro}</p>
          </div>
          <p class="text-xs font-bold text-zinc-500" data-quiz-best></p>
        </div>
        <div class="mt-5" data-quiz-stage></div>
      </section>
    </div>`;
}

export function mountCourse(root, { engine } = {}) {
  if (!root) return null;

  root.className = 'border-b border-zinc-900 py-16';
  root.innerHTML = plantilla();

  let progreso = cargarProgreso();
  let active = null;
  let activeInstrument = null;
  let vistaTimer = null;
  const narrations = {};
  const practicando = new Set();
  const practica = new Map();

  const fill = root.querySelector('[data-progress-fill]');
  const progressText = root.querySelector('[data-progress-text]');
  const quizBest = root.querySelector('[data-quiz-best]');
  const quizStage = root.querySelector('[data-quiz-stage]');
  const progressBar = fill?.parentElement;

  for (const mod of COURSE) {
    const audio = new Audio(`/assets/audio/course/${mod.instrument}.mp3`);
    audio.preload = 'auto';
    narrations[mod.instrument] = audio;
    practica.set(mod.instrument, { pendientes: hitsDe(mod) });
  }

  function guardar() {
    guardarProgreso(progreso);
  }

  function pintar() {
    const r = resumenProgreso(progreso);
    if (fill) fill.style.width = `${r.pct}%`;
    if (progressText) progressText.textContent = `${r.completados} de ${r.total}`;
    if (progressBar) progressBar.setAttribute('aria-valuenow', String(r.completados));
    if (quizBest) {
      quizBest.textContent = r.quizHecho ? COURSE_QUIZ.mejor(r.quizMejor) : '';
    }
    for (const mod of COURSE) {
      const visto = r.vistas > 0 && progreso.vistas.includes(mod.instrument);
      root.querySelector(`[data-done="${mod.instrument}"]`)?.classList.toggle('hidden', !visto);
      const estado = root.querySelector(`[data-practice-status="${mod.instrument}"]`);
      if (estado) {
        if (progreso.patrones.includes(mod.instrument)) {
          estado.textContent = '✓ patrón dominado';
          estado.className = 'text-[11px] font-bold text-emerald-400';
        } else if (practicando.has(mod.instrument)) {
          const p = practica.get(mod.instrument);
          const total = hitsDe(mod).length;
          estado.textContent = `práctica: ${total - p.pendientes.length}/${total}`;
          estado.className = 'text-[11px] font-bold text-amber-400';
        } else {
          estado.textContent = '';
        }
      }
    }
  }

  function marcarVistaSiNueva(instrument) {
    if (progreso.vistas.includes(instrument)) return;
    progreso = marcarVista(progreso, instrument);
    guardar();
    pintar();
  }

  function stopActive() {
    if (vistaTimer) {
      clearTimeout(vistaTimer);
      vistaTimer = null;
    }
    active?.stop();
    active = null;
    const prev = activeInstrument ? root.querySelector(`[data-course-play="${activeInstrument}"]`) : null;
    if (prev) prev.setAttribute('aria-pressed', 'false');
    activeInstrument = null;
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
        vistaTimer = setTimeout(() => marcarVistaSiNueva(mod.instrument), 4000);
      } else {
        transporte.release();
      }
    });

    const nBtn = root.querySelector(`[data-course-narration="${mod.instrument}"]`);
    nBtn.addEventListener('click', () => {
      const audio = narrations[mod.instrument];
      if (!audio) return;
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
        nBtn.setAttribute('aria-pressed', 'false');
        return;
      }
      stopActive();
      transporte.start();
      audio.play().catch(() => {});
      nBtn.setAttribute('aria-pressed', 'true');
      audio.addEventListener(
        'ended',
        () => {
          nBtn.setAttribute('aria-pressed', 'false');
          marcarVistaSiNueva(mod.instrument);
          transporte.release();
        },
        { once: true }
      );
    });
  }

  for (const mod of COURSE) {
    const pBtn = root.querySelector(`[data-course-practice="${mod.instrument}"]`);
    const strip = root.querySelector(`[data-strip="${mod.instrument}"]`);
    const cells = [...strip.querySelectorAll('[data-cell]')];
    for (const cell of cells) cell.dataset.orig = cell.className;

    pBtn.addEventListener('click', () => {
      const activo = practicando.has(mod.instrument);
      stopActive();
      if (activo) {
        practicando.delete(mod.instrument);
        pBtn.setAttribute('aria-pressed', 'false');
        strip.classList.remove('ring-amber-500/40');
        cells.forEach((c) => {
          c.disabled = true;
          c.className = c.dataset.orig;
        });
        pintar();
        return;
      }
      practicando.add(mod.instrument);
      pBtn.setAttribute('aria-pressed', 'true');
      strip.classList.add('ring-amber-500/40');
      practica.set(mod.instrument, { pendientes: hitsDe(mod) });
      cells.forEach((c) => {
        c.disabled = false;
        c.className = c.dataset.orig;
      });
      pintar();
    });

    cells.forEach((cell) => {
      cell.addEventListener('click', () => {
        if (!practicando.has(mod.instrument)) return;
        const idx = Number(cell.dataset.cell);
        const pattern = PATTERNS.find((p) => p.id === mod.patternId);
        const esGolpe = Boolean(pattern.steps[mod.instrument][idx]);
        const p = practica.get(mod.instrument);
        const esperado = p.pendientes[0];

        if (esGolpe && idx === esperado) {
          engine?.trigger(mod.instrument, {
            accent: Boolean(pattern.accents[mod.instrument][idx]),
            articulation: mod.articulation
          });
          cell.className = `${cell.dataset.orig} !bg-emerald-500`;
          p.pendientes.shift();
          if (p.pendientes.length === 0) {
            let cambió = false;
            if (!progreso.patrones.includes(mod.instrument)) {
              progreso = marcarPatron(progreso, mod.instrument);
              cambió = true;
            }
            if (!progreso.vistas.includes(mod.instrument)) {
              progreso = marcarVista(progreso, mod.instrument);
              cambió = true;
            }
            if (cambió) guardar();
            practicando.delete(mod.instrument);
            pBtn.setAttribute('aria-pressed', 'false');
            strip.classList.remove('ring-amber-500/40');
            cells.forEach((c) => {
              c.disabled = true;
              if (c.className.includes('emerald')) return;
              c.className = c.dataset.orig;
            });
          }
          pintar();
        } else if (esGolpe) {
          cell.className = `${cell.dataset.orig} !bg-rose-500`;
          setTimeout(() => {
            cell.className = cell.dataset.orig;
          }, 300);
        } else {
          engine?.trigger(mod.instrument, { accent: false, articulation: mod.articulation });
          cell.className = `${cell.dataset.orig} !bg-rose-500/60`;
          setTimeout(() => {
            cell.className = cell.dataset.orig;
          }, 300);
        }
      });
    });
  }

  root.querySelector('[data-progress-reset]').addEventListener('click', () => {
    stopActive();
    transporte.release();
    progreso = reiniciarProgreso();
    practicando.clear();
    for (const mod of COURSE) {
      const pBtn = root.querySelector(`[data-course-practice="${mod.instrument}"]`);
      const strip = root.querySelector(`[data-strip="${mod.instrument}"]`);
      pBtn.setAttribute('aria-pressed', 'false');
      strip.classList.remove('ring-amber-500/40');
      practica.set(mod.instrument, { pendientes: hitsDe(mod) });
      strip.querySelectorAll('[data-cell]').forEach((c) => {
        c.disabled = true;
        c.className = c.dataset.orig;
      });
    }
    quiz = null;
    pintar();
    pintarQuiz();
  });

  let quiz = null;

  function pintarQuiz() {
    if (!quizStage) return;
    if (!quiz) {
      quizStage.innerHTML = `
        <button type="button" data-quiz-start class="rounded-full bg-amber-500 px-6 py-3 text-sm font-black text-zinc-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400">
          ${COURSE_QUIZ.boton}
        </button>`;
      quizStage.querySelector('[data-quiz-start]').addEventListener('click', quizRondas);
      return;
    }
    if (quiz.terminado) {
      quizStage.innerHTML = `
        <div class="flex flex-wrap items-center gap-4">
          <p class="text-lg font-extrabold text-zinc-100">${COURSE_QUIZ.fin(quiz.aciertos, quiz.orden.length)}</p>
          <button type="button" data-quiz-retry class="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-black text-zinc-950 transition-all hover:bg-amber-400">${COURSE_QUIZ.otraRonda}</button>
        </div>`;
      quizStage.querySelector('[data-quiz-retry]').addEventListener('click', quizRondas);
      return;
    }
    const mod = COURSE.find((m) => m.instrument === quiz.orden[quiz.ronda]);
    const ronda = COURSE_QUIZ.ronda
      .replace('{n}', String(quiz.ronda + 1))
      .replace('{total}', String(quiz.orden.length));
    if (quiz.respuesta) {
      const acierto = quiz.respuesta === quiz.orden[quiz.ronda];
      quizStage.innerHTML = `
        <p class="text-sm font-bold ${acierto ? 'text-emerald-400' : 'text-rose-400'}">${acierto ? COURSE_QUIZ.acierto : COURSE_QUIZ.error(mod.title)}</p>
        <button type="button" data-quiz-next class="mt-3 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-black text-zinc-950 transition-all hover:bg-amber-400">Siguiente</button>`;
      quizStage.querySelector('[data-quiz-next]').addEventListener('click', quizSiguiente);
      return;
    }
    quizStage.innerHTML = `
      <p class="text-xs font-bold uppercase tracking-widest text-zinc-500">${ronda}</p>
      <p class="mt-1 text-lg font-extrabold text-zinc-100">${COURSE_QUIZ.pregunta}</p>
      <div class="mt-3 flex flex-wrap gap-2">
        ${COURSE.map(
          (m) => `
          <button type="button" data-quiz-answer="${m.instrument}" class="rounded-full bg-zinc-800 px-5 py-2.5 text-sm font-bold text-zinc-200 transition-all hover:bg-zinc-700 hover:text-white">${m.title}</button>`
        ).join('')}
      </div>`;
    for (const b of quizStage.querySelectorAll('[data-quiz-answer]')) {
      b.addEventListener('click', () => quizResponder(b.dataset.quizAnswer));
    }
  }

  function quizRondas() {
    stopActive();
    transporte.start();
    quiz = {
      orden: [...COURSE.map((m) => m.instrument)].sort(() => Math.random() - 0.5),
      ronda: 0,
      aciertos: 0,
      respuesta: null,
      terminado: false
    };
    quizSonar();
  }

  function quizSonar() {
    const mod = COURSE.find((m) => m.instrument === quiz.orden[quiz.ronda]);
    stopActive();
    transporte.start();
    active = playSoloLoop({
      engine,
      patternId: mod.patternId,
      drumId: mod.instrument,
      articulation: mod.articulation
    });
    if (active) activeInstrument = mod.instrument;
    quiz.respuesta = null;
    pintarQuiz();
  }

  function quizResponder(instrument) {
    if (!quiz || quiz.respuesta || quiz.terminado) return;
    quiz.respuesta = instrument;
    if (instrument === quiz.orden[quiz.ronda]) quiz.aciertos += 1;
    stopActive();
    pintarQuiz();
  }

  function quizSiguiente() {
    quiz.ronda += 1;
    if (quiz.ronda >= quiz.orden.length) {
      quiz.terminado = true;
      stopActive();
      transporte.release();
      progreso = registrarQuiz(progreso, quiz.aciertos, quiz.orden.length);
      guardar();
      pintar();
      pintarQuiz();
      return;
    }
    quizSonar();
  }

  pintar();
  pintarQuiz();

  return {
    destroy() {
      if (vistaTimer) clearTimeout(vistaTimer);
      transporte.release();
      stopActive();
    }
  };
}
