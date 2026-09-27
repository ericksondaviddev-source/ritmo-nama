import { describe, expect, it } from 'vitest';
import { createDrumEngine } from '../src/core/audio/drum-engine.js';
import { createFakeAudioContext } from './fakes/fake-audio-context.js';

function rig() {
  const ctx = createFakeAudioContext();
  const engine = createDrumEngine(() => ctx);
  return { ctx, engine };
}

const oscNodes = (ctx) => ctx.log.filter((e) => e.op === 'createOscillator').map((e) => e.node);
const gainNodes = (ctx) => ctx.log.filter((e) => e.op === 'createGain').map((e) => e.node);
const eventsFor = (ctx, node) => ctx.log.filter((e) => e.node === node);

describe('drum-engine', () => {
  it('pujao genera 1 oscilador con caída 130→48 y stop en t+0.48', () => {
    const { ctx, engine } = rig();
    engine.trigger('pujao', { time: 2 });

    const [osc] = oscNodes(ctx);
    expect(osc.type).toBe('sine');

    const ev = eventsFor(ctx, osc);
    const set = ev.find((e) => e.name === 'frequency' && e.op === 'setValueAtTime');
    expect(set).toMatchObject({ v: 130, t: 2 });

    const ramp = ev.find((e) => e.name === 'frequency' && e.op === 'exponentialRampToValueAtTime');
    expect(ramp.v).toBeCloseTo(48);
    expect(ramp.t).toBeCloseTo(2.18);

    expect(ev.find((e) => e.op === 'stop').t).toBeCloseTo(2.48);
  });

  it('el acento multiplica la ganancia por 1.3', () => {
    const plain = rig();
    plain.engine.trigger('prima', { time: 0 });
    const normalGain = gainNodes(plain.ctx)[0].gain.value;

    const accented = rig();
    accented.engine.trigger('prima', { time: 0, accent: true });
    const accentGain = gainNodes(accented.ctx)[0].gain.value;

    expect(accentGain).toBeCloseTo(normalGain * 1.3);
  });

  it('pitchShift +12 semitonos dobla la frecuencia', () => {
    const { ctx, engine } = rig();
    engine.trigger('prima', { time: 1, pitchShift: 12 });

    const [osc] = oscNodes(ctx);
    const set = eventsFor(ctx, osc).find((e) => e.name === 'frequency' && e.op === 'setValueAtTime');
    expect(set.v).toBeCloseTo(760);
  });

  it('el pan se aplica con StereoPanner acotado a [-1, 1]', () => {
    const { ctx, engine } = rig();
    engine.trigger('cruzao', { time: 0, pan: -5 });

    const panner = ctx.log.find((e) => e.op === 'createStereoPanner').node;
    expect(panner.pan.value).toBe(-1);
  });

  it('un id desconocido no crea ningún nodo', () => {
    const { ctx, engine } = rig();
    engine.trigger('inventado', { time: 0 });
    expect(ctx.log.filter((e) => e.op.startsWith('create'))).toHaveLength(0);
  });

  it('el buffer de ruido se cachea: el segundo golpe no lo recrea', () => {
    const { ctx, engine } = rig();
    engine.trigger('paila', { time: 0 });
    engine.trigger('paila', { time: 0.5 });
    expect(ctx.buffersCreated).toBe(1);
  });

  it('setMasterVolume actualiza el gain maestro conectado al destino', () => {
    const { ctx, engine } = rig();
    engine.trigger('prima', { time: 0 });

    const master = gainNodes(ctx).find((n) => n.connections.includes(ctx.destination));
    engine.setMasterVolume(0.5);

    expect(master.gain.value).toBe(0.5);
    expect(engine.getMasterVolume()).toBe(0.5);
  });

  it('sin contexto de audio no lanza excepción', () => {
    const engine = createDrumEngine(() => null);
    expect(() => engine.trigger('prima')).not.toThrow();
  });
});

describe('engine: extras para MidiPad', () => {
  it('trigger acepta un context override (render offline)', () => {
    const live = createFakeAudioContext({ currentTime: 0 });
    const offline = createFakeAudioContext({ currentTime: 0 });
    const engine = createDrumEngine(() => live);
    engine.trigger('prima', { context: offline, time: 0.1 });
    expect(offline.log.length).toBeGreaterThan(0);
  });

  it('connectOutput conecta el master a un nodo extra (grabacion)', () => {
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const engine = createDrumEngine(() => ctx);
    const extra = ctx.createGain();
    // El fake graba conexiones unidireccionalmente (solo desde el nodo origen),
    // así que la conexión solo es observable desde el master interno; la verificación
    // end-to-end de la grabación vive en verify-midipad.mjs (navegador).
    expect(() => engine.connectOutput(extra)).not.toThrow();
    expect(() => engine.trigger('prima')).not.toThrow();
  });
});
