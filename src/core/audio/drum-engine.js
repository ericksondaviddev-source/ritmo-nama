import { getNoiseBuffer, getReverbImpulse, noiseOffset } from './noise.js';
import { voiceSpec } from './voices.js';

export function createDrumEngine(getContext, { masterVolume = 0.85, reverbLevel = 0.14 } = {}) {
  let master = null;
  let masterContext = null;
  let volume = masterVolume;

  function ensureMaster(ctx) {
    if (!master || masterContext !== ctx) {
      master = ctx.createGain();
      master.gain.value = volume;

      // Limitador antes del destino: cuatro tambores a la vez con sus capas
      // superuestas llegaban a 1.10 y recortaban. Comprime sólo el exceso.
      let node = master;
      if (typeof ctx.createDynamicsCompressor === 'function') {
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -6;
        limiter.knee.value = 3;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.18;
        node.connect(limiter);
        node = limiter;
      }

      // Seco al destino + húmedo por convolución (impulso procedural)
      if (typeof ctx.createConvolver === 'function') {
        const convolver = ctx.createConvolver();
        convolver.buffer = getReverbImpulse(ctx);
        const wet = ctx.createGain();
        wet.gain.value = reverbLevel;
        node.connect(ctx.destination);
        node.connect(convolver);
        convolver.connect(wet);
        wet.connect(ctx.destination);
      } else {
        node.connect(ctx.destination);
      }
      masterContext = ctx;
    }
    return master;
  }

  function renderVoice(ctx, spec, t, destination) {
    if (spec.kind === 'osc') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type;
      osc.frequency.setValueAtTime(spec.from, t);
      if (spec.glide > 0) osc.frequency.exponentialRampToValueAtTime(spec.to, t + spec.glide);
      gain.gain.setValueAtTime(spec.gain, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + spec.decay);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(t);
      osc.stop(t + spec.stop);
      return;
    }

    if (spec.kind === 'noise') {
      const source = ctx.createBufferSource();
      source.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = spec.filter.type;
      filter.frequency.setValueAtTime(spec.filter.freq, t);
      if (typeof spec.filter.q === 'number') filter.Q.setValueAtTime(spec.filter.q, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(spec.gain, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + spec.decay);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      const at = spec.at ?? 0;
      const stopAt = t + at + Math.max(spec.duration, spec.decay) + 0.01;
      source.start(t + at, noiseOffset(ctx));
      source.stop(stopAt);
    }
  }

  function trigger(
    id,
    { time, volume: hitVolume = 1, pan = 0, pitchShift = 0, accent = false, articulation = null, context = null } = {}
  ) {
    const ctx = context ?? getContext();
    if (!ctx) return;
    const t = typeof time === 'number' ? time : ctx.currentTime;

    const ratio = Math.pow(2, pitchShift / 12);
    const specs = voiceSpec(id, ratio, articulation);
    if (specs.length === 0) return;

    const out = ctx.createGain();
    out.gain.value = hitVolume * (accent ? 1.3 : 1);

    const masterNode = ensureMaster(ctx);
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(panner);
      panner.connect(masterNode);
    } else {
      out.connect(masterNode);
    }

    for (const spec of specs) renderVoice(ctx, spec, t, out);
  }

  return {
    trigger,
    // Conecta el master a un destino extra (p.ej. MediaStreamDestination para grabar)
    connectOutput(node) {
      const ctx = getContext();
      if (!ctx || !node) return;
      ensureMaster(ctx).connect(node);
    },
    // Desconecta el master de un destino extra
    disconnectOutput(node) {
      const ctx = getContext();
      if (!ctx || !node) return;
      ensureMaster(ctx).disconnect(node);
    },
    setMasterVolume(value) {
      volume = Math.max(0, Math.min(1, value));
      if (master) master.gain.value = volume;
    },
    getMasterVolume() {
      return volume;
    }
  };
}
