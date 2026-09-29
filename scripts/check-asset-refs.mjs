// Auditoría de referencias: toda ruta /assets/... citada en el código debe
// existir en public/. Es el fallo que más fácil se cuela al añadir productos.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(js|html)$/.test(entry.name)) files.push(p);
  }
};
walk('src');
files.push('index.html');

// Rutas tipo /assets/... hasta la comilla, el apóstrofo o el acento grave.
const PATTERN = /\/assets\/[A-Za-z0-9._\-/%()áéíóúüñÁÉÍÓÚÜÑ ]+\.(?:glb|gltf|mp3|mp4|webm|jpg|jpeg|png|webp|svg|wasm|js)/g;

const refs = new Map();
for (const file of files) {
  if (!existsSync(file) || !statSync(file).isFile()) continue;
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(PATTERN)) {
    const ref = m[0];
    if (!refs.has(ref)) refs.set(ref, new Set());
    refs.get(ref).add(file);
  }
}

let bad = 0;
for (const ref of [...refs.keys()].sort()) {
  const disk = join('public', ref.replace(/^\//, ''));
  if (!existsSync(disk)) {
    bad++;
    console.log('  FALTA', ref, ' <-', [...refs.get(ref)].join(', '));
  }
}
console.log(
  bad === 0 ? `  OK: ${refs.size} rutas, todas existen` : `  ${bad} rotas de ${refs.size}`
);

