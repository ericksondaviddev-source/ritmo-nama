import { KIT_INCLUIDO } from '../data/catalog.js';
import { contact, contactHref, whatsappLink } from '../data/config.js';
import { contactCtaMarkup, wireContactCta } from './contact-cta.js';

function socialLinks() {
  const links = [];
  if (contact.instagram) {
    links.push(
      `<a href="https://instagram.com/${contact.instagram}" target="_blank" rel="noopener,noreferrer" class="rounded-full border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-200 transition-colors hover:border-amber-500/60 hover:text-amber-300">📷 Instagram</a>`
    );
  }
  if (contact.tiktok) {
    links.push(
      `<a href="https://tiktok.com/@${contact.tiktok}" target="_blank" rel="noopener,noreferrer" class="rounded-full border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-200 transition-colors hover:border-amber-500/60 hover:text-amber-300">🎵 TikTok</a>`
    );
  }
  return links.join('');
}

export function mountContact(root) {
  if (!root) return null;

  root.className = 'py-20';
  root.innerHTML = `
    <div class="mx-auto max-w-4xl px-4">
      <div class="rounded-3xl glass p-8 text-center sm:p-12">
        <span class="text-xs font-bold uppercase tracking-widest text-amber-500">Contacto</span>
        <h2 id="contact-title" class="mt-2 text-3xl font-extrabold tracking-tight text-zinc-50 sm:text-4xl">
          ¿Listo para <span class="text-amber-400">tu tambor</span>?
        </h2>
        <p class="mx-auto mt-3 max-w-xl text-zinc-400">
          Cada tambor Cuero Na'má sale del taller a mano: doble parche impermeable, baqueta profesional,
          forro de obsequio, garantía de 6 meses y acceso al minicurso y a MidiPad Pro.
        </p>

        <div class="mt-6 flex flex-wrap justify-center gap-2">
          ${KIT_INCLUIDO.map(
            (item) => `
            <span class="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">${item}</span>`
          ).join('')}
        </div>

        <div class="mt-8 flex flex-col items-center gap-3">
          <a
            href="${contactHref('contact') ?? '#'}"
            ${contactHref('contact') ? 'target="_blank" rel="noopener,noreferrer"' : ''}
            data-contact-big
            class="flex w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-emerald-900/30 transition-all hover:bg-emerald-500"
          >
            <span aria-hidden="true">💬</span> Escríbenos por WhatsApp
          </a>
          <div class="flex gap-2">${socialLinks()}</div>
        </div>
      </div>
    </div>`;

  // Sin canal configurado: el CTA grande queda como "próximamente" (sin enlaces rotos)
  if (!whatsappLink('x')) {
    const big = root.querySelector('[data-contact-big]');
    if (big) {
      big.removeAttribute('href');
      big.setAttribute('aria-disabled', 'true');
      big.classList.add('cursor-not-allowed', 'opacity-60');
      big.title = 'Canal de contacto por configurar';
      big.innerHTML = '<span aria-hidden="true">💬</span> <span>Próximamente</span>';
    }
  }

  wireContactCta(root, 'contact');
  return null;
}
