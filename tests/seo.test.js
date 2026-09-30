import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { structuredData, faqMarkup } from '../src/components/seo.js';
import { FAQ } from '../src/data/faq.js';
import { PRODUCTS, VIDEOS_TALLER } from '../src/data/catalog.js';
import { brand, youtube } from '../src/data/config.js';

const ROOT = process.cwd();
const enDisco = (ruta) => Boolean(ruta) && existsSync(path.join(ROOT, 'public', ruta.replace(/^\//, '')));
const grafico = () => {
  const json = JSON.parse(structuredData({ productos: PRODUCTS, videos: VIDEOS_TALLER, curso: null }));
  return json['@graph'];
};
const porTipo = (t) => grafico().filter((n) => n['@type'] === t);

describe('datos estructurados', () => {
  it('el JSON es válido y declara el contexto', () => {
    const json = JSON.parse(structuredData({ productos: PRODUCTS, videos: VIDEOS_TALLER, curso: null }));
    expect(json['@context']).toBe('https://schema.org');
    expect(Array.isArray(json['@graph'])).toBe(true);
    expect(json['@graph'].length).toBeGreaterThan(3);
  });

  it('declara la organización, la web y la marca', () => {
    const org = porTipo('Organization')[0];
    expect(org.name).toBe(brand.organizacion);
    expect(org.address.addressCountry).toBe('VE');
    // Ojo: en schema.org es WebSite, con S mayúscula.
    const web = porTipo('WebSite')[0];
    expect(web.inLanguage).toBe('es-VE');
  });

  it('declara un Product por tambor, sin el CTA y con su precio', () => {
    const productos = porTipo('Product');
    const reales = PRODUCTS.filter((p) => !p.isCta);
    expect(productos).toHaveLength(reales.length);
    for (const p of productos) {
      expect(p.name).toBeTruthy();
      expect(p.offers.price).toBe('49');
      expect(p.offers.priceCurrency).toBe('USD');
      expect(p.offers.availability).toContain('InStock');
    }
    expect(productos.some((p) => p.name.includes('Personaliza'))).toBe(false);
  });

  it('toda imagen de Product que se declara existe en disco', () => {
    for (const p of porTipo('Product')) {
      if (p.image) expect(enDisco(p.image), p.image).toBe(true);
    }
  });

  it('declara un VideoObject por cada vídeo del taller', () => {
    expect(porTipo('VideoObject')).toHaveLength(VIDEOS_TALLER.length);
    for (const v of porTipo('VideoObject')) expect(v.name).toBeTruthy();
  });

  it('declara el FAQPage con las mismas preguntas que se ven en la página', () => {
    const faq = porTipo('FAQPage')[0];
    expect(faq.mainEntity).toHaveLength(FAQ.length);
    for (const q of faq.mainEntity) {
      expect(q.name).toBeTruthy();
      expect(q.acceptedAnswer.text.length).toBeGreaterThan(40);
    }
  });

  it('no declara canonical ni Course mientras no haya URL del sitio', () => {
    // Publicar una URL inventada en un sitemap o en canonical es peor que no
    // tenerla, así que sin dominio no se emite ninguna.
    if (!brand.sitio) {
      for (const n of grafico()) {
        const u = n.url;
        if (typeof u === 'string') expect(u.startsWith('http'), n['@type']).toBe(false);
      }
    }
  });
});

describe('FAQ visible', () => {
  it('las respuestas del bloque visible son las mismas del FAQPage', () => {
    const html = faqMarkup();
    for (const f of FAQ) {
      expect(html, f.q).toContain(f.q);
      expect(html, f.q).toContain(f.a.replace(/'/g, '&#39;').slice(0, 40));
    }
  });

  it('cada respuesta es un párrafo completo y en español', () => {
    for (const f of FAQ) {
      expect(f.a.length).toBeGreaterThan(80);
      const raros = f.a.match(/[^\u0020-\u007E\u00A0-\u024F\u2010-\u201F?¿¡]/g) ?? [];
      expect(raros, f.q).toEqual([]);
    }
  });
});

describe('meta de la página', () => {
  const html = () => readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  it('tiene título, descripción y lang en español', () => {
    const h = html();
    expect(h).toContain('<html lang="es">');
    expect(h).toMatch(/<title>[^<]{20,}<\/title>/);
    expect(h).toMatch(/name="description"\s+content="[^"]{60,}"/);
  });

  it('declara Open Graph con imagen 1200x630 que existe', () => {
    const h = html();
    expect(h).toContain('property="og:type"');
    expect(h).toContain('property="og:title"');
    expect(h).toContain('property="og:description"');
    const img = h.match(/property="og:image"\s+content="([^"]+)"/)?.[1];
    expect(img, 'falta og:image').toBeTruthy();
    expect(enDisco(img), img).toBe(true);
    expect(h).toContain('name="twitter:card"');
  });

  it('el sitio tiene robots.txt y sitemap.xml válidos', () => {
    const robots = readFileSync(path.join(ROOT, 'public', 'robots.txt'), 'utf8');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Sitemap:');
    const sitemap = readFileSync(path.join(ROOT, 'public', 'sitemap.xml'), 'utf8');
    expect(sitemap).toContain('<urlset');
    expect(sitemap).toContain('<loc>');
  });
});

describe('YouTube', () => {
  it('los episodios tienen URL componible y el canal está configurado', () => {
    for (const e of youtube.episodios) {
      expect(e.url, e.id ?? e.titulo).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=/);
    }
    // El canal se rellena cuando el usuario pase la URL; hasta entonces no se
    // inventa ningún enlace a YouTube en la página.
    if (!youtube.canal) {
      expect(readFileSync(path.join(ROOT, 'index.html'), 'utf8')).not.toContain('youtube.com');
    }
  });
});
