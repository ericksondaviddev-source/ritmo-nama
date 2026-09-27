import { wireContactCta } from './contact-cta.js';

// Markup estático en index.html (FCP sin esperar JS); este módulo solo hidrata el CTA.
export function mountHeader(root) {
  if (!root) return null;
  return wireContactCta(root, 'hero');
}
