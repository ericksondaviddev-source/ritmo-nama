import { contactHref, contactLabel } from '../data/config.js';

// Markup del CTA diferido. Con channel null queda como <button aria-disabled>
// (enfocable por teclado, sin enlaces rotos — spec §9).
export function contactCtaMarkup(section, className = '') {
  const label = contactLabel();
  return `
    <button
      type="button"
      data-contact-cta="${section}"
      class="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-500 sm:px-5 ${className}"
    >
      <span aria-hidden="true">💬</span>
      <span data-contact-label>${label}</span>
    </button>`;
}

export function wireContactCta(root, section) {
  const cta = root.querySelector(`[data-contact-cta="${section}"]`);
  if (!cta) return null;
  const labelEl = cta.querySelector('[data-contact-label]');
  if (labelEl) labelEl.textContent = contactLabel();
  const href = contactHref(section);
  if (href) {
    cta.addEventListener('click', () => {
      window.open(href, '_blank', 'noopener,noreferrer');
    });
  } else {
    cta.setAttribute('aria-disabled', 'true');
    cta.classList.add('cursor-not-allowed', 'opacity-60');
    cta.title = 'Canal de contacto por configurar';
  }
  return cta;
}
