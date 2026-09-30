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

/**
 * Datos públicos de la marca. Se rellenan con los definitivos; mientras
 * `sitio` esté vacío no se emiten etiquetas de canonical ni de Open Graph con
 * una URL inventada, porque una URL equivocada en un sitemap o en canonical es
 * peor que no tenerla.
 */
export const brand = {
  nombre: "Ritmo Na'má",
  organizacion: 'Cuero Na\'má',
  sitio: '', // p. ej. https://cueronama.com
  email: '',
  telefono: '',
  direccion: {
    localidad: 'La Guaira',
    provincia: 'La Guaira',
    pais: 'VE'
  },
  /** Canal de YouTube: se rellena con la URL real. */
  youtube: {
    canal: '',
    handle: '',
    /** Serie de episodes. El id basta; la URL se compone. */
    episodios: []
  }
};

const sinSitio = !brand.sitio;

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

export const youtube = {
  canal: brand.youtube.canal,
  handle: brand.youtube.handle,
  episodios: brand.youtube.episodios.map((e) => ({
    ...e,
    url: e.id ? `https://www.youtube.com/watch?v=${e.id}` : e.url ?? ''
  }))
};
