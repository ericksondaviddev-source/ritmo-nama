import { DRUMS, defaultArticulationFor } from '../../data/drums.js';
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
  const defaultArticulations = () =>
    Object.fromEntries(STEM_IDS.map((id) => [id, defaultArticulationFor(id)]));

  const state = {
    steps: emptySteps(),
    bpm: 124,
    swing: 40,
    mixer: defaultMixer(),
    articulation: defaultArticulations(),
    patternId: null,
    master: 0.85
  };
  let scheduler = null;
  const listeners = new Set();

  function emit() {
    for (const fn of listeners) fn(state);
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function toggleCell(drumId, stepIndex) {
    const arr = state.steps[drumId];
    if (!arr || stepIndex < 0 || stepIndex >= arr.length) return null;
    arr[stepIndex] = (arr[stepIndex] + 1) % 3;
    state.patternId = null; // la rejilla ya no coincide con el patrón cargado
    emit();
    return arr[stepIndex];
  }

  function applyPreset(patternId) {
    const pattern = PATTERNS.find((p) => p.id === patternId);
    if (!pattern) return false;
    for (const id of STEM_IDS) {
      const hits = pattern.steps[id] ?? [];
      const acc = pattern.accents[id] ?? [];
      state.steps[id] = hits.map((hit, i) => (hit ? (acc[i] ? 2 : 1) : 0));
    }
    for (const id of STEM_IDS) {
      state.articulation[id] = pattern.articulation?.[id] ?? defaultArticulationFor(id);
    }
    state.patternId = pattern.id;
    state.bpm = pattern.bpm;
    state.swing = 40;
    scheduler?.setBpm(state.bpm);
    scheduler?.setSwing(state.swing);
    emit();
    return true;
  }

  /** Cambia la articulación de un tambor (baqueta de laurel / mano abierta). */
  function setArticulation(drumId, articulation) {
    if (!(drumId in state.articulation)) return false;
    state.articulation[drumId] = articulation;
    emit();
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
      pitchShift: m.tuning,
      articulation: state.articulation[drumId]
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

  // Re-renderiza la composición en un OfflineAudioContext y devuelve un WAV de 16 bits.
  // `composition` fija qué se graba: por defecto, el estado en el momento de la llamada,
  // de modo que el WAV y el vídeo del exportador comparten la misma captura.
  async function renderExport({ cycles = 2, voiceBuffer = null, composition = null } = {}) {
    const ctx = getContext?.();
    if (!ctx) return null;
    const comp = composition ?? snapshot();
    const solo = comp.stemIds.some((id) => comp.mixer[id]?.solo);
    const stepSec = stepDurationSec(comp.bpm);
    const sampleRate = 44100;
    const baseSec = cycles * 12 * stepSec;
    const durationSec = baseSec + (voiceBuffer ? voiceBuffer.duration : 0) + 0.5;
    const offline = new OfflineAudioContext(2, Math.ceil(durationSec * sampleRate), sampleRate);

    for (let cycle = 0; cycle < cycles; cycle++) {
      for (let step = 0; step < 12; step++) {
        const t =
          0.05 + cycle * 12 * stepSec + step * stepSec + swingOffsetSec(comp.bpm, comp.swing, step);
        for (const id of comp.stemIds) {
          const cell = comp.steps[id]?.[step];
          if (!cell) continue;
          const m = comp.mixer[id];
          if (!m || m.mute) continue;
          if (solo && !m.solo) continue;
          engine.trigger(id, {
            time: t,
            accent: cell === 2,
            volume: m.volume,
            pan: m.pan,
            pitchShift: m.tuning,
            articulation: comp.articulation[id],
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

  /**
   * Copia inmutable de la composición. El exportador de vídeo y el visualizador
   * la reciben por valor: así graban exactamente lo que se ve en pantalla, sin
   * depender de leer el estado mientras el visitante sigue programando.
   */
  function snapshot() {
    return {
      patternId: state.patternId,
      bpm: state.bpm,
      swing: state.swing,
      steps: Object.fromEntries(STEM_IDS.map((id) => [id, [...state.steps[id]]])),
      mixer: Object.fromEntries(STEM_IDS.map((id) => [id, { ...state.mixer[id] }])),
      articulation: { ...state.articulation },
      stemIds: [...STEM_IDS]
    };
  }

  return {
    state,
    subscribe,
    snapshot,
    toggleCell,
    applyPreset,
    setArticulation,
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
