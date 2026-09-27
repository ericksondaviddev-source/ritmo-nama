import { wireContactCta } from './contact-cta.js';
import { wireThemeToggle } from './theme-toggle.js';

// Markup estático en index.html (FCP sin esperar JS); este módulo solo hidrata.
export function mountHeader(root) {
  if (!root) return null;
  wireThemeToggle(root);
  return wireContactCta(root, 'hero');
}
