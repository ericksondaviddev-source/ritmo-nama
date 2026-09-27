import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FINISHES, KIT_INCLUIDO, PRODUCTS } from '../src/data/catalog.js';

const ROOT = process.cwd();

describe('productos del catálogo', () => {
  it('son 4 tarjetas con ids únicos y assets que existen en disco', () => {
    expect(PRODUCTS).toHaveLength(4);
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(4);
    const [a, b, c, d] = PRODUCTS;
    expect(a.id).toBe('drumkid-multicolor');
    expect(b.id).toBe('drumkid-clasico');
    expect(c.id).toBe('set-nama');
    expect(d.id).toBe('personaliza');
    expect(d.isCta).toBe(true);
    for (const p of [a, b, c]) {
      expect(p.name).toBeTruthy();
      expect(p.tagline).toBeTruthy();
      expect(p.price).toMatch(/49/);
      expect(p.model.startsWith('/assets/models/')).toBe(true);
      expect(existsSync(path.join(ROOT, 'public', p.model))).toBe(true);
      expect(existsSync(path.join(ROOT, 'public', p.video))).toBe(true);
      expect(existsSync(path.join(ROOT, 'public', p.poster))).toBe(true);
    }
    expect(a.customizable).toBe(true);
    expect(b.customizable).toBe(true);
    expect(c.customizable).toBe(false);
  });
});

describe('kit incluido', () => {
  it('lista al menos 5 elementos con texto', () => {
    expect(KIT_INCLUIDO.length).toBeGreaterThanOrEqual(5);
    for (const item of KIT_INCLUIDO) expect(item.trim().length).toBeGreaterThan(3);
  });
});

describe('acabados', () => {
  it('define 3 zonas; cada una empieza por Original (#ffffff)', () => {
    expect(Object.keys(FINISHES).sort()).toEqual(['head', 'trim', 'wood']);
    for (const options of Object.values(FINISHES)) {
      expect(options.length).toBeGreaterThanOrEqual(3);
      expect(options[0]).toEqual({ id: 'original', label: 'Original', hex: '#ffffff' });
      for (const opt of options) expect(opt.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
