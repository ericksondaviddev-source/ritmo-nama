import { contactHref, contactLabel } from '../data/config.js';

export function mountHeader(root) {
  if (!root) return null;

  root.className = 'sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md';
  root.innerHTML = `
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-20">
      <a href="#hero" class="flex items-center gap-2">
        <span class="text-xl font-black tracking-tight text-amber-500 sm:text-2xl">Ritmo Na'má</span>
        <span class="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">por Cuero Na'má</span>
      </a>
      <button
        type="button"
        data-contact-cta
        class="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-500 sm:px-5"
      >
        <span aria-hidden="true">💬</span>
        <span data-contact-label>${contactLabel()}</span>
      </button>
    </div>`;

  const cta = root.querySelector('[data-contact-cta]');
  const href = contactHref('hero');

  if (href) {
    cta.addEventListener('click', () => {
      window.open(href, '_blank', 'noopener,noreferrer');
    });
  } else {
    // aria-disabled en vez de disabled: mantiene el CTA en el orden de Tab (foco visible)
    cta.setAttribute('aria-disabled', 'true');
    cta.classList.add('cursor-not-allowed', 'opacity-60');
    cta.title = 'Canal de contacto por configurar';
  }

  return cta;
}
