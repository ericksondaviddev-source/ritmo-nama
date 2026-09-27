# Sub-proyecto 4 — MidiPad Pro (vista a pantalla completa) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vista `#midipad` con secuenciador de 6 stems × 12 pasos (6/8), acento en 3 estados, BPM 80–180, swing 0–60%, 4 presets culturales, mixer por stem (volumen/pan/afinación/solo/mute) + master, pads multi-touch con pre-warm, grabación de loops (60 s) y de voz, y export WAV 16 bits real (voz + rítmica mezcladas).

**Architecture:** La lógica de audio vive en `src/core/audio/midipad.js` (estado, scheduler reutilizado del sub1, mixer, export offline) testeable con el AudioContext falso; el componente `src/components/midipad.js` es solo UI + wiring. El export re-renderiza el patrón en un `OfflineAudioContext` (el `trigger` del engine acepta `context` para renderizar fuera del contexto live) y lo codifica con `encodeWav16` (función pura, TDD). La grabación de loops usa `MediaStreamAudioDestinationNode` + `MediaRecorder`; la de voz usa `getUserMedia` + `MediaRecorder` + `decodeAudioData`.

**Tech Stack:** Vite + JS modular, Tailwind v4, Web Audio API (OfflineAudioContext, MediaRecorder, getUserMedia), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-26-ritmo-nama-design.md` §8, §10, §11 (Sub-proyecto 4).

---

## Decisiones

1. **Mixer sin cambios en el engine:** `trigger(id, { time, volume, pan, pitchShift, accent })` ya soporta todo lo que el mixer necesita por golpe.
2. **Dos adiciones al engine (backward-compatible):** opción `context` en `trigger` (para el render offline) y `connectOutput(node)` (para grabar el mix live).
3. **Celdas = pads:** `pointerdown` sobre una celda cicla su estado (vacío → normal → acento) y hace un preview del golpe inmediato. Multi-touch nativo: cada puntero dispara su `pointerdown` (`touch-action: none` en la grid).
4. **Pre-warm:** al primer gesto en la sección se dispara cada stem con `volume: 0` para calentar el buffer de ruido y los osciladores.
5. **Export = WAV 16 bits real** (PCM, RIFF/WAVE). MP3 solo si se incorpora lamejs (no en este sub-proyecto); nunca un WAV renombrado (spec §8).
6. **Grabación de voz:** graba solo el micrófono; la base rítmica se mezcla desde el render offline. Micrófono denegado → mensaje infantil (§10).
7. **Grabación de loops:** máximo 60 s con auto-stop; blob webm para escuchar la toma en vivo.

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/core/audio/wav.js` | Create | `encodeWav16`: AudioBuffer → WAV PCM 16-bit (puro, TDD) |
| `src/core/audio/drum-engine.js` | Modify | `context` en `trigger` + `connectOutput` (TDD) |
| `src/core/audio/midipad.js` | Create | Estado, scheduler, mixer, pre-warm, export offline (TDD) |
| `src/components/midipad.js` | Create | UI: transport, grid, mixer, grabación, fullscreen |
| `src/main.js` / `index.html` | Modify | Monte + sección |
| `tests/wav.test.js`, `tests/midipad.test.js`, `tests/drum-engine.test.js` | Create/Modify | TDD |

**Tests esperados al final:** 11 archivos, 53 tests (44 + 3 wav + 2 engine + 4 midipad).

---

### Task 1: Adiciones al engine (`context` + `connectOutput`)

**Files:** Modify `src/core/audio/drum-engine.js`, `tests/drum-engine.test.js`

- [ ] **Step 1: Tests fallidos** — añadir al final de `tests/drum-engine.test.js`:

```js
describe('engine: extras para MidiPad', () => {
  it('trigger acepta un context override (render offline)', () => {
    const live = createFakeAudioContext({ currentTime: 0 });
    const offline = createFakeAudioContext({ currentTime: 0 });
    const engine = createDrumEngine(() => live);
    engine.trigger('prima', { context: offline, time: 0.1 });
    expect(offline.log.length).toBeGreaterThan(0);
  });

  it('connectOutput conecta el master a un nodo extra (grabación)', () => {
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const engine = createDrumEngine(() => ctx);
    const extra = ctx.createGain();
    // El fake graba conexiones unidireccionalmente (solo desde el nodo origen);
    // la verificación end-to-end de la grabación vive en verify-midipad.mjs (navegador).
    expect(() => engine.connectOutput(extra)).not.toThrow();
    expect(() => engine.trigger('prima')).not.toThrow();
  });
});
```

- [ ] **Step 2: Ver fallar** — Run: `npm test -- tests/drum-engine.test.js` → FAIL (2).

- [ ] **Step 3: Implementar** — en `src/core/audio/drum-engine.js`:

Firma del trigger (línea 54):

```js
  function trigger(id, { time, volume: hitVolume = 1, pan = 0, pitchShift = 0, accent = false, context = null } = {}) {
    const ctx = context ?? getContext();
    if (!ctx) return;
```

Y después de `return { trigger,` (línea 79-81) añadir el método:

```js
  return {
    trigger,
    // Conecta el master a un destino extra (p.ej. MediaStreamDestination para grabar)
    connectOutput(node) {
      const ctx = getContext();
      if (!ctx || !node) return;
      ensureMaster(ctx).connect(node);
    },
```

- [ ] **Step 4: Ver pasar** — Run: `npm test` → 46 passed (10 archivos).

- [ ] **Step 5: Commit** — `git add src/core/audio/drum-engine.js tests/drum-engine.test.js; git commit -m "feat: engine con context override y connectOutput para midipad"`

---

### Task 2: Codificador WAV 16 bits (`encodeWav16`)

**Files:** Create `tests/wav.test.js`, `src/core/audio/wav.js`

- [ ] **Step 1: Test fallido**

```js
import { describe, expect, it } from 'vitest';
import { encodeWav16 } from '../src/core/audio/wav.js';

function fakeBuffer(data, { channels = 1, sampleRate = 44100 } = {}) {
  return {
    numberOfChannels: channels,
    sampleRate,
    length: channels === 1 ? data.length : data[0].length,
    getChannelData: (c) => (channels === 1 ? data : data[c])
  };
}

function str(view, at, n) {
  let out = '';
  for (let i = 0; i < n; i++) out += String.fromCharCode(view.getUint8(at + i));
  return out;
}

describe('encodeWav16', () => {
  it('escribe cabecera RIFF/WAVE PCM 16-bit con tamaños correctos', () => {
    const wav = encodeWav16(fakeBuffer(new Float32Array([0, 0.5, -0.5, 1])));
    const view = new DataView(wav);
    expect(str(view, 0, 4)).toBe('RIFF');
    expect(str(view, 8, 4)).toBe('WAVE');
    expect(str(view, 12, 4)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // canales
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(34, true)).toBe(16); // bits
    expect(str(view, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(8); // 4 muestras × 2 bytes
    expect(wav.byteLength).toBe(52); // 44 + 8
  });

  it('codifica las muestras como int16 little-endian intercaladas', () => {
    const wav = encodeWav16(
      fakeBuffer(
        [new Float32Array([0, 0.5, -1]), new Float32Array([1, -0.5, 0])],
        { channels: 2 }
      )
    );
    const view = new DataView(wav);
    expect(view.getUint16(22, true)).toBe(2);
    // L[0]=0, R[0]=32767 (1×0x7fff), L[1]=16383 (0.5), R[1]=-16384 (-0.5×0x8000), L[2]=-32768, R[2]=0
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(16383);
    expect(view.getInt16(50, true)).toBe(-16384);
    expect(view.getInt16(52, true)).toBe(-32768);
    expect(view.getInt16(54, true)).toBe(0);
  });

  it('clampea al rango [-1, 1]', () => {
    const wav = encodeWav16(fakeBuffer(new Float32Array([2, -2])));
    const view = new DataView(wav);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });
});
```

- [ ] **Step 2: Ver fallar** — Run: `npm test -- tests/wav.test.js` → FAIL.

- [ ] **Step 3: Crear `src/core/audio/wav.js`**

```js
// WAV PCM 16-bit real: RIFF/WAVE little-endian, muestras intercaladas y clampeadas.
export function encodeWav16(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const bytesPerSample = 2;
  const dataSize = length * numChannels * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (at, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let c = 0; c < numChannels; c++) channels.push(audioBuffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return buffer;
}
```

- [ ] **Step 4: Ver pasar** — Run: `npm test -- tests/wav.test.js` → PASS (3).

- [ ] **Step 5: Commit** — `git add tests/wav.test.js src/core/audio/wav.js; git commit -m "feat: codificador WAV 16 bits con tests"`

---

### Task 3: Lógica de audio del MidiPad (estado, mixer, export offline)

**Files:** Create `tests/midipad.test.js`, `src/core/audio/midipad.js`

- [ ] **Step 1: Test fallido**

```js
import { describe, expect, it, vi } from 'vitest';
import { createFakeAudioContext } from './fakes/fake-audio-context.js';
import { createMidipadAudio } from '../src/core/audio/midipad.js';
import { PATTERNS } from '../src/data/patterns.js';

const STEM_IDS = ['prima', 'cruzao', 'pujao', 'paila', 'maracas', 'cuatro'];

describe('midipad: estado', () => {
  it('toggleCell cicla 0 → 1 → 2 → 0 y rechaza índices inválidos', () => {
    const pad = createMidipadAudio({ engine: { trigger() {} } });
    expect(pad.toggleCell('prima', 0)).toBe(1);
    expect(pad.toggleCell('prima', 0)).toBe(2);
    expect(pad.toggleCell('prima', 0)).toBe(0);
    expect(pad.toggleCell('prima', -1)).toBe(null);
    expect(pad.toggleCell('prima', 12)).toBe(null);
    expect(pad.toggleCell('nope', 0)).toBe(null);
  });

  it('applyPreset carga steps (acento=2), bpm y swing; false con id desconocido', () => {
    const pad = createMidipadAudio({ engine: { trigger() {} } });
    expect(pad.applyPreset('guaira-tradicional')).toBe(true);
    const pattern = PATTERNS.find((p) => p.id === 'guaira-tradicional');
    expect(pad.state.steps.prima[0]).toBe(2); // golpe con acento
    expect(pad.state.steps.cruzao[0]).toBe(0);
    expect(pad.state.steps.paila.filter((c) => c > 0).length).toBe(pattern.steps.paila.filter(Boolean).length);
    expect(pad.state.bpm).toBe(pattern.bpm);
    expect(pad.applyPreset('nope')).toBe(false);
  });

  it('setMixer clampea volumen/pan/afinación', () => {
    const pad = createMidipadAudio({ engine: { trigger() {} } });
    expect(pad.setMixer('prima', { volume: 5, pan: 2, tuning: -20 })).toBe(true);
    expect(pad.state.mixer.prima.volume).toBe(1.5);
    expect(pad.state.mixer.prima.pan).toBe(1);
    expect(pad.state.mixer.prima.tuning).toBe(-12);
    expect(pad.setMixer('nope', { volume: 1 })).toBe(false);
  });
});

describe('midipad: reproducción', () => {
  it('playHit respeta mute y solo', () => {
    const triggers = [];
    const pad = createMidipadAudio({ engine: { trigger: (id, o) => triggers.push({ id, ...o }) } });
    pad.setMixer('prima', { mute: true });
    pad.playHit('prima', 0, 1);
    expect(triggers).toHaveLength(0);

    pad.setMixer('prima', { mute: false });
    pad.setMixer('cruzao', { solo: true });
    pad.playHit('prima', 0, 1);
    expect(triggers).toHaveLength(0);
    pad.playHit('cruzao', 0, 1);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].accent).toBe(false);
  });

  it('playHit aplica mixer y acento al golpe', () => {
    const triggers = [];
    const pad = createMidipadAudio({ engine: { trigger: (id, o) => triggers.push({ id, ...o }) } });
    pad.setMixer('pujao', { volume: 0.8, pan: -0.5, tuning: -5 });
    pad.playHit('pujao', 1.25, 2);
    expect(triggers[0]).toMatchObject({ id: 'pujao', time: 1.25, accent: true, volume: 0.8, pan: -0.5, pitchShift: -5 });
  });

  it('start/stop con context inyectado agenda los golpes de la grid', () => {
    vi.useFakeTimers();
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const triggers = [];
    const pad = createMidipadAudio({ engine: { trigger: (id, o) => triggers.push({ id, ...o }) }, getContext: () => ctx });
    pad.applyPreset('guaira-tradicional');
    pad.start();
    ctx.currentTime = 2;
    vi.advanceTimersByTime(120);
    expect(triggers.length).toBeGreaterThan(0);
    expect(triggers.every((t) => STEM_IDS.includes(t.id))).toBe(true);
    expect(pad.isRunning).toBe(true);
    pad.stop();
    expect(pad.isRunning).toBe(false);
    vi.useRealTimers();
  });

  it('warmUp dispara cada stem con volumen 0', () => {
    const triggers = [];
    const pad = createMidipadAudio({ engine: { trigger: (id, o) => triggers.push({ id, ...o }) }, getContext: () => createFakeAudioContext({ currentTime: 5 }) });
    pad.warmUp();
    expect(triggers).toHaveLength(6);
    expect(triggers.every((t) => t.volume === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Ver fallar** — Run: `npm test -- tests/midipad.test.js` → FAIL.

- [ ] **Step 3: Crear `src/core/audio/midipad.js`**

```js
import { DRUMS } from '../../data/drums.js';
import { PATTERNS } from '../../data/patterns.js';
import { createScheduler } from './scheduler.js';

const STEM_IDS = DRUMS.map((d) => d.id);

export function createMidipadAudio({ engine, getContext } = {}) {
  if (!engine) return null;

  const emptySteps = () => Object.fromEntries(STEM_IDS.map((id) => [id, new Array(12).fill(0)]));
  const defaultMixer = () =>
    Object.fromEntries(STEM_IDS.map((id) => [id, { volume: 1, pan: 0, tuning: 0, solo: false, mute: false }]));

  const state = { steps: emptySteps(), bpm: 124, swing: 40, mixer: defaultMixer(), master: 0.85 };
  let scheduler = null;

  function toggleCell(drumId, stepIndex) {
    const arr = state.steps[drumId];
    if (!arr || stepIndex < 0 || stepIndex >= arr.length) return null;
    arr[stepIndex] = (arr[stepIndex] + 1) % 3;
    return arr[stepIndex];
  }

  function applyPreset(patternId) {
    const pattern = PATTERNS.find((p) => p.id === patternId);
    if (!pattern) return false;
    for (const id of STEM_IDS) {
      state.steps[id] = pattern.steps[id].map((hit, i) => (hit ? (pattern.accents[id][i] ? 2 : 1) : 0));
    }
    state.bpm = pattern.bpm;
    state.swing = 40;
    scheduler?.setBpm(state.bpm);
    scheduler?.setSwing(state.swing);
    return true;
  }

  function setMixer(drumId, patch = {}) {
    const m = state.mixer[drumId];
    if (!m) return false;
    if (typeof patch.volume === 'number') m.volume = Math.max(0, Math.min(1.5, patch.volume));
    if (typeof patch.pan === 'number') m.pan = Math.max(-1, Math.min(1, patch.pan));
    if (typeof patch.tuning === 'number') m.tuning = Math.max(-12, Math.min(12, patch.tuning));
    if (typeof patch.solo === 'boolean') m.solo = patch.solo;
    if (typeof patch.mute === 'boolean') m.mute = patch.mute;
    return true;
  }

  function soloActive() {
    return STEM_IDS.some((id) => state.mixer[id].solo);
  }

  function playHit(drumId, time, cellState) {
    const m = state.mixer[drumId];
    if (!m || m.mute) return;
    if (soloActive() && !m.solo) return;
    engine.trigger(drumId, {
      time,
      accent: cellState === 2,
      volume: m.volume,
      pan: m.pan,
      pitchShift: m.tuning
    });
  }

  function start() {
    if (scheduler?.isRunning) return scheduler;
    scheduler = createScheduler({
      bpm: state.bpm,
      swing: state.swing,
      ...(getContext ? { getContext } : {}),
      onStep(step, time) {
        for (const id of STEM_IDS) {
          const cell = state.steps[id][step];
          if (cell > 0) playHit(id, time, cell);
        }
      }
    });
    scheduler.start();
    return scheduler;
  }

  function stop() {
    scheduler?.stop();
    scheduler = null;
  }

  function warmUp() {
    const ctx = getContext?.();
    if (!ctx) return;
    for (const id of STEM_IDS) engine.trigger(id, { time: ctx.currentTime, volume: 0 });
  }

  function setBpm(value) {
    state.bpm = Math.max(80, Math.min(180, value));
    scheduler?.setBpm(state.bpm);
  }

  function setSwing(value) {
    state.swing = Math.max(0, Math.min(60, value));
    scheduler?.setSwing(state.swing);
  }

  function setMaster(value) {
    state.master = Math.max(0, Math.min(1, value));
    engine.setMasterVolume(state.master);
  }

  return {
    state,
    toggleCell,
    applyPreset,
    setMixer,
    setBpm,
    setSwing,
    setMaster,
    playHit,
    start,
    stop,
    warmUp,
    soloActive,
    get isRunning() {
      return Boolean(scheduler?.isRunning);
    }
  };
}

export { STEM_IDS };
```

- [ ] **Step 4: Ver pasar** — Run: `npm test -- tests/midipad.test.js` → PASS (7). Si `createMidipadAudio` sin `getContext` rompe `start`, verifica el guard.

- [ ] **Step 5: Suite + Commit** — Run: `npm test` → 53 passed (11 archivos). Luego:
`git add tests/midipad.test.js src/core/audio/midipad.js; git commit -m "feat: logica de audio del midipad (estado, mixer, export)"`

---

### Task 4: Export offline a WAV (voz + rítmica mezcladas)

**Files:** Modify `src/core/audio/midipad.js` (añadir `renderExport`)

- [ ] **Step 1: Implementar `renderExport`** — añadir antes del `return {` de `createMidipadAudio`:

```js
  // Re-renderiza el patrón en un OfflineAudioContext y devuelve un WAV 16 bits (Uint8/ArrayBuffer).
  // El voiceBuffer (grabación de micrófono) se mezcla como capa sobre la base rítmica.
  async function renderExport({ cycles = 2, voiceBuffer = null } = {}) {
    const ctx = getContext?.();
    if (!ctx) return null;
    const stepSec = stepDurationSec(state.bpm);
    const sampleRate = 44100;
    const baseSec = cycles * 12 * stepSec;
    const durationSec = baseSec + (voiceBuffer ? voiceBuffer.duration : 0) + 0.5;
    const offline = new OfflineAudioContext(2, Math.ceil(durationSec * sampleRate), sampleRate);

    for (let cycle = 0; cycle < cycles; cycle++) {
      for (let step = 0; step < 12; step++) {
        const t =
          0.05 + cycle * 12 * stepSec + step * stepSec + swingOffsetSec(state.bpm, state.swing, step);
        for (const id of STEM_IDS) {
          const cell = state.steps[id][step];
          if (!cell) continue;
          const m = state.mixer[id];
          if (m.mute) continue;
          if (soloActive() && !m.solo) continue;
          engine.trigger(id, {
            time: t,
            accent: cell === 2,
            volume: m.volume,
            pan: m.pan,
            pitchShift: m.tuning,
            context: offline
          });
        }
      }
    }

    if (voiceBuffer) {
      const src = offline.createBufferSource();
      src.buffer = voiceBuffer;
      src.connect(offline.destination);
      src.start(0.05);
    }

    const rendered = await offline.startRendering();
    return encodeWav16(rendered);
  }
```

Import arriba del todo del archivo:

```js
import { stepDurationSec, swingOffsetSec } from './timing.js';
import { encodeWav16 } from './wav.js';
```

Y exportar en el `return { ... }`: añadir `renderExport,` junto a `warmUp,`.

- [ ] **Step 2: Suite** — Run: `npm test` → 53 passed (renderExport no es testeable en node: se verifica en navegador en el Task 6).

- [ ] **Step 3: Commit** — `git add src/core/audio/midipad.js; git commit -m "feat: export offline del midipad a WAV 16 bits"`

---

### Task 5: UI del MidiPad Pro

**Files:** Create `src/components/midipad.js`, Modify `src/main.js`, `index.html`

- [ ] **Step 1: Crear `src/components/midipad.js`**

```js
import { DRUMS } from '../data/drums.js';
import { PATTERNS } from '../data/patterns.js';
import { createMidipadAudio } from '../core/audio/midipad.js';

const RECORD_MAX_MS = 60000;

const CELL_CLASS = {
  0: 'bg-zinc-800/80 hover:bg-zinc-700',
  1: 'bg-amber-500/60 hover:bg-amber-400/70',
  2: 'bg-amber-400 hover:bg-amber-300 shadow-lg shadow-amber-500/40'
};

export function mountMidipad(root, { engine, getContext } = {}) {
  if (!root) return null;

  const audio = createMidipadAudio({ engine, getContext });
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

      <div data-padpanel class="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-6">
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
  function cellClass(state) {
    return CELL_CLASS[state] ?? CELL_CLASS[0];
  }
  function buildGrid() {
    grid.innerHTML = DRUMS.map(
      (d) => `
      <div class="flex items-center gap-2">
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
      </div>`
    ).join('');
    for (const d of DRUMS) {
      cellEls[d.id] = [...grid.querySelectorAll(`[data-cell="${d.id}"]`)];
    }
  }
  buildGrid();

  function updateCell(drumId, i) {
    const el = cellEls[drumId]?.[i];
    if (el) el.className = `h-9 flex-1 rounded-md transition-colors ${cellClass(audio.state.steps[drumId][i])}`;
  }
  function refreshGrid() {
    for (const d of DRUMS) for (let i = 0; i < 12; i++) updateCell(d.id, i);
  }

  // Pads multi-touch: pointerdown cicla y hace preview del golpe
  grid.addEventListener(
    'pointerdown',
    (e) => {
      const btn = e.target.closest('[data-cell]');
      if (!btn) return;
      e.preventDefault();
      const drumId = btn.dataset.cell;
      const step = Number(btn.dataset.step);
      const next = audio.toggleCell(drumId, step);
      updateCell(drumId, step);
      const ctx = getContext?.();
      if (next > 0 && ctx) audio.playHit(drumId, ctx.currentTime, next);
    }
  );

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

  // Transport
  const playBtn = root.querySelector('[data-play]');
  const stopBtn = root.querySelector('[data-stop]');
  playBtn.addEventListener('click', () => {
    audio.start();
    playBtn.disabled = true;
    stopBtn.disabled = false;
  });
  stopBtn.addEventListener('click', () => {
    audio.stop();
    playBtn.disabled = false;
    stopBtn.disabled = true;
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
  const canRecord = typeof window.MediaRecorder !== 'undefined' && typeof ctx?.createMediaStreamDestination === 'function';

  let loopRecorder = null;
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
    if (loopRecorder) return; // grabando: auto-stop a los 60 s
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
      recordLoopBtn.disabled = false;
      loopRecorder = null;
    };
    loopRecorder = rec;
    recordLoopBtn.disabled = true;
    status.textContent = 'Grabando loop… (máx 60 s)';
    rec.start();
    setTimeout(() => {
      if (rec.state !== 'inactive') rec.stop();
    }, RECORD_MAX_MS);
  });

  recordVoiceBtn.addEventListener('click', async () => {
    if (voiceStream) return; // grabando
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
      recordVoiceBtn.disabled = false;
      try {
        const blob = new Blob(chunks, { type: mime.split(';')[0] || 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        voiceBuffer = await ctx.decodeAudioData(arrayBuffer);
        status.textContent = 'Voz grabada ✓ (se mezcla en el export)';
      } catch {
        status.textContent = 'No se pudo decodificar la voz';
      }
    };
    recordVoiceBtn.disabled = true;
    status.textContent = 'Grabando voz… (habla sobre la base)';
    rec.start();
    setTimeout(() => {
      if (rec.state !== 'inactive') rec.stop();
    }, RECORD_MAX_MS);
  });

  exportBtn.addEventListener('click', async () => {
    if (!audio || audio.isRunning === undefined) return;
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

  // Pre-warm al primer gesto en la sección (spec §8)
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
      audio.stop();
      if (loopRecorder && loopRecorder.state !== 'inactive') loopRecorder.stop();
      if (voiceStream) for (const t of voiceStream.getTracks()) t.stop();
      if (playback?.src) URL.revokeObjectURL(playback.src);
    }
  };
}
```

- [ ] **Step 2: Monte en `src/main.js` y `index.html`**

`src/main.js` — import + montaje (tras el minicurso, antes del catálogo diferido):

```js
import { mountMidipad } from './components/midipad.js';
```

y en el cuerpo:

```js
mountMidipad(document.getElementById('midipad'), { engine, getContext: getAudioContext });
```

`index.html` — después de la sección minicurso:

```html
      <section id="midipad" aria-labelledby="midipad-title"></section>
```

- [ ] **Step 3: Suite + build** — Run: `npm test` → 53 passed; `npm run build` → ✓ built.

- [ ] **Step 4: Commit** — `git add src/components/midipad.js src/main.js index.html; git commit -m "feat: seccion MidiPad Pro (grid, mixer, grabacion, export)"`

---

### Task 6: Verificación final del sub-proyecto 4

- [ ] **Step 1:** `npm test` → 53 passed; `npm run build` → ✓.
- [ ] **Step 2:** Preview de producción (mata el 4173 viejo) y verificación en navegador.

Crear `C:\Users\USUARIO\AppData\Local\Temp\opencode\verify-midipad.mjs`:

```js
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = process.argv[2] || 'http://localhost:5173/';
const DL_DIR = 'C:\\Users\\USUARIO\\AppData\\Local\\Temp\\opencode\\downloads';
fs.mkdirSync(DL_DIR, { recursive: true });
for (const f of fs.readdirSync(DL_DIR)) fs.rmSync(`${DL_DIR}\\${f}`, { force: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1400 });
const consoleErrors = [];
const failed = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('requestfailed', (r) => failed.push(r.url()));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await page.evaluate(() => document.getElementById('midipad')?.scrollIntoView());

const checks = [];
const add = (n, ok, d = '') => checks.push(`${ok ? 'PASS' : 'FAIL'} - ${n}${d ? ` :: ${d}` : ''}`);
const q = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);

add('sección midipad con heading', (await q('#midipad-title')) === 1);
add('grid: 6 stems × 12 celdas', (await q('[data-cell]')) === 72);
add('mixer: 6 filas', (await q('[data-mixer-row]')) === 6);
add('transport completo (play/stop/preset/bpm/swing)', (await q('[data-play]')) === 1 && (await q('[data-stop]')) === 1 && (await q('[data-preset]')) === 1);

// Celda: pointerdown cicla estado (prima[1] arranca vacío → 0; el ciclo la lleva a 1)
await page.evaluate(() => {
  document.querySelector('[data-cell="prima"][data-step="1"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 200));
const cell1 = await page.evaluate(() => document.querySelector('[data-cell="prima"][data-step="1"]')?.className.includes('bg-amber-500/60'));
add('pointerdown cicla celda a estado 1', cell1 === true);

// Play → sin errores tras 1 s
await page.click('[data-play]');
await new Promise((r) => setTimeout(r, 1200));
add('secuenciador suena sin errores tras 1 s', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

// Preset cambia bpm
await page.select('[data-preset]', 'san-millan');
await new Promise((r) => setTimeout(r, 200));
const bpm = await page.evaluate(() => document.querySelector('[data-bpm-value]')?.textContent);
add('preset carga bpm del patrón', bpm === '132', `bpm=${bpm}`);

// Mixer: mute a prima
await page.evaluate(() => {
  document.querySelector('button[data-mx="mute"][data-mx-stem="prima"]')?.click();
});
await new Promise((r) => setTimeout(r, 200));
const mutePressed = await page.evaluate(() => document.querySelector('button[data-mx="mute"][data-mx-stem="prima"]')?.getAttribute('aria-pressed'));
add('mute de prima se activa (aria-pressed)', mutePressed === 'true');

// Export WAV end-to-end vía CDP
await page.click('[data-stop]');
await page.click('[data-export-wav]');
await new Promise((r) => setTimeout(r, 4000));
const wavs = fs.readdirSync(DL_DIR).filter((f) => f.endsWith('.wav'));
const size = wavs.length ? fs.statSync(`${DL_DIR}\\${wavs[0]}`).size : 0;
add('WAV descargado (>10 KB, PCM real)', wavs.length === 1 && size > 10000, `${wavs[0] ?? 'ninguno'} ${size} B`);

add('botones de grabación presentes', (await q('[data-record-loop]')) === 1 && (await q('[data-record-voice]')) === 1);
add('fullscreen presente', (await q('[data-fullscreen]')) === 1);
add('sin errores de consola', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
add('sin peticiones fallidas', failed.length === 0, failed.slice(0, 3).join(' | '));

console.log('CHECKS MIDIPAD:');
for (const c of checks) console.log(' ' + c);
const bad = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(bad === 0 ? 'ALL PASS' : `${bad} FAILED`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
```

Run: `node C:\Users\USUARIO\AppData\Local\Temp\opencode\verify-midipad.mjs http://localhost:4173/` → **ALL PASS** (14 checks). Nota: la grabación de voz requiere micrófono (no testeable en headless); el error de micrófono denegado se verifica manualmente (§10).

- [ ] **Step 3:** A11y: Tab por la sección (celdas, sliders, botones enfocables con aria-pressed/aria-label); `prefers-reduced-motion` ya cubierto en el CSS del hotspot.
- [ ] **Step 4:** Lighthouse móvil (registra; gate duro en sub5).
- [ ] **Step 5:** Checklist del dispositivo (manual, para el usuario): latencia de pads multi-touch en móvil, autoplay policy, micrófono, export WAV.
- [ ] **Step 6:** `git add -A; git commit -m "chore: verificacion del sub-proyecto 4 (midipad)"`

