import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mountMidipad } from '../src/components/midipad.js';

const src = readFileSync(new URL('../src/components/midipad.js', import.meta.url), 'utf8');

describe('componente midipad', () => {
  it('el módulo importa completo (si truena, la página queda en blanco)', () => {
    expect(typeof mountMidipad).toBe('function');
  });

  it('mountMidipad devuelve el visualizador y un destroy con limpieza total', () => {
    expect(src).toMatch(/return \{\s*visualizador,\s*destroy\(\) \{/);
    expect(src).toContain('exportModal?.cerrar()');
    expect(src).toContain('unsubscribeProgreso?.()');
    expect(src).toContain('unsubscribe?.()');
  });

  it('el modal devuelve abrir/cerrar, un solo listener de Escape y sin alert()', () => {
    expect(src).toContain('return { abrir, cerrar };');
    expect(src.match(/document\.addEventListener\('keydown', onEscape\)/g)).toHaveLength(1);
    expect(src).not.toContain('alert(');
    expect(src).not.toContain('previewVideo');
    // Regresión: usaba una variable inexistente y reventaba al generar el MP4.
    expect(src).not.toContain('eleccion.ext');
  });

  it('la exportación usa las APIs reales de grabador y video-export', () => {
    expect(src).toContain('createGrabador(');
    expect(src).toContain('MAX_SIN_LIMITE');
    expect(src).toContain('exportarClip(');
    expect(src).toContain('descargar(out.blob, out.nombre)');
    expect(src).toContain('exportarMp3(audio, {');
    expect(src).toContain('voz: voiceBuffer');
  });
});
