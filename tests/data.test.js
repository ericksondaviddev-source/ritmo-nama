import { describe, expect, it } from 'vitest';
import { contact, contactHref, contactLabel } from '../src/data/config.js';
import { DRUMS } from '../src/data/drums.js';
import { PATTERNS } from '../src/data/patterns.js';

const DRUM_IDS = ['prima', 'cruzao', 'pujao', 'paila', 'maracas', 'cuatro'];

describe('config de contacto', () => {
  it('con channel null no produce enlaces rotos', () => {
    expect(contact.channel).toBe(null);
    expect(contactHref('hero')).toBe(null);
    expect(contactLabel()).toBe('Próximamente');
  });

  it('con whatsapp arma wa.me con el mensaje de la sección', () => {
    const original = { ...contact, messages: { ...contact.messages } };
    Object.assign(contact, {
      channel: 'whatsapp',
      number: '584121234567',
      messages: { hero: 'Hola, quiero info', catalog: 'Catálogo', midipad: 'Estudio' }
    });

    expect(contactHref('hero')).toBe('https://wa.me/584121234567?text=Hola%2C%20quiero%20info');
    expect(contactHref('catalogo')).toBe('https://wa.me/584121234567?text=');
    expect(contactLabel()).toBe('Pedir por WhatsApp');

    Object.assign(contact, original);
  });

  it('con telegram arma t.me (admite @usuario)', () => {
    const original = { ...contact, messages: { ...contact.messages } };
    Object.assign(contact, { channel: 'telegram', number: '@ritmonama', messages: { hero: 'Hola' } });

    expect(contactHref('hero')).toBe('https://t.me/ritmonama?text=Hola');
    expect(contactLabel()).toBe('Escribir por Telegram');

    Object.assign(contact, original);
  });
});

describe('drums', () => {
  it('define los 6 instrumentos con campos requeridos', () => {
    expect(DRUMS.map((d) => d.id)).toEqual(DRUM_IDS);
    for (const drum of DRUMS) {
      expect(drum.name).toBeTruthy();
      expect(drum.role).toBeTruthy();
      expect(drum.color).toMatch(/^#/);
      expect(typeof drum.optional).toBe('boolean');
    }
  });
});

describe('patterns', () => {
  it('son 4 patrones con ids únicos', () => {
    expect(PATTERNS).toHaveLength(4);
    expect(new Set(PATTERNS.map((p) => p.id)).size).toBe(4);
  });

  it('cada patrón tiene 12 pasos por instrumento y acentos booleanos', () => {
    for (const pattern of PATTERNS) {
      expect(pattern.bpm).toBeGreaterThanOrEqual(80);
      expect(pattern.bpm).toBeLessThanOrEqual(180);
      for (const id of DRUM_IDS) {
        expect(pattern.steps[id]).toHaveLength(12);
        expect(pattern.accents[id]).toHaveLength(12);
        expect(pattern.steps[id].every((s) => typeof s === 'boolean')).toBe(true);
        expect(pattern.accents[id].every((s) => typeof s === 'boolean')).toBe(true);
      }
      expect(pattern.description).toBeTruthy();
    }
  });

  it('un acento solo existe donde hay golpe', () => {
    for (const pattern of PATTERNS) {
      for (const id of DRUM_IDS) {
        pattern.accents[id].forEach((accent, i) => {
          if (accent) expect(pattern.steps[id][i]).toBe(true);
        });
      }
    }
  });
});
