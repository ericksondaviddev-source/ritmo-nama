import { describe, expect, it } from 'vitest';
import { REGION_ORDER, classifyVertex, partitionTriangles } from '../src/core/three/regions.js';

describe('classifyVertex', () => {
  it('normal vertical (parche)', () => {
    expect(classifyVertex({ nx: 0, ny: 1, x: 0.1, z: 0 }, { radiusThreshold: 0.5 })).toBe('head');
  });
  it('radio por encima del umbral (lazos/baqueta)', () => {
    expect(classifyVertex({ nx: 1, ny: 0, x: 0.6, z: 0 }, { radiusThreshold: 0.5 })).toBe('trim');
  });
  it('radio bajo y normal horizontal (cilindro)', () => {
    expect(classifyVertex({ nx: 1, ny: 0, x: 0.3, z: 0 }, { radiusThreshold: 0.5 })).toBe('wood');
  });
  it('normal inclinada bajo el umbral no es parche', () => {
    expect(classifyVertex({ nx: 0, ny: 0.3, x: 0, z: 0 }, { normalThreshold: 0.7 })).toBe('wood');
  });
});

// Geometría sintética: 3 triángulos con 9 vértices (0-8)
const positions = new Float32Array([
  // tri 0 — parche (y alto, normal +Y)
  0, 0.3, 0, 0.1, 0.3, 0, 0, 0.3, 0.1,
  // tri 1 — cilindro (radio < 0.5)
  0.2, 0, 0, 0.3, 0, 0, 0.2, 0, 0.1,
  // tri 2 — trim (radio > 0.5)
  0.6, 0, 0, 0.7, 0, 0, 0.6, 0, 0.1
]);
const normals = new Float32Array([
  0, 1, 0, 0, 1, 0, 0, 1, 0,
  1, 0, 0, 1, 0, 0, 1, 0, 0,
  1, 0, 0, 1, 0, 0, 1, 0, 0
]);
const index = new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8]);
const OPTS = { normalThreshold: 0.7, radiusThreshold: 0.5 };

function triplets(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i += 3) out.push([arr[i], arr[i + 1], arr[i + 2]].join(','));
  return out.sort();
}

describe('partitionTriangles', () => {
  const res = partitionTriangles(index, positions, normals, OPTS);

  it('cuenta un triángulo por región', () => {
    expect(res.counts).toEqual({ wood: 1, head: 1, trim: 1 });
  });

  it('grupos contiguos, en REGION_ORDER y que cubren todo el índice', () => {
    expect(res.groups.map((g) => g.region)).toEqual(REGION_ORDER);
    let cursor = 0;
    for (const g of res.groups) {
      expect(g.start).toBe(cursor);
      expect(g.count % 3).toBe(0);
      cursor += g.count;
    }
    expect(cursor).toBe(index.length);
    expect(res.index.length).toBe(index.length);
  });

  it('preserva los triángulos enteros (nada de índices sueltos)', () => {
    expect(triplets(res.index)).toEqual(triplets(index));
  });

  it('triángulo con votos mixtos usa la mayoría', () => {
    // 2 vértices parche + 1 cilindro → head
    const p = new Float32Array([0, 0.3, 0, 0.1, 0.3, 0, 0.2, 0, 0.1]);
    const n = new Float32Array([0, 1, 0, 0, 1, 0, 1, 0, 0]);
    const r = partitionTriangles(new Uint32Array([0, 1, 2]), p, n, OPTS);
    expect(r.counts.head).toBe(1);
  });
});
