export function createFakeAudioContext({ sampleRate = 48000, currentTime = 0 } = {}) {
  const log = [];
  let buffersCreated = 0;

  const param = (node, name) => ({
    value: 0,
    setValueAtTime(v, t) {
      log.push({ node, name, op: 'setValueAtTime', v, t });
      return this;
    },
    exponentialRampToValueAtTime(v, t) {
      log.push({ node, name, op: 'exponentialRampToValueAtTime', v, t });
      return this;
    },
    linearRampToValueAtTime(v, t) {
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
      node.stop = (t) => log.push({ node, op: 'stop', t });
      log.push({ node, op: 'createOscillator' });
      return node;
    },
    createBufferSource() {
      const node = makeNode('buffersource');
      node.buffer = null;
      node.start = (t, offset = 0) => log.push({ node, op: 'start', t, offset });
      node.stop = (t) => log.push({ node, op: 'stop', t });
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
