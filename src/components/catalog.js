import {
  ACABADOS,
  KIT_INCLUIDO,
  MODELOS_3D,
  PRODUCTO_POR_DEFECTO,
  PRODUCTS,
  VIDEOS_TALLER
} from '../data/catalog.js';
import { canExport360, createConfigurator } from '../core/three/configurator.js';
import { contactCtaMarkup, wireContactCta } from './contact-cta.js';
import { whatsappLink } from '../data/config.js';

function cardMarkup(product) {
  if (product.isCta) {
    const target = PRODUCTS.find((p) => p.id === product.customizes);
    return `
      <article class="flex flex-col justify-between rounded-3xl border border-dashed border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-zinc-900 p-6">
        <div>
          <span class="text-xs font-bold uppercase tracking-wide text-amber-400">A medida</span>
          <h3 class="mt-2 text-xl font-extrabold text-zinc-100">${product.name}</h3>
          <p class="mt-2 text-sm leading-relaxed text-zinc-400">${product.tagline}. El acabado exacto lo hacemos a mano en el taller.</p>
        </div>
        <button
          type="button"
          data-scroll-finish
          class="mt-4 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-zinc-950 transition-all hover:bg-amber-400"
        >
          Ver acabados →
        </button>
      </article>`;
  }

  const tiene3d = Boolean(product.model);
  const sinVideo = !product.video;
  return `
    <article data-card="${product.id}" class="group overflow-hidden rounded-3xl glass">
      <div class="relative aspect-[4/3] overflow-hidden bg-zinc-950">
        <img
          src="${product.poster}"
          alt="${product.name}"
          loading="lazy"
          decoding="async"
          onerror="this.remove()"
          class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        ${
          sinVideo
            ? ''
            : `<video
          data-reel
          src="${product.video}"
          muted
          loop
          playsinline
          preload="none"
          aria-hidden="true"
          class="absolute inset-0 hidden h-full w-full object-cover"
        ></video>`
        }
        <span class="absolute left-3 top-3 rounded-full bg-zinc-950/85 px-2.5 py-1 text-xs font-black text-amber-400">${product.price}</span>
        ${
          tiene3d
            ? ''
            : '<span class="absolute right-3 top-3 rounded-full bg-zinc-950/85 px-2.5 py-1 text-[11px] font-bold text-zinc-300">Sin 3D</span>'
        }
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
          ${tiene3d ? 'Girar en 3D' : 'Ver foto'}
        </button>
      </div>
    </article>`;
}

function acabadoMarkup(primeroId) {
  return ACABADOS.map(
    (a) => `
    <label class="cursor-pointer" data-acabado-label="${a.id}">
      <input
        type="radio"
        name="acabado"
        value="${a.id}"
        data-acabado-input
        class="peer sr-only"
        ${a.id === primeroId ? 'checked' : ''}
      />
      <span
        class="flex w-[92px] flex-col items-center gap-1.5 rounded-2xl border-2 border-zinc-800 p-1.5 transition-all hover:border-zinc-600 peer-checked:border-amber-400 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400"
      >
        <img
          src="${a.image}"
          alt=""
          loading="lazy"
          decoding="async"
          class="aspect-square w-full rounded-xl object-cover"
        />
        <span class="px-1 pb-0.5 text-center text-[11px] font-bold leading-tight text-zinc-300">${a.label}</span>
      </span>
      <span class="sr-only">Acabado ${a.label}</span>
    </label>`
  ).join('');
}

function tallerMarkup() {
  return VIDEOS_TALLER.map(
    (v) => `
    <figure class="overflow-hidden rounded-3xl glass">
      <video
        src="${v.src}"
        ${v.poster ? `poster="${v.poster}"` : ''}
        muted
        loop
        playsinline
        preload="none"
        controls
        aria-label="${v.titulo}"
        class="aspect-[9/16] w-full bg-zinc-950 object-cover"
      ></video>
      <figcaption class="p-4">
        <h3 class="text-sm font-extrabold text-zinc-100">${v.titulo}</h3>
        <p class="mt-1 text-xs text-zinc-500">${v.texto}</p>
      </figcaption>
    </figure>`
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
        <p class="mt-3 text-zinc-400">Mira cada modelo en video, gíralo en 3D y elige el acabado que quieres para tu pedido.</p>
      </div>

      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        ${PRODUCTS.map(cardMarkup).join('')}
      </div>

      <div class="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div data-configurator class="h-[340px] w-full overflow-hidden rounded-3xl glass shadow-2xl shadow-amber-600/10 sm:h-[460px]"></div>

          <div class="mt-4 rounded-3xl glass p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-sm font-black uppercase tracking-wide text-zinc-300">Elige el acabado</h3>
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
            <p class="mt-1 text-xs text-zinc-500">Cada acabado es un tambor real: así se ven y así se fabricate.</p>
            <div data-acabados class="mt-4 flex flex-wrap gap-2">
              ${acabadoMarkup(PRODUCTO_POR_DEFECTO)}
            </div>
            <button
              type="button"
              data-order
              class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-500"
            >
              <span aria-hidden="true">💬</span> Pedir este tambor por WhatsApp
            </button>
            <p data-export-aviso class="mt-2 hidden text-xs text-amber-500/90"></p>
          </div>
        </div>

        <aside class="rounded-3xl glass p-6">
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

      <div class="mt-10">
        <h3 class="text-sm font-black uppercase tracking-wide text-zinc-400">Del taller</h3>
        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:max-w-xl">
          ${tallerMarkup()}
        </div>
      </div>
    </div>`;

  wireContactCta(root, 'catalog');

  const host = root.querySelector('[data-configurator]');
  const exportBtn = root.querySelector('[data-export-360]');
  const exportAviso = root.querySelector('[data-export-aviso]');
  const exportStatus = root.querySelector('[data-export-status]');
  const orderBtn = root.querySelector('[data-order]');
  const acabadosBox = root.querySelector('[data-acabados]');
  const selectButtons = [...root.querySelectorAll('[data-product-id]')];

  let handle = null;
  let initPromise = null;
  // El 3D siempre muestra un producto con escaneo; el acabado elegido puede
  // ser cualquiera de los reales, así que son dos estados separados.
  let activeModelId = MODELOS_3D[0];
  let selectedFinishId = PRODUCTO_POR_DEFECTO;
  let pendingId = null;

  const productById = (id) => PRODUCTS.find((p) => p.id === id);

  function markButtonState(id) {
    for (const btn of selectButtons) {
      const p = productById(btn.dataset.productId);
      const isModelView = p?.model && p.id === activeModelId;
      btn.setAttribute('aria-pressed', String(Boolean(isModelView)));
    }
  }

  function markFinishState(id) {
    for (const input of acabadosBox.querySelectorAll('[data-acabado-input]')) {
      input.checked = input.value === id;
    }
  }

  function ensureConfigurator() {
    if (initPromise) return initPromise;
    const first = productById(activeModelId);
    initPromise = createConfigurator({
      container: host,
      modelUrl: first.model,
      fallbackVideoUrl: first.video ?? null
    }).then((h) => {
      handle = h;
      if (pendingId && pendingId !== activeModelId) {
        const id = pendingId;
        pendingId = null;
        return loadModel(id).then(() => h);
      }
      return h;
    });
    return initPromise;
  }

  async function loadModel(id) {
    const product = productById(id);
    if (!product?.model) return;
    activeModelId = id;
    host.dataset.activeProduct = id;
    markButtonState(id);
    if (!handle) {
      pendingId = id;
      await ensureConfigurator();
      return;
    }
    await handle.setModel(product.model);
  }

  // Un producto con escaneo gira en 3D; uno sin escaneo sólo se muestra su foto.
  async function selectProduct(id, { scroll = false } = {}) {
    const product = productById(id);
    if (!product || product.isCta) return;
    selectedFinishId = id;
    markFinishState(id);
    if (product.model) {
      if (scroll) host.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await loadModel(id);
      return;
    }
    // Sin 3D: destacamos su tarjeta y llevamos a ella la vista.
    markButtonState(activeModelId);
    root.querySelector(`[data-card="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  for (const btn of selectButtons) {
    btn.addEventListener('click', () => selectProduct(btn.dataset.productId, { scroll: true }));
  }

  for (const input of acabadosBox.querySelectorAll('[data-acabado-input]')) {
    input.addEventListener('change', () => selectProduct(input.value, { scroll: true }));
  }

  root.querySelector('[data-scroll-finish]')?.addEventListener('click', () => {
    acabadosBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  if (whatsappLink('x')) {
    orderBtn.addEventListener('click', () => {
      const product = productById(selectedFinishId) ?? productById(PRODUCTO_POR_DEFECTO);
      const href = whatsappLink(`Hola, quiero un ${product.name}`);
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
    });
  } else {
    orderBtn.disabled = true;
    orderBtn.classList.add('cursor-not-allowed', 'opacity-60');
    orderBtn.title = 'Canal de contacto por configurar';
  }

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
        a.download = `ritmo-nama-${activeModelId}-360.webm`;
        a.click();
        URL.revokeObjectURL(url);
        exportStatus.textContent = 'Clip descargado ✓';
      } else {
        exportStatus.textContent = 'No se pudo grabar';
      }
    });
  }

  // Inicialización perezosa: solo cuando la sección se acerca al viewport
  markButtonState(activeModelId);
  markFinishState(selectedFinishId);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          io.disconnect();
          ensureConfigurator();
        }
      },
      { rootMargin: '0px' }
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
