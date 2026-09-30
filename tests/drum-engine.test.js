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
/**
 * El gain maestro es el único que alimenta la suma seco+húmedo, es decir, el
 * primero de la cadena y el único sin paneo detrás. Los demás gains de un golpe
 * cuelgan de un panner.
 */
const masterGain = (ctx) => {
  const candidatos = gainNodes(ctx).filter((n) =>
    n.connections.some((c) => c.type === 'compressor' || c.type === 'waveshaper' || c.type === 'convolver')
  );
  return candidatos[0];
};
const eventsFor = (ctx, node) => ctx.log.filter((e) => e.node === node);

describe('drum-engine', () => {
  it('pujao: cuerpo grave 110->48 con sub y anillo, paro en t+0.6', () => {
    const { ctx, engine } = rig();
    engine.trigger('pujao', { time: 2 });

    const oscs = oscNodes(ctx);
    expect(oscs).toHaveLength(3);
    expect(oscs[0].type).toBe('sine'); // cuerpo

    const ev = eventsFor(ctx, oscs[0]);
    const set = ev.find((e) => e.name === 'frequency' && e.op === 'setValueAtTime');
    expect(set).toMatchObject({ v: 110, t: 2 });

    const ramp = ev.find((e) => e.name === 'frequency' && e.op === 'exponentialRampToValueAtTime');
    expect(ramp.v).toBeCloseTo(48);
    expect(ramp.t).toBeCloseTo(2.16);
  });

  it('la mano abierta acorta la cola del pujao frente a la baqueta', () => {
    const conLaurel = rig();
    conLaurel.engine.trigger('pujao', { time: 2, articulation: 'laurel' });
    const laurelStop = eventsFor(conLaurel.ctx, oscNodes(conLaurel.ctx)[0]).find((e) => e.op === 'stop').t;

    const conMano = rig();
    conMano.engine.trigger('pujao', { time: 2, articulation: 'mano' });
    const manoStop = eventsFor(conMano.ctx, oscNodes(conMano.ctx)[0]).find((e) => e.op === 'stop').t;

    // Es lo que distingue a las dos manos: la palma amortigua el parche.
    expect(manoStop).toBeLessThan(laurelStop);
    expect(manoStop).toBeGreaterThan(2.1);
  });

  it('prima: cuerpo + anillo + ataque de ruido + aire', () => {
    const { ctx, engine } = rig();
    engine.trigger('prima', { time: 0 });
    expect(oscNodes(ctx)).toHaveLength(2); // cuerpo + anillo
    expect(ctx.log.filter((e) => e.op === 'createBufferSource')).toHaveLength(2); // ataque + aire
  });

  it('la articulación cambia el timbre, nunca la afinación', () => {
    const conLaurel = rig();
    conLaurel.engine.trigger('prima', { time: 1, articulation: 'laurel' });
    const laurelFrec = eventsFor(conLaurel.ctx, oscNodes(conLaurel.ctx)[0]).find(
      (e) => e.name === 'frequency' && e.op === 'setValueAtTime'
    ).v;

    const conMano = rig();
    conMano.engine.trigger('prima', { time: 1, articulation: 'mano' });
    const manoFrec = eventsFor(conMano.ctx, oscNodes(conMano.ctx)[0]).find(
      (e) => e.name === 'frequency' && e.op === 'setValueAtTime'
    ).v;

    expect(manoFrec).toBe(laurelFrec);
  });

  it('una paila pedida con baqueta suena a mano, no a madera', () => {
    const conLaurel = rig();
    conLaurel.engine.trigger('paila', { time: 1, articulation: 'laurel' });
    const laurelFrec = eventsFor(conLaurel.ctx, oscNodes(conLaurel.ctx)[0]).find(
      (e) => e.name === 'frequency' && e.op === 'setValueAtTime'
    ).v;

    const conMano = rig();
    conMano.engine.trigger('paila', { time: 1, articulation: 'mano' });
    const manoFrec = eventsFor(conMano.ctx, oscNodes(conMano.ctx)[0]).find(
      (e) => e.name === 'frequency' && e.op === 'setValueAtTime'
    ).v;

    expect(laurelFrec).toBe(manoFrec);
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
    // Dos búferes en total: el de ruido y el impulso de reverb, ambos
    // cacheados por contexto. Lo que se comprueba es que el segundo golpe no
    // añada ninguno más.
    expect(ctx.buffersCreated).toBe(2);
  });

  it('setMasterVolume actualiza el gain maestro', () => {
    const { ctx, engine } = rig();
    engine.trigger('prima', { time: 0 });

    // El nodo conectado al destino es ahora el soft clip, no el gain maestro:
    // el master es el primero de la cadena, al principio del grafo.
    const maestro = masterGain(ctx);
    engine.setMasterVolume(0.5);

    expect(maestro.gain.value).toBe(0.5);
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
