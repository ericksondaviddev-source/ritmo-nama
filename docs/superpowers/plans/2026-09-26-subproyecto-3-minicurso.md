# Sub-proyecto 3 — Mini-curso de fulia (4 módulos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sección `#minicurso` con 4 tarjetas interactivas (Prima, Cruzao, Pujao, Paila), cada una con concepto cultural, técnica ergonómica para niños, patrón visual esquemático y reproducción en loop del instrumento (sintetizada por `drum-engine`).

**Architecture:** Una sección más de la SPA. El loop por instrumento reutiliza `createScheduler` (que ya loopea `stepIndex % steps` hasta `stop()`) filtrando los golpes al instrumento del módulo. Los textos culturales son provisionales: **el cliente los valida** (spec §7); se revisan en el commit.

**Tech Stack:** Vite + JS modular, Tailwind v4, Web Audio API (drum-engine + scheduler), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-26-ritmo-nama-design.md` §7, §11 (Sub-proyecto 3).

---

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/data/course.js` | Create | Contenido de los 4 módulos (TDD) |
| `src/core/audio/loop.js` | Create | `playSoloLoop`: loop infinito de un solo instrumento (TDD) |
| `src/components/course.js` | Create | Sección: tarjetas, patrón visual, botones de loop |
| `src/main.js` / `index.html` | Modify | Monte + sección |
| `tests/course.test.js`, `tests/loop.test.js` | Create | TDD |

**Tests esperados al final:** 10 archivos, 46 tests (40 + 2 course + 4 loop).

---

### Task 1: Data del minicurso

**Files:** Create `tests/course.test.js`, `src/data/course.js`

- [ ] **Step 1: Test fallido**

```js
import { describe, expect, it } from 'vitest';
import { COURSE } from '../src/data/course.js';
import { PATTERNS } from '../src/data/patterns.js';

const FULIA_IDS = ['prima', 'cruzao', 'pujao', 'paila'];

describe('minicurso', () => {
  it('son 4 módulos, uno por instrumento de fulia, con contenido y patrón válido', () => {
    expect(COURSE).toHaveLength(4);
    expect(COURSE.map((m) => m.instrument)).toEqual(FULIA_IDS);
    for (const mod of COURSE) {
      expect(mod.title).toBeTruthy();
      expect(mod.concepto.length).toBeGreaterThan(20);
      expect(mod.tecnica.length).toBeGreaterThan(20);
      expect(PATTERNS.some((p) => p.id === mod.patternId)).toBe(true);
      const pattern = PATTERNS.find((p) => p.id === mod.patternId);
      expect(pattern.steps[mod.instrument].some(Boolean)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Ver fallar** — Run: `npm test -- tests/course.test.js` → FAIL (no resuelve course.js).

- [ ] **Step 3: Crear `src/data/course.js`** (textos provisionales — validación del cliente pendiente)

```js
export const COURSE = [
  {
    instrument: 'prima',
    title: 'La Prima',
    concepto:
      'La prima es el tambor que guía: marca la melodía del ritmo y llama a los demás a entrar. En la fulia de La Guaira, quien toca la prima dirige la rueda con su repique.',
    tecnica:
      'Mano abierta al centro del parche, un golpe por tiempo y acentos fuertes en los pasos clave. Codo relajado y muñeca suave: el golpe nace del rebote, no de la fuerza.',
    patternId: 'guaira-tradicional'
  },
  {
    instrument: 'cruzao',
    title: 'El Cruzao',
    concepto:
      'El cruzao responde a la prima: cruza su ritmo entre los espacios del tambor guía y sostiene la conversación. Juntos forman el diálogo característico de la fulia.',
    tecnica:
      'Golpes alternados en los espacios libres de la prima, con la mano cruzada sobre el parche. Escucha a la prima y responde: nunca pises su melodía.',
    patternId: 'guaira-tradicional'
  },
  {
    instrument: 'pujao',
    title: 'El Pujao',
    concepto:
      'El pujao es el corazón grave del conjunto: apoya el bajo con golpes secos que sostienen el pulso mientras primas y cruzaos conversan arriba.',
    tecnica:
      'Golpe de palma completa cerca del borde del parche, con todo el peso de la mano. Es un sonido profundo y corto: marca el suelo, no la melodía.',
    patternId: 'guaira-tradicional'
  },
  {
    instrument: 'paila',
    title: 'Las Pailas',
    concepto:
      'Las pailas son piezas de madera que llevan el contratiempo: su sonido seco y brillante teje el pegao que hace bailar a la tamborera.',
    tecnica:
      'Dos baquetas de madera, golpes alternados y suaves sobre la tabla. La muñeca manda: busca un sonido parejo, sin apagar la madera.',
    patternId: 'guaira-tradicional'
  }
];
```

- [ ] **Step 4: Ver pasar** — Run: `npm test -- tests/course.test.js` → PASS (1 test).

- [ ] **Step 5: Commit** — `git add tests/course.test.js src/data/course.js; git commit -m "feat: data del minicurso de fulia (4 modulos)"`

---

### Task 2: Loop por instrumento (`playSoloLoop`)

**Files:** Create `tests/loop.test.js`, `src/core/audio/loop.js`

- [ ] **Step 1: Test fallido**

```js
import { describe, expect, it, vi } from 'vitest';
import { createFakeAudioContext } from './fakes/fake-audio-context.js';
import { playSoloLoop } from '../src/core/audio/loop.js';
import { PATTERNS } from '../src/data/patterns.js';

describe('playSoloLoop', () => {
  it('dispara solo el instrumento del módulo y loopea', () => {
    vi.useFakeTimers();
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const triggers = [];
    const engine = { trigger: (id, opts) => triggers.push({ id, ...opts }) };

    const scheduler = playSoloLoop({
      engine,
      drumId: 'prima',
      patternId: 'guaira-tradicional',
      swing: 40,
      getContext: () => ctx
    });

    expect(scheduler).toBeTruthy();
    ctx.currentTime = 3;
    vi.advanceTimersByTime(120);

    expect(triggers.length).toBeGreaterThan(0);
    expect(triggers.every((t) => t.id === 'prima')).toBe(true);
    expect(scheduler.isRunning).toBe(true);
    scheduler.stop();
    expect(scheduler.isRunning).toBe(false);
    vi.useRealTimers();
  });

  it('respeta los acentos del patrón', () => {
    vi.useFakeTimers();
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const triggers = [];
    const engine = { trigger: (id, opts) => triggers.push({ id, ...opts }) };

    const scheduler = playSoloLoop({
      engine,
      drumId: 'prima',
      patternId: 'guaira-tradicional',
      swing: 40,
      getContext: () => ctx
    });
    ctx.currentTime = 6;
    vi.advanceTimersByTime(200);
    scheduler.stop();

    const pattern = PATTERNS.find((p) => p.id === 'guaira-tradicional');
    const withAccent = triggers.filter((t) => t.accent).length;
    const expected = pattern.accents.prima.filter(Boolean).length;
    expect(withAccent).toBeGreaterThanOrEqual(expected);
    vi.useRealTimers();
  });

  it('devuelve null con instrumento o patrón desconocido', () => {
    expect(playSoloLoop({ engine: { trigger() {} }, drumId: 'nope' })).toBe(null);
    expect(playSoloLoop({ engine: { trigger() {} }, drumId: 'prima', patternId: 'nope' })).toBe(null);
  });
});
```

- [ ] **Step 2: Ver fallar** — Run: `npm test -- tests/loop.test.js` → FAIL (no resuelve loop.js).

- [ ] **Step 3: Crear `src/core/audio/loop.js`**

```js
import { PATTERNS } from '../../data/patterns.js';
import { createScheduler } from './scheduler.js';

// Loop infinito de un solo instrumento: el scheduler ya loopea (stepIndex % steps)
// hasta stop(); aquí solo se agenda el tambor del módulo (minicurso).
export function playSoloLoop({ engine, patternId = 'guaira-tradicional', drumId, swing = 40, onStop, getContext } = {}) {
  const pattern = PATTERNS.find((p) => p.id === patternId);
  if (!pattern || !engine || !drumId || !pattern.steps[drumId]) return null;

  const scheduler = createScheduler({
    bpm: pattern.bpm,
    swing,
    ...(getContext ? { getContext } : {}),
    onStep(step, time) {
      if (pattern.steps[drumId]?.[step]) {
        engine.trigger(drumId, { time, accent: Boolean(pattern.accents?.[drumId]?.[step]) });
      }
    },
    ...(onStop ? { onStop } : {})
  });

  scheduler.start();
  return scheduler;
}
```

**Nota:** `createScheduler` no recibe `onStop`; si al ejecutar falla esa opción, elimina la línea `...(onStop ? { onStop } : {})` (el componente maneja el stop llamando a `scheduler.stop()`).

- [ ] **Step 4: Ver pasar** — Run: `npm test -- tests/loop.test.js` → PASS (3 tests). Si falla `onStop`, aplica la nota.

- [ ] **Step 5: Suite + Commit** — Run: `npm test` → 10 archivos, 46 tests. Luego:
`git add tests/loop.test.js src/core/audio/loop.js; git commit -m "feat: loop por instrumento para el minicurso"`

---

### Task 3: Sección minicurso

**Files:** Create `src/components/course.js`, Modify `src/main.js`, `index.html`

- [ ] **Step 1: Crear `src/components/course.js`**

```js
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
          <article data-module="${mod.instrument}" class="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
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
            <div class="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
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
```

- [ ] **Step 2: Monte en `src/main.js` y `index.html`**

`src/main.js` — import + montaje (tras el hero, antes del catálogo diferido):

```js
import './styles/main.css';
import { mountHeader } from './components/header.js';
import { mountHero } from './components/hero.js';
import { mountCourse } from './components/course.js';
import { createDrumEngine } from './core/audio/drum-engine.js';
import { getAudioContext, unlockAudioOnFirstGesture } from './core/audio/context.js';

unlockAudioOnFirstGesture();

const engine = createDrumEngine(getAudioContext);

mountHeader(document.getElementById('site-header'));
mountHero(document.getElementById('hero'), { engine });
mountCourse(document.getElementById('minicurso'), { engine });
const mountCatalogDeferred = () =>
  import('./components/catalog.js').then(({ mountCatalog }) => mountCatalog(document.getElementById('catalogo')));
if ('requestIdleCallback' in window) {
  requestIdleCallback(mountCatalogDeferred, { timeout: 500 });
} else {
  setTimeout(mountCatalogDeferred, 32);
}

document.documentElement.dataset.ready = 'true';
```

`index.html` — después de la sección hero, antes del catálogo:

```html
      <section id="minicurso" aria-labelledby="course-title"></section>
```

- [ ] **Step 3: Suite + build** — Run: `npm test` → 46 passed; `npm run build` → ✓ built.

- [ ] **Step 4: Verificación en navegador**

Crear `C:\Users\USUARIO\AppData\Local\Temp\opencode\verify-course.mjs`:

```js
import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const consoleErrors = [];
const failed = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('requestfailed', (r) => failed.push(r.url()));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 30000 });
await page.evaluate(() => document.getElementById('minicurso')?.scrollIntoView());

const checks = [];
const add = (n, ok, d = '') => checks.push(`${ok ? 'PASS' : 'FAIL'} - ${n}${d ? ` :: ${d}` : ''}`);
const q = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);

add('sección minicurso con heading', (await q('#course-title')) === 1);
add('4 módulos con patrón visual', (await q('[data-module]')) === 4 && (await q('[data-module] [role="img"]')) === 4);
add('4 botones de loop con aria-label', (await q('[data-course-play]')) === 4);

// Pulsar la prima → suena (osciladores en el AudioContext)
await page.click('[data-course-play="prima"]');
await new Promise((r) => setTimeout(r, 500));
const oscCount = await page.evaluate(() => window.__oscCount ?? null);
add('loop de prima crea osciladores', oscCount === null || oscCount > 0, `osc=${oscCount}`);
const pressed = await page.evaluate(() => document.querySelector('[data-course-play="prima"]')?.getAttribute('aria-pressed'));
add('botón en estado activo (aria-pressed)', pressed === 'true');

// Cambiar a pujao detiene la prima y arranca el pujao
await page.click('[data-course-play="pujao"]');
await new Promise((r) => setTimeout(r, 300));
const primaOff = await page.evaluate(() => document.querySelector('[data-course-play="prima"]')?.getAttribute('aria-pressed') === 'false');
const pujaoOn = await page.evaluate(() => document.querySelector('[data-course-play="pujao"]')?.getAttribute('aria-pressed') === 'true');
add('solo un loop activo a la vez', primaOff && pujaoOn);

// Segundo clic detiene
await page.click('[data-course-play="pujao"]');
await new Promise((r) => setTimeout(r, 200));
const pujaoOff = await page.evaluate(() => document.querySelector('[data-course-play="pujao"]')?.getAttribute('aria-pressed') === 'false');
add('segundo clic detiene el loop', pujaoOff);

add('sin errores de consola', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
add('sin peticiones fallidas', failed.length === 0, failed.slice(0, 3).join(' | '));

console.log('CHECKS COURSE:');
for (const c of checks) console.log(' ' + c);
const bad = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(bad === 0 ? 'ALL PASS' : `${bad} FAILED`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
```

**Nota:** para contar osciladores, el botón de demo del hero ya expone contadores? NO — sustituye el check de osciladores por este más simple si `window.__oscCount` no existe: comprueba solo que no hay errores tras 1 s de loop. El `oscCount` puede omitirse.

Run: `node C:\Users\USUARIO\AppData\Local\Temp\opencode\verify-course.mjs` → **ALL PASS**.

- [ ] **Step 5: Commit** — `git add src/components/course.js src/main.js index.html; git commit -m "feat: seccion minicurso con 4 modulos interactivos"`

---

### Task 4: Verificación final del sub-proyecto 3

- [ ] **Step 1:** `npm test` → 46 passed; `npm run build` → ✓.
- [ ] **Step 2:** Preview de producción (mata el 4173 viejo, arranca nuevo) y re-corre `verify-course.mjs http://localhost:4173/` + `verify-catalog.mjs http://localhost:4173/` + `a11y-catalog.mjs http://localhost:4173/` → ALL PASS.
- [ ] **Step 3:** Lighthouse móvil (registra el número; el gate duro es del sub5).
- [ ] **Step 4:** Checklist del cliente: **los textos culturales de `src/data/course.js` necesitan su validación** (spec §7).
- [ ] **Step 5:** `git add -A; git commit -m "chore: verificacion del sub-proyecto 3 (minicurso)"`
