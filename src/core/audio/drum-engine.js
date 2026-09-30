import { getNoiseBuffer, getReverbImpulse, noiseOffset } from './noise.js';
import { voiceSpec } from './voices.js';
import { curvaSoftClip } from './softclip.js';

export function createDrumEngine(getContext, { masterVolume = 0.85, reverbLevel = 0.14 } = {}) {
  let master = null;
  let masterContext = null;
  let volume = masterVolume;

  function ensureMaster(ctx) {
    if (!master || masterContext !== ctx) {
      master = ctx.createGain();
      master.gain.value = volume;

      let node = master;

      // Seco y húmedo se suman ANTES de limitar. Antes el seco pasaba por el
      // compresor y el soft clip, pero la cola de reverb iba en paralelo
      // directamente al destino: se escapaba del tope y el render medido
      // llegaba a 1,01-1,05, es decir, con muestras ya recortadas.
      if (typeof ctx.createConvolver === 'function') {
        const convolver = ctx.createConvolver();
        convolver.buffer = getReverbImpulse(ctx);
        const wet = ctx.createGain();
        wet.gain.value = reverbLevel;
        const suma = ctx.createGain();
        node.connect(suma);
        node.connect(convolver);
        convolver.connect(wet);
        wet.connect(suma);
        node = suma;
      }

      // Y después el compresor y el soft clip, ya con la reverb dentro.
      if (typeof ctx.createDynamicsCompressor === 'function') {
        const limitador = ctx.createDynamicsCompressor();
        limitador.threshold.value = -6;
        limitador.knee.value = 3;
        limitador.ratio.value = 12;
        limitador.attack.value = 0.003;
        limitador.release.value = 0.18;
        node.connect(limitador);
        node = limitador;
      }

      // El soft clip va el último y es la garantía dura: con la curva por
      // encima, la salida no pasa de 1 aunque todo lo demás se pase.
      if (typeof ctx.createWaveShaper === 'function') {
        const shaper = ctx.createWaveShaper();
        shaper.curve = curvaSoftClip();
        shaper.oversample = '4x';
        node.connect(shaper);
        node = shaper;
      }

      node.connect(ctx.destination);
      masterContext = ctx;
    }
    return master;
  }

  /**
 * Un valor no finito en un parámetro de AudioParam lanza una excepción que
 * corta el golpe entero. Aquí se filtra y se sustituye por un valor seguro, para
 * que un dato mal escrito degrade el sonido en vez de silenciar la app.
 */
const finito = (v, porDefecto) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : porDefecto);

function renderVoice(ctx, spec, t, destination) {
    if (spec.kind === 'osc') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const from = finito(spec.from, 220);
      const to = finito(spec.to, from);
      const decay = finito(spec.decay, 0.2);
      const stop = finito(spec.stop, decay + 0.02);
      osc.type = spec.type ?? 'sine';
      osc.frequency.setValueAtTime(from, t);
      if (finito(spec.glide, 0) > 0) osc.frequency.exponentialRampToValueAtTime(to, t + spec.glide);
      gain.gain.setValueAtTime(finito(spec.gain, 0.5), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(t);
      osc.stop(t + stop);
      return;
    }

    if (spec.kind === 'noise') {
      const source = ctx.createBufferSource();
      source.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = spec.filter?.type ?? 'lowpass';
      const freq = finito(spec.filter?.freq, 1000);
      filter.frequency.setValueAtTime(freq, t);
      if (typeof spec.filter?.q === 'number' && Number.isFinite(spec.filter.q)) {
        filter.Q.setValueAtTime(spec.filter.q, t);
      }
      const gain = ctx.createGain();
      const decay = finito(spec.decay, 0.06);
      gain.gain.setValueAtTime(finito(spec.gain, 0.4), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      const at = Number.isFinite(spec.at) ? spec.at : 0;
      // `duration` es imprescindible: Math.max(undefined, decay) es NaN y
      // AudioBufferSourceNode.stop(NaN) lanza.
      const duration = finito(spec.duration, decay);
      source.start(t + at, noiseOffset(ctx));
      source.stop(t + at + Math.max(duration, decay) + 0.01);
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
