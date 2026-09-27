import { FINISHES, FINISH_ZONES, KIT_INCLUIDO, PRODUCTS } from '../data/catalog.js';
import { canExport360, createConfigurator } from '../core/three/configurator.js';
import { contactCtaMarkup, wireContactCta } from './contact-cta.js';

function cardMarkup(product) {
  if (product.isCta) {
    const target = PRODUCTS.find((p) => p.id === product.customizes);
    return `
      <article class="flex flex-col justify-between rounded-3xl border border-dashed border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-zinc-900 p-6">
        <div>
          <span class="text-xs font-bold uppercase tracking-wide text-amber-400">A medida</span>
          <h3 class="mt-2 text-xl font-extrabold text-zinc-100">${product.name}</h3>
          <p class="mt-2 text-sm leading-relaxed text-zinc-400">${product.tagline}. Elige colores y acabados en el configurador y pídelo por el canal de contacto.</p>
        </div>
        <button
          type="button"
          data-product-id="${target.id}"
          data-scroll="true"
          class="mt-4 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-zinc-950 transition-all hover:bg-amber-400"
        >
          Personaliza el tuyo →
        </button>
      </article>`;
  }
  return `
    <article data-card="${product.id}" class="group overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
      <div class="relative aspect-[4/3] overflow-hidden bg-zinc-950">
        <img
          src="${product.poster}"
          alt=""
          loading="lazy"
          decoding="async"
          onerror="this.remove()"
          class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <video
          data-reel
          src="${product.video}"
          muted
          loop
          playsinline
          preload="none"
          aria-hidden="true"
          class="absolute inset-0 hidden h-full w-full object-cover"
        ></video>
        <span class="absolute left-3 top-3 rounded-full bg-zinc-950/85 px-2.5 py-1 text-xs font-black text-amber-400">${product.price}</span>
      </div>
      <div class="p-4">
        <h3 class="font-bold text-zinc-100">${product.name}</h3>
        <p class="mt-1 text-sm text-zinc-500">${product.tagline}</p>
        <button
          type="button"
          data-product-id="${product.id}"
          aria-pressed="false"
          class="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-amber-500/60 hover:text-amber-300"
        >
          Ver en el configurador
        </button>
      </div>
    </article>`;
}

function finishControlsMarkup() {
  return FINISH_ZONES.map(
    (zone) => `
    <div data-finish-zone="${zone.id}" class="flex items-center justify-between gap-3">
      <span class="text-sm font-medium text-zinc-300">${zone.label}</span>
      <div class="flex gap-2">
        ${FINISHES[zone.id]
          .map(
            (opt, i) => `
          <label class="cursor-pointer">
            <input
              type="radio"
              name="finish-${zone.id}"
              value="${opt.hex}"
              data-finish-input="${zone.id}"
              class="peer sr-only"
              ${i === 0 ? 'checked' : ''}
            />
            <span
              class="block h-8 w-8 rounded-full border-2 border-zinc-700 transition-all peer-checked:border-amber-400 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400"
              style="background:${opt.hex}"
              title="${opt.label}"
            ></span>
            <span class="sr-only">${zone.label}: ${opt.label}</span>
          </label>`
          )
          .join('')}
      </div>
    </div>`
  ).join('');
}

export function mountCatalog(root) {
  if (!root) return null;

  root.className = 'border-b border-zinc-900 py-16';
  root.innerHTML = `
    <div class="mx-auto max-w-6xl px-4">
      <div class="max-w-2xl">
        <span class="text-xs font-bold uppercase tracking-widest text-amber-500">Catálogo</span>
        <h2 id="catalog-title" class="mt-2 text-3xl font-extrabold tracking-tight text-zinc-50 sm:text-4xl">
          Elige tu tambor <span class="text-amber-400">y hazlo tuyo</span>
        </h2>
        <p class="mt-3 text-zinc-400">Mira cada modelo en video, gíralo en 3D y prueba acabados en tiempo real.</p>
      </div>

      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        ${PRODUCTS.map(cardMarkup).join('')}
      </div>

      <div class="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div data-configurator class="h-[340px] w-full overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-amber-600/10 sm:h-[460px]"></div>

          <div class="mt-4 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-sm font-black uppercase tracking-wide text-zinc-300">Acabados en vivo</h3>
              <div class="flex items-center gap-2">
                <span data-export-status role="status" aria-live="polite" class="text-xs text-zinc-500"></span>
                <button
                  type="button"
                  data-export-360
                  class="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold text-amber-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ⭳ Exportar clip 360°
                </button>
              </div>
            </div>
            <p data-export-aviso class="mt-2 hidden text-xs text-amber-500/90"></p>
            <fieldset data-finish-controls class="mt-4 space-y-3">
              <legend class="sr-only">Acabados del tambor</legend>
              ${finishControlsMarkup()}
            </fieldset>
            <p data-regions-hint class="mt-3 hidden text-xs text-zinc-500">
              El Set Na'má es el exhibidor de diseños: para personalizar, elige un Drumkid.
            </p>
          </div>
        </div>

        <aside class="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h3 class="text-lg font-extrabold text-zinc-100">Kit incluido <span class="text-amber-400">· 49 $</span></h3>
          <ul class="mt-4 space-y-3 text-sm text-zinc-300">
            ${KIT_INCLUIDO.map(
              (item) => `
              <li class="flex items-start gap-2">
                <span aria-hidden="true" class="mt-0.5 text-amber-400">✓</span>
                <span>${item}</span>
              </li>`
            ).join('')}
          </ul>
          <div class="mt-6">${contactCtaMarkup('catalog')}</div>
        </aside>
      </div>
    </div>`;

  wireContactCta(root, 'catalog');

  const host = root.querySelector('[data-configurator]');
  const finishFieldset = root.querySelector('[data-finish-controls]');
  const regionsHint = root.querySelector('[data-regions-hint]');
  const exportBtn = root.querySelector('[data-export-360]');
  const exportAviso = root.querySelector('[data-export-aviso]');
  const exportStatus = root.querySelector('[data-export-status]');
  const selectButtons = [...root.querySelectorAll('[data-product-id]')];

  let handle = null;
  let initPromise = null;
  let activeId = null;
  let pendingId = null;

  const productById = (id) => PRODUCTS.find((p) => p.id === id);

  function applyProductUI(id) {
    activeId = id;
    host.dataset.activeProduct = id;
    for (const btn of selectButtons) btn.setAttribute('aria-pressed', String(btn.dataset.productId === id));
    const product = productById(id);
    finishFieldset.disabled = !product?.customizable;
    regionsHint.classList.toggle('hidden', Boolean(product?.customizable));
  }

  function syncDataset() {
    if (!handle) return;
    host.dataset.tints = JSON.stringify(handle.getTints());
    host.dataset.hasRegions = String(handle.hasRegions());
    finishFieldset.disabled = !handle.hasRegions();
    regionsHint.classList.toggle('hidden', handle.hasRegions());
  }

  function ensureConfigurator() {
    if (initPromise) return initPromise;
    const first = productById(activeId ?? 'drumkid-multicolor');
    initPromise = createConfigurator({
      container: host,
      modelUrl: first.model,
      fallbackVideoUrl: first.video,
      regions: first.customizable ? first.regions : null
    }).then((h) => {
      handle = h;
      syncDataset();
      if (pendingId && pendingId !== activeId) {
        const id = pendingId;
        pendingId = null;
        return selectProduct(id, { scroll: false });
      }
      return h;
    });
    return initPromise;
  }

  async function selectProduct(id, { scroll = false } = {}) {
    const product = productById(id);
    if (!product || product.isCta) return;
    applyProductUI(id);
    if (scroll) host.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!handle) {
      pendingId = id;
      await ensureConfigurator();
      return;
    }
    await handle.setModel(product.model, product.customizable ? product.regions : null);
    syncDataset();
  }

  // Selección desde tarjetas (incluida la CTA "Personaliza", cuyo data-product-id apunta al blanco)
  for (const btn of selectButtons) {
    btn.addEventListener('click', () => selectProduct(btn.dataset.productId, { scroll: btn.dataset.scroll === 'true' }));
  }

  // Acabados
  finishFieldset.addEventListener('change', (e) => {
    const input = e.target.closest('[data-finish-input]');
    if (!input || !handle) return;
    handle.setTint(input.dataset.finishInput, input.value);
    host.dataset.tints = JSON.stringify(handle.getTints());
  });

  // Reels: hover (ratón) / tap (táctil)
  for (const card of root.querySelectorAll('[data-card]')) {
    const video = card.querySelector('[data-reel]');
    if (!video) continue;
    const show = () => {
      video.classList.remove('hidden');
      video.play().catch(() => {});
    };
    const hide = () => {
      video.pause();
      video.currentTime = 0;
      video.classList.add('hidden');
    };
    card.addEventListener('mouseenter', show);
    card.addEventListener('mouseleave', hide);
    card.addEventListener(
      'touchstart',
      () => {
        if (video.classList.contains('hidden')) show();
        else hide();
      },
      { passive: true }
    );
  }

  // Export 360°
  if (!canExport360()) {
    exportBtn.disabled = true;
    exportAviso.textContent = 'Tu navegador no permite exportar el clip. Prueba en Chrome o Edge.';
    exportAviso.classList.remove('hidden');
  } else {
    exportBtn.addEventListener('click', async () => {
      if (!handle || handle.isRecording()) return;
      exportBtn.disabled = true;
      exportStatus.textContent = 'Grabando clip 360°… (4 s)';
      const blob = await handle.start360();
      exportStatus.textContent = '';
      exportBtn.disabled = false;
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ritmo-nama-${activeId}-360.webm`;
        a.click();
        URL.revokeObjectURL(url);
        exportStatus.textContent = 'Clip descargado ✓';
      } else {
        exportStatus.textContent = 'No se pudo grabar';
      }
    });
  }

  // Inicialización perezosa: solo cuando la sección se acerca al viewport
  applyProductUI('drumkid-multicolor');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          io.disconnect();
          ensureConfigurator();
        }
      },
      { rootMargin: '200px' }
    );
    io.observe(host);
  } else {
    ensureConfigurator();
  }

  return {
    destroy() {
      handle?.destroy();
    }
  };
}
