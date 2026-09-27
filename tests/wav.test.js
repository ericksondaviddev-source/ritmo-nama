import { describe, expect, it } from 'vitest';
import { encodeWav16 } from '../src/core/audio/wav.js';

function fakeBuffer(data, { channels = 1, sampleRate = 44100 } = {}) {
  return {
    numberOfChannels: channels,
    sampleRate,
    length: channels === 1 ? data.length : data[0].length,
    getChannelData: (c) => (channels === 1 ? data : data[c])
  };
}

function str(view, at, n) {
  let out = '';
  for (let i = 0; i < n; i++) out += String.fromCharCode(view.getUint8(at + i));
  return out;
}

describe('encodeWav16', () => {
  it('escribe cabecera RIFF/WAVE PCM 16-bit con tamaños correctos', () => {
    const wav = encodeWav16(fakeBuffer(new Float32Array([0, 0.5, -0.5, 1])));
    const view = new DataView(wav);
    expect(str(view, 0, 4)).toBe('RIFF');
    expect(str(view, 8, 4)).toBe('WAVE');
    expect(str(view, 12, 4)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // canales
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(34, true)).toBe(16); // bits
    expect(str(view, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(8); // 4 muestras × 2 bytes
    expect(wav.byteLength).toBe(52); // 44 + 8
  });

  it('codifica las muestras como int16 little-endian intercaladas', () => {
    const wav = encodeWav16(
      fakeBuffer([new Float32Array([0, 0.5, -1]), new Float32Array([1, -0.5, 0])], { channels: 2 })
    );
    const view = new DataView(wav);
    expect(view.getUint16(22, true)).toBe(2);
    // L[0]=0, R[0]=32767 (1×0x7fff), L[1]=16383 (0.5), R[1]=-16384 (-0.5×0x8000), L[2]=-32768, R[2]=0
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(16383);
    expect(view.getInt16(50, true)).toBe(-16384);
    expect(view.getInt16(52, true)).toBe(-32768);
    expect(view.getInt16(54, true)).toBe(0);
  });

  it('clampea al rango [-1, 1]', () => {
    const wav = encodeWav16(fakeBuffer(new Float32Array([2, -2])));
    const view = new DataView(wav);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });
});
