import { DRUMS } from '../../data/drums.js';
import { PATTERNS } from '../../data/patterns.js';
import { createScheduler } from './scheduler.js';
import { stepDurationSec, swingOffsetSec } from './timing.js';
import { encodeWav16 } from './wav.js';

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

  // Re-renderiza el patrón en un OfflineAudioContext y devuelve un WAV 16 bits.
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
    renderExport,
    soloActive,
    get isRunning() {
      return Boolean(scheduler?.isRunning);
    }
  };
}

export { STEM_IDS };
