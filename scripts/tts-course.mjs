// Genera los MP3 de narración TTS para cada tarjeta del minicurso.
// Se ejecuta en build: node scripts/tts-course.mjs
import { execFileSync } from 'child_process';
import { COURSE } from '../src/data/course.js';
import { mkdirSync } from 'fs';

const VOICE = 'es-ES-AlvaroNeural';
const OUT_DIR = 'public/assets/audio/course';

mkdirSync(OUT_DIR, { recursive: true });

for (const mod of COURSE) {
  const text = `${mod.title}. ${mod.concepto}`;
  const out = `${OUT_DIR}/${mod.instrument}.mp3`;
  execFileSync('uvx', ['edge-tts', '--text', text, '--write-media', out, '--voice', VOICE], {
    stdio: 'inherit'
  });
}
