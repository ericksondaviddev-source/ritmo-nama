export function createFakeAudioContext({ sampleRate = 48000, currentTime = 0 } = {}) {
  const log = [];
  let buffersCreated = 0;

  /**
   * El navegador lanza TypeError si se programa un tiempo no finito, y con él
   * se cae el golpe entero. Este doble lo imita para que un `duration` olvidado
   * (o un NaN) falle en los tests y no en el navegador.
   */
  const exigirTiempo = (op, t, registrar) => {
    if (typeof t !== 'number' || !Number.isFinite(t)) {
      throw new TypeError(`Failed to execute '${op}' on 'AudioScheduledSourceNode': non-finite time`);
    }
    return registrar;
  };

  const param = (node, name) => ({
    value: 0,
    setValueAtTime(v, t) {
      exigirTiempo('setValueAtTime', t, null);
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new TypeError(`Failed to execute 'setValueAtTime' on 'AudioParam': non-finite value`);
      }
      log.push({ node, name, op: 'setValueAtTime', v, t });
      return this;
    },
    exponentialRampToValueAtTime(v, t) {
      exigirTiempo('exponentialRampToValueAtTime', t, null);
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new TypeError(`Failed to execute 'exponentialRampToValueAtTime' on 'AudioParam': non-finite value`);
      }
      log.push({ node, name, op: 'exponentialRampToValueAtTime', v, t });
      return this;
    },
    linearRampToValueAtTime(v, t) {
      exigirTiempo('linearRampToValueAtTime', t, null);
      log.push({ node, name, op: 'linearRampToValueAtTime', v, t });
      return this;
    }
  });

  const makeNode = (type) => ({
    type,
    connections: [],
    connect(target) {
      this.connections.push(target);
      return target;
    },
    disconnect(target) {
      if (target) this.connections = this.connections.filter((c) => c !== target);
      else this.connections = [];
    }
  });

  return {
    sampleRate,
    currentTime,
    state: 'running',
    destination: makeNode('destination'),
    log,
    get buffersCreated() {
      return buffersCreated;
    },
    createGain() {
      const node = makeNode('gain');
      node.gain = param(node, 'gain');
      log.push({ node, op: 'createGain' });
      return node;
    },
    createOscillator() {
      const node = makeNode('oscillator');
      node.type = 'sine';
      node.frequency = param(node, 'frequency');
      node.start = (t) => log.push({ node, op: 'start', t });
      node.stop = (t) => exigirTiempo('stop', t, log.push({ node, op: 'stop', t }));
      log.push({ node, op: 'createOscillator' });
      return node;
    },
    createBufferSource() {
      const node = makeNode('buffersource');
      node.buffer = null;
      node.start = (t, offset = 0) => log.push({ node, op: 'start', t, offset });
      node.stop = (t) => exigirTiempo('stop', t, log.push({ node, op: 'stop', t }));
      log.push({ node, op: 'createBufferSource' });
      return node;
    },
    createBiquadFilter() {
      const node = makeNode('filter');
      node.type = 'lowpass';
      node.frequency = param(node, 'frequency');
      node.Q = param(node, 'Q');
      log.push({ node, op: 'createBiquadFilter' });
      return node;
    },
    createStereoPanner() {
      const node = makeNode('panner');
      node.pan = param(node, 'pan');
      log.push({ node, op: 'createStereoPanner' });
      return node;
    },
    createBuffer(channels, length, rate) {
      buffersCreated += 1;
      const data = new Float32Array(length);
      return {
        numberOfChannels: channels,
        length,
        sampleRate: rate,
        getChannelData: () => data
      };
    }
  };
}
