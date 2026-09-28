export const contact = {
  channel: null, // 'whatsapp' | 'telegram' | null
  number: null, // ej. '584121234567'
  instagram: null, // ej. 'ritmonama' (sin @)
  tiktok: null, // ej. 'ritmonama' (sin @)
  messages: {
    hero: '',
    catalog: '',
    midipad: '',
    contact: ''
  }
};

export function contactHref(section = 'hero') {
  const message = contact.messages[section] ?? '';
  if (contact.channel === 'whatsapp' && contact.number) {
    return `https://wa.me/${contact.number}?text=${encodeURIComponent(message)}`;
  }
  if (contact.channel === 'telegram' && contact.number) {
    const target = contact.number.startsWith('@') ? contact.number.slice(1) : contact.number;
    return `https://t.me/${target}?text=${encodeURIComponent(message)}`;
  }
  return null;
}

export function contactLabel() {
  if (contact.channel === 'whatsapp') return 'Pedir por WhatsApp';
  if (contact.channel === 'telegram') return 'Escribir por Telegram';
  return 'Próximamente';
}

// Enlace de WhatsApp con mensaje arbitrario (personalización por catálogo)
export function whatsappLink(message) {
  if (contact.channel === 'whatsapp' && contact.number) {
    return `https://wa.me/${contact.number}?text=${encodeURIComponent(message)}`;
  }
  return null;
}
