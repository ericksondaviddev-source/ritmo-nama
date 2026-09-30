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

  const makeNode = (type) => {
    const node = {
      type,
      connections: [],
      connect(target) {
        node.connections.push(target);
        return target;
      },
      disconnect(target) {
        if (target) node.connections = node.connections.filter((c) => c !== target);
        else node.connections = [];
      }
    };
    return node;
  };

  // Registro del grafo, para poder comprobar el orden de los nodos (que el
  // soft clip sea el último antes del destino, por ejemplo).
  const nodos = [];

  const context = {
    sampleRate,
    currentTime,
    state: 'running',
    destination: makeNode('destination'),
    log,
    nodos,
    get buffersCreated() {
      return buffersCreated;
    },
    createGain() {
      const node = makeNode('gain');
      node.gain = param(node, 'gain');
      log.push({ node, op: 'createGain' });
      nodos.push(node);
      return node;
    },
    createDynamicsCompressor() {
      const node = makeNode('compressor');
      node.threshold = param(node, 'threshold');
      node.knee = param(node, 'knee');
      node.ratio = param(node, 'ratio');
      node.attack = param(node, 'attack');
      node.release = param(node, 'release');
      log.push({ node, op: 'createDynamicsCompressor' });
      nodos.push(node);
      return node;
    },
    createWaveShaper() {
      const node = makeNode('waveshaper');
      node.curve = null;
      node.oversample = 'none';
      log.push({ node, op: 'createWaveShaper' });
      nodos.push(node);
      return node;
    },
    createConvolver() {
      const node = makeNode('convolver');
      node.buffer = null;
      log.push({ node, op: 'createConvolver' });
      nodos.push(node);
      return node;
    },
    createOscillator() {
      const node = makeNode('oscillator');
      node.type = 'sine';
      node.frequency = param(node, 'frequency');
      node.start = (t) => log.push({ node, op: 'start', t });
      node.stop = (t) => exigirTiempo('stop', t, log.push({ node, op: 'stop', t }));
      log.push({ node, op: 'createOscillator' });
      nodos.push(node);
      return node;
    },
    createBufferSource() {
      const node = makeNode('buffersource');
      node.buffer = null;
      node.start = (t, offset = 0) => log.push({ node, op: 'start', t, offset });
      node.stop = (t) => exigirTiempo('stop', t, log.push({ node, op: 'stop', t }));
      log.push({ node, op: 'createBufferSource' });
      nodos.push(node);
      return node;
    },
    createBiquadFilter() {
      const node = makeNode('filter');
      node.type = 'lowpass';
      node.frequency = param(node, 'frequency');
      node.Q = param(node, 'Q');
      log.push({ node, op: 'createBiquadFilter' });
      nodos.push(node);
      return node;
    },
    createStereoPanner() {
      const node = makeNode('panner');
      node.pan = param(node, 'pan');
      log.push({ node, op: 'createStereoPanner' });
      nodos.push(node);
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

  return context;
}
