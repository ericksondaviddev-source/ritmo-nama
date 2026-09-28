import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACABADOS,
  KIT_INCLUIDO,
  MODELOS_3D,
  PRODUCTO_POR_DEFECTO,
  PRODUCTS,
  VIDEOS_TALLER
} from '../src/data/catalog.js';

const ROOT = process.cwd();
const enDisco = (ruta) => existsSync(path.join(ROOT, 'public', ruta.replace(/^\//, '')));
const reales = PRODUCTS.filter((p) => !p.isCta);

describe('productos del catálogo', () => {
  it('son 5 productos reales más la CTA, con ids únicos', () => {
    expect(PRODUCTS).toHaveLength(6);
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(6);
    expect(reales).toHaveLength(5);
    const cta = PRODUCTS.find((p) => p.isCta);
    expect(cta).toBeTruthy();
    expect(cta.customizes).toBeTruthy();
    expect(reales.some((p) => p.id === cta.customizes)).toBe(true);
  });

  it('cada producto real tiene nombre, precio, póster existente y sin 3D falso', () => {
    for (const p of reales) {
      expect(p.name).toBeTruthy();
      expect(p.tagline).toBeTruthy();
      expect(p.price).toBeTruthy();
      expect(p.poster).toMatch(/^\/assets\/img\//);
      expect(enDisco(p.poster)).toBe(true);
      // Sin escaneo => model explícitamente nulo (nunca una ruta inventada).
      if (p.model === null) expect(p.customizable).toBe(false);
      else {
        expect(p.model).toMatch(/^\/assets\/models\//);
        expect(enDisco(p.model)).toBe(true);
        expect(p.customizable).toBe(true);
      }
      if (p.video) {
        expect(p.video).toMatch(/^\/assets\/video\//);
        expect(enDisco(p.video)).toBe(true);
      }
    }
  });

  it('los tres escaneos están optimizados y pesan menos de 3 MB', () => {
    const con3d = reales.filter((p) => p.model);
    expect(con3d).toHaveLength(3);
    expect(new Set(MODELOS_3D).size).toBe(3);
    for (const p of con3d) {
      const bytes = require('node:fs').statSync(path.join(ROOT, 'public', p.model.replace(/^\//, ''))).size;
      expect(bytes).toBeLessThan(3 * 1024 * 1024);
    }
  });
});

describe('acabados honestos', () => {
  it('son los productos reales, cada uno con su imagen en disco', () => {
    expect(ACABADOS).toHaveLength(reales.length);
    expect(new Set(ACABADOS.map((a) => a.id)).size).toBe(reales.length);
    for (const a of ACABADOS) {
      expect(a.label).toBeTruthy();
      expect(a.image).toMatch(/^\/assets\/img\//);
      expect(enDisco(a.image)).toBe(true);
    }
  });

  it('el producto por defecto existe y es real', () => {
    expect(reales.some((p) => p.id === PRODUCTO_POR_DEFECTO)).toBe(true);
  });
});

describe('vídeos del taller', () => {
  it('existen en disco y tienen título', () => {
    expect(VIDEOS_TALLER.length).toBeGreaterThanOrEqual(2);
    for (const v of VIDEOS_TALLER) {
      expect(v.src).toMatch(/^\/assets\/video\//);
      expect(enDisco(v.src)).toBe(true);
      expect(v.titulo).toBeTruthy();
      if (v.poster) expect(enDisco(v.poster)).toBe(true);
    }
  });
});

describe('kit incluido', () => {
  it('lista al menos 5 elementos con texto', () => {
    expect(KIT_INCLUIDO.length).toBeGreaterThanOrEqual(5);
    for (const item of KIT_INCLUIDO) expect(item.trim().length).toBeGreaterThan(3);
  });
});
