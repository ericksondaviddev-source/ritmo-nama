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
    reproduciendo: false,
    master: 0.85,
    // Progreso secuencial Paila→Prima→Pujao→Cruzao: 3 compases completos por
    // tambor. Se persiste para que al volver a entrar siga donde quedó.
    progresoSecuencial: {
      pasoActual: 0,     // 0=Paila, 1=Prima, 2=Pujao, 3=Cruzao
      escuchasRealizadas: 0,
      maxEscuchas: 3,    // Desbloqueo después de 3 escuchas
      completado: false
    }
  };
  let scheduler = null;
  const listeners = new Set();
  // Vistas que siguen el ritmo: el visualizador se dibuja con estos eventos, así
  // que lo que se ve y lo que se oyen salen del mismo reloj.
  const oyentesDePaso = new Set();

  const CLAVE_PROGRESO = 'ritmo-nama-progreso';
  // Últo paso entregado: una escucha se cuenta al completar el compás (11 → 0),
  // no en cada paso. Contar por paso daba el título en un solo compás.
  let pasoAnterior = -1;

  function cargarProgreso() {
    try {
      if (typeof localStorage === 'undefined') return;
      const guardado = JSON.parse(localStorage.getItem(CLAVE_PROGRESO) ?? 'null');
      if (!guardado) return;
      const p = state.progresoSecuencial;
      if (Number.isInteger(guardado.pasoActual)) {
        p.pasoActual = Math.min(Math.max(guardado.pasoActual, 0), 3);
      }
      if (Number.isInteger(guardado.escuchasRealizadas)) {
        p.escuchasRealizadas = Math.min(Math.max(guardado.escuchasRealizadas, 0), p.maxEscuchas - 1);
      }
      p.completado = guardado.completado === true;
    } catch {
      // Sin localStorage (modo privado, JSON roto): el progreso vive en esta sesión.
    }
  }

  function guardarProgreso() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CLAVE_PROGRESO, JSON.stringify(state.progresoSecuencial));
      }
    } catch {
      // Cuota llena o almacenamiento bloqueado: no es crítico para tocar.
    }
  }
  cargarProgreso();

  /** Una escucha = un compás completo de 12 pasos. Al pasar de 3, avanza. */
  function actualizarProgresoSecuencial() {
    const p = state.progresoSecuencial;
    if (p.completado) return;
    p.escuchasRealizadas++;
    if (p.escuchasRealizadas >= p.maxEscuchas) {
      p.escuchasRealizadas = 0;
      p.pasoActual++;
      if (p.pasoActual >= 4) {
        p.pasoActual = 0;
        p.completado = true;
      }
    }
    guardarProgreso();
    emit();
  }

  /** Vuelve al principio de la secuencia (botón "Reiniciar" del estudio). */
  function reiniciarProgreso() {
    const p = state.progresoSecuencial;
    p.pasoActual = 0;
    p.escuchasRealizadas = 0;
    p.completado = false;
    pasoAnterior = -1;
    guardarProgreso();
    emit();
  }

  function emit() {
    for (const fn of listeners) fn(state);
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /** Se llama en cada paso, con el instante de audio ya fijado. */
  function onStepDelRitmo(step, time, golpeados) {
    for (const fn of oyentesDePaso) fn(step, time, golpeados);
    const compasCompleto = pasoAnterior === 11 && step === 0;
    pasoAnterior = step;
    if (compasCompleto) actualizarProgresoSecuencial();
  }

  function alTocarElRitmo(fn) {
    oyentesDePaso.add(fn);
    return () => oyentesDePaso.delete(fn);
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
        const golpeados = [];
        for (const id of STEM_IDS) {
          const cell = state.steps[id][step];
          if (cell > 0) {
            playHit(id, time, cell);
            golpeados.push({ id, acento: cell === 2 });
          }
        }
        onStepDelRitmo(step, time, golpeados);
      }
    });
    scheduler.start();
    // `reproduciendo` es la señal de que hay ritmo corriendo: la usan el
    // visualizador y la grabación para seguir al transporte sin parchear
    // métodos desde fuera.
    state.reproduciendo = true;
    emit();
    return scheduler;
  }

  function stop() {
    scheduler?.stop();
    scheduler = null;
    if (state.reproduciendo) {
      state.reproduciendo = false;
      emit();
    }
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
    alTocarElRitmo,
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
    reiniciarProgreso,
    soloActive,
    get isRunning() {
      return Boolean(scheduler?.isRunning);
    }
  };
}

export { STEM_IDS };
