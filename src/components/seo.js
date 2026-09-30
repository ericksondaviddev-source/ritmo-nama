import { FAQ } from '../data/faq.js';
import { PRODUCTS, VIDEOS_TALLER } from '../data/catalog.js';
import { brand, youtube } from '../data/config.js';
import { wireContactCta } from './contact-cta.js';

/**
 * Datos estructurados (AEO).
 *
 * Se emiten a mano en el `index.html` porque un buscador los lee al rastrear y
 * no después de que JavaScript arranque. Lo que sí es dinámico (los productos
 * salen de `catalog.js`) se inyecta como JSON-LD desde este módulo al montar,
 * para que no haya que mantener la lista por duplicado.
 */
const org = {
  '@type': 'Organization',
  '@id': '#organizacion',
  name: brand.organizacion,
  alternateName: brand.nombre,
  ...(brand.sitio ? { url: brand.sitio } : {}),
  ...(brand.email ? { email: brand.email } : {}),
  ...(brand.telefono ? { telephone: brand.telefono } : {}),
  ...(youtube.canal ? { sameAs: [youtube.canal].filter(Boolean) } : {}),
  address: {
    '@type': 'PostalAddress',
    addressLocality: brand.direccion.localidad,
    addressRegion: brand.direccion.provincia,
    addressCountry: brand.direccion.pais
  }
};

const producto = (p) => ({
  '@type': 'Product',
  name: p.name,
  description: p.tagline,
  brand: { '@type': 'Brand', name: brand.organizacion },
  ...(brand.sitio ? { url: `${brand.sitio}#catalogo` } : {}),
  image: p.foto ?? undefined,
  offers: {
    '@type': 'Offer',
    price: '49',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock'
  }
});

const video = (v) => ({
  '@type': 'VideoObject',
  name: v.titulo,
  description: v.texto,
  contentUrl: v.src,
  thumbnailUrl: brand.sitio ? `${brand.sitio}${v.poster ?? v.foto ?? ''}` : undefined,
  uploadDate: '2026-09-01'
});

export function structuredData(datos = {}) {
  const grafico = [];

  grafico.push(org);

  grafico.push({
    '@type': 'WebSite',
    name: brand.nombre,
    inLanguage: 'es-VE',
    publisher: { '@id': '#organizacion' },
    ...(brand.sitio ? { url: brand.sitio } : {})
  });

  for (const p of (datos.productos ?? []).filter((x) => !x.isCta)) grafico.push(producto(p));

  for (const v of datos.videos ?? []) grafico.push(video(v));

  // Sólo se declara el curso si de verdad hay una página de destino; sin ella
  // sería una entrada que no lleva a ninguna parte.
  if (datos.curso?.url) {
    grafico.push({
      '@type': 'Course',
      name: datos.curso.nombre,
      description: datos.curso.descripcion,
      inLanguage: 'es-VE',
      provider: { '@id': '#organizacion' },
      url: datos.curso.url,
      isAccessibleForFree: true
    });
  }

  if (FAQ.length) {
    grafico.push({
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    });
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': grafico });
}

/** Bloque de preguntas visibles: el mismo texto que consume el FAQPage. */
export function faqMarkup() {
  return `
    <section aria-labelledby="faq-title" class="border-b border-zinc-900 py-16">
      <div class="mx-auto max-w-3xl px-4">
        <span class="text-xs font-bold uppercase tracking-widest text-amber-500">Preguntas</span>
        <h2 id="faq-title" class="mt-2 text-3xl font-extrabold tracking-tight text-zinc-50">
          Lo que más nos preguntan
        </h2>
        <div class="mt-8 divide-y divide-zinc-800">
          ${FAQ.map(
            (f) => `
            <details class="group py-4">
              <summary class="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-bold text-zinc-100">
                <span>${f.q}</span>
                <span aria-hidden="true" class="shrink-0 text-amber-500 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p class="mt-3 text-sm leading-relaxed text-zinc-400">${f.a}</p>
            </details>`
          ).join('')}
        </div>
      </div>
    </section>`;
}

export function mountFaq(root) {
  if (!root) return null;
  root.innerHTML = faqMarkup();
  wireContactCta(root, 'contact');

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = structuredData({
    productos: PRODUCTS,
    videos: VIDEOS_TALLER,
    curso: { nombre: 'Minicurso de fulia', descripcion: 'Las cuatro lecciones de la fulia del velorio de Cruz de Mayo.', url: null }
  });
  document.head.appendChild(script);
  return { destroy() { script.remove(); } };
}
