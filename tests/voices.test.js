import { describe, expect, it } from 'vitest';
import { voiceSpec, articulationLabel } from '../src/core/audio/voices.js';
import { DRUMS, articulationsFor, defaultArticulationFor } from '../src/data/drums.js';

const layersOf = (id, pitch, artic) => voiceSpec(id, pitch, artic);
const oscsOf = (spec) => spec.filter((s) => s.kind === 'osc');
const noiseOf = (spec) => spec.filter((s) => s.kind === 'noise');

describe('fulia: sólo los cuatro tambores y sus articulaciones', () => {
  it('son prima, cruzao, pujao y paila; sin maracas ni cuatro', () => {
    expect(DRUMS.map((d) => d.id)).toEqual(['prima', 'cruzao', 'pujao', 'paila']);
  });

  it('prima, cruzao y pujao admiten baqueta de laurel y mano abierta', () => {
    for (const id of ['prima', 'cruzao', 'pujao']) {
      expect(articulationsFor(id)).toEqual(['laurel', 'mano']);
    }
  });

  it('la paila no lleva baqueta: sólo mano abierta', () => {
    expect(articulationsFor('paila')).toEqual(['mano']);
    expect(defaultArticulationFor('paila')).toBe('mano');
  });

  it('el id del cruzao es opcional porque en algunas variantes se omite', () => {
    expect(DRUMS.find((d) => d.id === 'cruzao').optional).toBe(true);
  });
});

describe('voz: separo "qué tambor" de "cómo se golpea"', () => {
  it('el ataque depende de la articulación, no del tambor', () => {
    const conLaurel = layersOf('prima', 1, 'laurel');
    const conMano = layersOf('prima', 1, 'mano');
    // Mismo ataque en los cuatro tambores de doble parche...
    const ataqueLaurel = conLaurel[0].filter.freq;
    for (const id of ['prima', 'cruzao', 'pujao']) {
      expect(layersOf(id, 1, 'laurel')[0].filter.freq).toBe(ataqueLaurel);
    }
    // ...pero distinto con mano abierta.
    expect(conMano[0].filter.freq).not.toBe(ataqueLaurel);
    expect(ataqueLaurel).toBeGreaterThan(conMano[0].filter.freq);
  });

  it('el cuerpo conserva el tono propio de cada tambor', () => {
    const prima = oscsOf(layersOf('prima', 1, 'laurel'));
    const cruzao = oscsOf(layersOf('cruzao', 1, 'laurel'));
    const pujao = oscsOf(layersOf('pujao', 1, 'laurel'));
    expect(prima[0].from).toBeGreaterThan(cruzao[0].from);
    expect(cruzao[0].from).toBeGreaterThan(pujao[0].from);
  });

  it('la mano abierta apaga el anillo más que la baqueta de laurel', () => {
    const anilloDe = (artic) => {
      const spec = layersOf('prima', 1, artic);
      const anillo = oscsOf(spec).find((o) => o.type === 'triangle');
      return anillo.decay;
    };
    expect(anilloDe('mano')).toBeLessThan(anilloDe('laurel'));
  });

  it('la paila suena a timbal: anillo de concha que sobrevive a la mano', () => {
    const paila = layersOf('paila', 1);
    // El anillo de la paila aguanta más que el de la prima con la misma mano.
    const anilloPaila = oscsOf(paila).find((o) => o.type === 'triangle');
    const anilloPrima = oscsOf(layersOf('prima', 1, 'mano')).find((o) => o.type === 'triangle');
    expect(anilloPaila.decay).toBeGreaterThan(anilloPrima.decay);
  });

  it('una articulación no permitida cae en la del tambor, no en una inválida', () => {
    // La paila no admite laurel: debe sonar a mano, no a baqueta.
    expect(layersOf('paila', 1, 'laurel')).toEqual(layersOf('paila', 1, 'mano'));
    expect(layersOf('prima', 1, 'inventada')).toEqual(layersOf('prima', 1, 'laurel'));
  });

  it('articulationLabel devuelve la etiqueta legible', () => {
    expect(articulationLabel('prima', 'laurel')).toBe('Baqueta de laurel');
    expect(articulationLabel('paila')).toBe('Mano abierta');
  });
});

describe('voz: afinación y casos límite', () => {
  it('aplica pitchRatio a todas las frecuencias', () => {
    const uno = layersOf('prima', 1, 'laurel');
    const dos = layersOf('prima', 2, 'laurel');
    // El cuerpo y el anillo se afinan con el ratio...
    expect(oscsOf(dos)[0].from).toBe(oscsOf(uno)[0].from * 2);
    expect(oscsOf(dos)[0].to).toBe(oscsOf(uno)[0].to * 2);
    // ...y el ruido del ataque también (el brillo de la articulación es extra).
    expect(uno[0].filter.freq * 2).toBeCloseTo(dos[0].filter.freq);
  });

  it('sin artefactos: toda frecuencia y ganancia es un número finito positivo', () => {
    for (const id of ['prima', 'cruzao', 'pujao', 'paila']) {
      for (const s of layersOf(id, 1.25, 'laurel')) {
        const nums = [s.gain, s.decay, s.from, s.to, s.filter?.freq].filter((v) => v !== undefined);
        for (const n of nums) {
          expect(Number.isFinite(n), `${id} ${JSON.stringify(s)}`).toBe(true);
          expect(n).toBeGreaterThan(0);
        }
      }
    }
  });

  it('id desconocido devuelve []', () => {
    expect(voiceSpec('inventado', 1)).toEqual([]);
  });

  it('cada tambor tiene al menos un cuerpo y un ataque', () => {
    for (const id of ['prima', 'cruzao', 'pujao', 'paila']) {
      const spec = layersOf(id);
      expect(noiseOf(spec).length, id).toBeGreaterThan(0);
      expect(oscsOf(spec).length, id).toBeGreaterThan(0);
    }
  });
});
