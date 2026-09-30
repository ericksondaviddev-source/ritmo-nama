import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACABADOS,
  HERO,
  KIT_INCLUIDO,
  MEDIOS_PENDIENTES,
  MODELOS_3D,
  PRODUCTO_POR_DEFECTO,
  PRODUCTS,
  VIDEOS_TALLER
} from '../src/data/catalog.js';

const ROOT = process.cwd();
const enDisco = (ruta) => Boolean(ruta) && existsSync(path.join(ROOT, 'public', ruta.replace(/^\//, '')));
const reales = PRODUCTS.filter((p) => !p.isCta);

describe('productos del catálogo', () => {
  it('son 6 productos reales más la CTA, con ids únicos', () => {
    // El gris plateado se retiró del catálogo y el Kit Clásico se fusionó con el
    // Tambor Rojo con Kit: de 8 productos reales se pasa a 6.
    expect(PRODUCTS).toHaveLength(7);
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(7);
    expect(reales).toHaveLength(6);
    const cta = PRODUCTS.find((p) => p.isCta);
    expect(cta).toBeTruthy();
    expect(reales.some((p) => p.id === cta.customizes)).toBe(true);
  });

  it('el gris plateado ya no está en ninguna parte', () => {
    expect(PRODUCTS.some((p) => p.id.includes('gris'))).toBe(false);
    expect(reales.some((p) => p.modelo?.includes('GrisPlateado'))).toBe(false);
    expect(reales.some((p) => p.foto?.includes('GrisPlateado'))).toBe(false);
    expect(MODELOS_3D.some((id) => id.includes('gris'))).toBe(false);
    expect(existsSync(path.join(ROOT, 'public', 'assets', 'drums', 'GrisPlateado'))).toBe(false);
  });

  it('el Kit Clásico se fusionó dentro del Tambor Rojo con Kit', () => {
    // Eran dos fichas con el mismo producto partido: una con 3D y sin foto, y
    // otra con foto y vídeo y sin 3D. Fusionadas, la ficha lo tiene todo.
    expect(PRODUCTS.some((p) => p.id === 'kit-clasico')).toBe(false);
    const kit = reales.find((p) => p.id === 'rojo-con-kit');
    expect(kit).toBeTruthy();
    expect(kit.name).toBe('Tambor Rojo con Kit');
    expect(kit.modelo, 'el 3D se conserva').toBeTruthy();
    expect(kit.foto, 'hereda la foto del kit').toBeTruthy();
    expect(kit.video, 'hereda el vídeo del kit').toBeTruthy();
  });

  it('un tambor = una carpeta: los medios de un producto salen todos de ella', () => {
    // El invariante del módulo: producto = carpeta. La fusión no debe dejar un
    // producto apuntando a medios de dos carpetas distintas.
    for (const p of reales) {
      const carpetas = new Set(
        [p.modelo, p.foto, p.video].filter(Boolean).map((r) => r.split('/')[3])
      );
      expect(carpetas.size, `${p.id} mezcla carpetas: ${[...carpetas].join(', ')}`).toBe(1);
    }
  });

  it('cada medio declarado existe en disco', () => {
    for (const p of reales) {
      expect(p.name).toBeTruthy();
      expect(p.tagline).toBeTruthy();
      expect(p.precio).toBeTruthy();
      if (p.modelo) {
        expect(p.modelo, p.id).toMatch(/^\/assets\/drums\/[^/]+\/modelo\.glb$/);
        expect(enDisco(p.modelo), p.id).toBe(true);
        expect(p.personalizable, p.id).toBe(true);
      } else {
        expect(p.personalizable, p.id).toBe(false);
      }
      if (p.foto) {
        expect(p.foto, p.id).toMatch(/^\/assets\/drums\/[^/]+\/foto\.webp$/);
        expect(enDisco(p.foto), p.id).toBe(true);
      }
      if (p.video) {
        expect(p.video, p.id).toMatch(/^\/assets\/(drums\/[^/]+\/)?video\.mp4$|^\/assets\/video\//);
        expect(enDisco(p.video), p.id).toBe(true);
      }
    }
  });

  it('los seis escaneos están optimizados y pesan menos de 3 MB', () => {
    const con3d = reales.filter((p) => p.modelo);
    expect(con3d).toHaveLength(6);
    expect(new Set(MODELOS_3D).size).toBe(6);
    for (const p of con3d) {
      const bytes = statSync(path.join(ROOT, 'public', p.modelo.replace(/^\//, ''))).size;
      expect(bytes, p.id).toBeLessThan(3 * 1024 * 1024);
    }
  });

  it('las fotos pesan poco: son miniaturas de tarjeta, no originales', () => {
    for (const p of reales.filter((x) => x.foto)) {
      const bytes = statSync(path.join(ROOT, 'public', p.foto.replace(/^\//, ''))).size;
      expect(bytes, p.id).toBeLessThan(150 * 1024);
    }
  });

  it('el tricolor es el destacado y sale en el hero', () => {
    const tricolor = reales.find((p) => p.id === 'tricolor');
    expect(tricolor).toBeTruthy();
    expect(tricolor.destacado).toBe(true);
    expect(PRODUCTO_POR_DEFECTO).toBe('tricolor');
    expect(HERO.modelo).toBe(tricolor.modelo);
  });

  it('ya no está el tambor negro con chispas', () => {
    expect(PRODUCTS.some((p) => p.id.includes('negro'))).toBe(false);
  });
});

describe('acabados honestos', () => {
  it('son los productos reales, cada uno con su imagen', () => {
    expect(ACABADOS).toHaveLength(reales.length);
    expect(new Set(ACABADOS.map((a) => a.id)).size).toBe(reales.length);
    for (const a of ACABADOS) {
      expect(a.label).toBeTruthy();
      if (a.image) expect(enDisco(a.image), a.id).toBe(true);
      else expect(a.image).toBeNull();
    }
  });
});

// Regresión: un producto sin foto llegó al `src` de la <img> y produjo
// `src="null"`. Se comprueba sobre el HTML realmente generado.
describe('marcado del catálogo', () => {
  it('el marcador de foto pendiente existe aunque ya ningún producto lo necesite', async () => {
    // Ya no hay productos sin foto, pero el marcador sigue siendo la red de
    // seguridad si una imagen falla al cargar. Se comprueba sobre el marcado,
    // no confiando en que quede algún producto a medio montar.
    const { __sinFotoMarkup } = await import('../src/components/catalog.js');
    const html = __sinFotoMarkup();
    expect(html).toContain('Foto pendiente');
    expect(html).not.toMatch(/src="(null|undefined|)"/);
  });

  it('el componente no emite src nulo, undefined ni vacío', async () => {
    const { __catalogMarkup } = await import('../src/components/catalog.js');
    const html = __catalogMarkup();
    expect(html).toContain('data-card=');
    expect(html).not.toMatch(/src="(null|undefined|)"/);
    // Para cada producto sin foto tiene que salir su marcador.
    for (const p of reales.filter((x) => !x.foto)) {
      expect(html, p.id).toContain('Foto pendiente');
    }
  });

  it('toda ruta de medio que aparece en el HTML existe en disco', async () => {
    const { __catalogMarkup } = await import('../src/components/catalog.js');
    const rutas = [...__catalogMarkup().matchAll(/(?:src|poster)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    expect(rutas.length).toBeGreaterThan(0);
    for (const r of rutas) expect(enDisco(r), r).toBe(true);
  });

  it('los vídeos del taller no son mudos: tienen controles de volumen', async () => {
    const { __catalogMarkup } = await import('../src/components/catalog.js');
    const html = __catalogMarkup();
    for (const v of VIDEOS_TALLER) {
      const trozo = html.slice(html.indexOf(`src="${v.src}"`), html.indexOf(`src="${v.src}"`) + 400);
      expect(trozo, v.id).toContain('controls');
      // Un vídeo con controles y sin sonido engaña al visitante.
      expect(trozo.match(/muted/g), v.id).toBeNull();
    }
  });

  it('cada vídeo del taller trae póster, para no ver una caja negra', async () => {
    // Con preload="none" y sin póster, hasta que se pulsa reproducir la sección
    // es una rejilla de rectángulos negros, que es justo lo que parece que no
    // ha cargado.
    for (const v of VIDEOS_TALLER) {
      expect(v.poster, `${v.id} sin póster`).toBeTruthy();
      expect(enDisco(v.poster), v.id).toBe(true);
    }
    const { __catalogMarkup } = await import('../src/components/catalog.js');
    const html = __catalogMarkup();
    for (const v of VIDEOS_TALLER) {
      expect(html, v.id).toContain(`poster="${v.poster}"`);
    }
  });

  it('las tarjetas de producto con vídeo también llevan póster', async () => {
    const { __catalogMarkup } = await import('../src/components/catalog.js');
    const html = __catalogMarkup();
    for (const p of reales.filter((x) => x.video)) {
      const esperado = p.poster;
      expect(esperado, `${p.id} sin póster`).toBeTruthy();
      expect(enDisco(esperado), p.id).toBe(true);
      expect(html, p.id).toContain(`poster="${esperado}"`);
    }
  });
});

describe('medios pendientes', () => {
  it('ya no queda ningún medio pendiente de los seis tambores', () => {
    // Con los vídeos nuevos instalados, cada producto real tiene 3D, foto y
    // vídeo. Si esto vuelve a listar algo, es que falta instalar material.
    expect(MEDIOS_PENDIENTES).toEqual([]);
  });

  it('la lista de pendientes es coherente con los productos', () => {
    for (const m of MEDIOS_PENDIENTES) {
      const p = reales.find((x) => x.id === m.id);
      expect(p, m.id).toBeTruthy();
      if (m.falta.includes('foto')) expect(p.foto, m.id).toBeFalsy();
      if (m.falta.includes('vídeo')) expect(p.video, m.id).toBeFalsy();
      if (m.falta.includes('3D')) expect(p.modelo, m.id).toBeFalsy();
    }
  });

  it('no lista como pendiente un tambor que sí tiene sus tres medios', () => {
    for (const p of reales) {
      if (p.modelo && p.foto && p.video) {
        expect(MEDIOS_PENDIENTES.some((m) => m.id === p.id), p.id).toBe(false);
      }
    }
  });
});

describe('hero', () => {
  it('el fondo de vídeo existe y va sin audio', () => {
    expect(enDisco(HERO.videoFondo)).toBe(true);
    expect(enDisco(HERO.posterFondo)).toBe(true);
    expect(enDisco(HERO.modelo)).toBe(true);
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const i = html.indexOf('data-hero-video-el');
    expect(i).toBeGreaterThan(-1);
    const trozo = html.slice(i, i + 500);
    expect(trozo).toContain('muted');
    expect(trozo).toContain('playsinline');
    expect(trozo).not.toMatch(/\son[a-z]*=/); // ni controls ni autoplay con sonido
  });

  it('el fondo del hero se ve de verdad: no lo tapan hasta casi borrarlo', () => {
    // Regresión: el vídeo llevaba opacity-40 y encima un gradiente
    // via-zinc-950/80, así que la opacidad efectiva era de un ~8% y el vídeo
    // "no se veía". Ahora el vídeo tiene que pesar lo suficiente por sí solo.
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const i = html.indexOf('data-hero-video-el');
    const trozo = html.slice(i, i + 500);
    const opacidad = Number(trozo.match(/opacity-(\d+)/)?.[1] ?? 0);
    expect(opacidad, 'el vídeo del hero está tan atenuado que no se ve').toBeGreaterThanOrEqual(50);

    // Y el gradiente de encima no debe ahogarlo: mide su punto más opaco.
    const gradiente = html.slice(html.indexOf('bg-gradient-to-b'), html.indexOf('bg-gradient-to-b') + 300);
    const capa = gradiente.match(/via-zinc-950\/(\d+)/)?.[1];
    if (capa) expect(Number(capa), 'el gradiente tapa el vídeo').toBeLessThanOrEqual(75);
  });

  it('el hero usa el vídeo de los niños tocando, no el de la plaza', () => {
    expect(HERO.videoFondo).toContain('ninos-tocando');
    expect(enDisco(HERO.videoFondo)).toBe(true);
    expect(enDisco(HERO.posterFondo)).toBe(true);
  });

  it('el vídeo de plaza ya no está en la sección de taller', () => {
    expect(VIDEOS_TALLER.some((v) => v.src.includes('plaza-fondo'))).toBe(false);
  });
});

describe('referencias de medios en todo el código', () => {
  it('ninguna ruta /assets/... citada en src/ o index.html falta en public/', async () => {
    const { execFileSync } = await import('node:child_process');
    const salida = execFileSync(process.execPath, ['scripts/check-asset-refs.mjs'], { encoding: 'utf8' });
    expect(salida).not.toMatch(/FALTA/);
    expect(salida).toMatch(/todas existen/);
  });
});

describe('despliegue', () => {
  it('el decodificador Draco está en public/ y en el build', () => {
    for (const f of ['draco/draco_decoder.wasm', 'draco/draco_wasm_wrapper.js']) {
      expect(existsSync(path.join(ROOT, 'public', f)), f).toBe(true);
    }
    if (existsSync(path.join(ROOT, 'dist'))) {
      expect(existsSync(path.join(ROOT, 'dist', 'draco', 'draco_decoder.wasm'))).toBe(true);
    }
  });
});

describe('kit incluido', () => {
  it('lista al menos 5 elementos con texto', () => {
    expect(KIT_INCLUIDO.length).toBeGreaterThanOrEqual(5);
    for (const item of KIT_INCLUIDO) expect(item.trim().length).toBeGreaterThan(3);
  });
});
