export const contact = {
  channel: 'whatsapp', // 'whatsapp' | 'telegram' | null
  number: '584241875518', // ej. '584121234567'
  instagram: 'ritmo.nama.oficial', // ej. 'ritmonama' (sin @)
  tiktok: 'ritmo.nama.oficial', // ej. 'ritmonama' (sin @)
  messages: {
    hero: '¡Hola! Vengo del sitio Ritmo Na’má y me interesa un tambor Cuero Na’má.',
    catalog: '¡Hola! Me interesa este tambor del catálogo Cuero Na’má:',
    midipad: '¡Hola! Estuve probando el MidiPad de Ritmo Na’má y quiero mi tambor.',
    contact: '¡Hola! Quiero información para pedir mi tambor Cuero Na’má.'
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
  sitio: 'https://ritmonama.vercel.app',
  email: '',
  telefono: '',
  direccion: {
    localidad: 'La Guaira',
    provincia: 'La Guaira',
    pais: 'VE'
  },
  /** Canal de YouTube: se rellena con la URL real. */
  youtube: {
    canal: 'https://www.youtube.com/@Ritmonamá',
    handle: '@Ritmonamá',
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
