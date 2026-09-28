#!/usr/bin/env node
/**
 * Optimiza los GLB que entrega el taller directamente (con texturas PBR ya
 * montadas) y los deja listos para el catálogo.
 *
 * A diferencia de `import-scans.mjs`, aquí no hay que reconstruir geometría ni
 * recalcular normales: el archivo ya trae POSITION/NORMAL/TEXCOORD_0 y las
 * texturas baseColor / metallicRoughness / normal. El trabajo es el mismo que en
 * el final de aquel script: soldar, simplificar y recomprimir, porque tal como
 * llegan los escaneos pesan 85-97 MB.
 *
 * Uso:
 *   node scripts/optimize-scans.mjs [--ratio 0.15]
 */
import { readFileSync, existsSync, mkdirSync, statSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const SRC = resolve('assets drums/Nueva carpeta');
const OUT = resolve('node_modules/.cache/scans');
const DEST = resolve('public/assets/models');

/** Nombre de salida estable por producto del catálogo. */
const SCANS = [
  { file: 'azul con rayas.glb', name: 'EscaneoAzul' },
  { file: 'gris plateado.glb', name: 'EscaneoGris' },
  { file: 'negro con chispas.glb', name: 'EscaneoNegro' },
  { file: 'madera clara.glb', name: 'EscaneoMaderaClara' },
  { file: 'madera oscura.glb', name: 'EscaneoMaderaOscura' }
];

const argv = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const RATIO = Number(argOf('--ratio', 0.15));
const ONLY = argOf('--only', null);

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

/* ------------------------------------------------------------------ *
 * Cadena de optimización (weld -> simplify -> optimize)
 * ------------------------------------------------------------------ */
const CLI = (() => {
  const pkgPath = resolve('node_modules/@gltf-transform/cli/package.json');
  const { bin } = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return join(dirname(pkgPath), bin['gltf-transform']);
})();

function gltfTransform(args) {
  execFileSync(process.execPath, [CLI, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function optimize(scan) {
  const src = join(SRC, scan.file);
  if (!existsSync(src)) throw new Error(`No existe "${scan.file}" en assets drums/Nueva carpeta`);

  mkdirSync(OUT, { recursive: true });
  mkdirSync(DEST, { recursive: true });

  const weld = join(OUT, `${scan.name}.weld.glb`);
  const simp = join(OUT, `${scan.name}.simp.glb`);
  const final = join(DEST, `${scan.name}.glb`);

  const before = statSync(src).size;
  gltfTransform(['weld', src, weld]);
  gltfTransform(['simplify', weld, simp, '--ratio', String(RATIO), '--error', '0.001']);
  gltfTransform(['optimize', simp, final, '--compress', 'draco', '--texture-compress', 'webp']);

  for (const tmp of [weld, simp]) rmSync(tmp, { force: true });
  const after = statSync(final).size;
  console.log(
    `  ${scan.name}: ${mb(before)} -> ${mb(after)} ` +
      `(${((100 * after) / before).toFixed(1)}% del original, 1/${(before / after).toFixed(0)})`
  );
  return after;
}

const targets = ONLY ? SCANS.filter((s) => s.name === ONLY || s.file === ONLY) : SCANS;
if (!targets.length) {
  console.error(`No coincide "${ONLY}". Disponibles: ${SCANS.map((s) => s.name).join(', ')}`);
  process.exit(1);
}

console.log(`Simplificado al ${(RATIO * 100).toFixed(0)}% · salida en public/assets/models`);
for (const scan of targets) optimize(scan);
console.log('\nListo.');
