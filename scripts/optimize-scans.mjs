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
const VISUAL = resolve('assets drums/visual');
const NUEVA_CARPETA = SRC;
const OUT = resolve('node_modules/.cache/scans');
const DEST = resolve('public/assets/drums');

/**
 * Los escaneos del taller, con la ruta de origen y el nombre de salida estable.
 *
 * `ratio` se ajusta por escaneo: los que llegan con 1-1,5M triángulos se
 * simplifican fuerte, pero el tricolor sólo trae 50K y casi todo su peso son
 * texturas: ahí conviene conservarlo entero y comprimir sobre todo la imagen.
 */
const SCANS = [
  { dir: NUEVA_CARPETA, file: 'azul con rayas.glb', name: 'AzulRayas', ratio: 0.15 },
  { dir: NUEVA_CARPETA, file: 'gris plateado.glb', name: 'GrisPlateado', ratio: 0.15 },
  { dir: NUEVA_CARPETA, file: 'madera clara.glb', name: 'MaderaClara', ratio: 0.15 },
  { dir: NUEVA_CARPETA, file: 'madera oscura.glb', name: 'MaderaOscura', ratio: 0.15 },
  { dir: NUEVA_CARPETA, file: 'rayas.glb', name: 'Rayas', ratio: 0.15 },
  { dir: NUEVA_CARPETA, file: 'rojo con kit.glb', name: 'RojoConKit', ratio: 0.15 },
  { dir: VISUAL, file: 'Drumkidmulticolor3D.glb', name: 'Tricolor', ratio: 1 }
];

const argv = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const RATIO = Number(argOf('--ratio', 0.15));
const ONLY = argOf('--only', null);

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const kb = (n) => `${Math.round(n / 1024)} KB`;

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
  const src = join(scan.dir ?? SRC, scan.file);
  if (!existsSync(src)) throw new Error(`No existe "${scan.file}"`);

  const ratio = scan.ratio ?? RATIO;

  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(DEST, scan.name), { recursive: true });

  const weld = join(OUT, `${scan.name}.weld.glb`);
  const simp = join(OUT, `${scan.name}.simp.glb`);
  const final = join(DEST, scan.name, 'modelo.glb');

  const before = statSync(src).size;
  gltfTransform(['weld', src, weld]);
  // Con ratio 1 no hace falta pasar por el simplificador: se pierde detalle
  // sin ganar nada cuando el modelo ya trae pocos triángulos.
  const siguiente = ratio >= 1 ? weld : simp;
  if (ratio < 1) {
    gltfTransform(['simplify', weld, simp, '--ratio', String(ratio), '--error', '0.001']);
  }
  gltfTransform(['optimize', siguiente, final, '--compress', 'draco', '--texture-compress', 'webp']);

  // Copia ultraligera para el visualizador 3D del estudio: aquí los tambores
  // sólo se ven de lejos y rebotan, así que bastan 512 px de textura y la
  // malla muy simplificada. Sin esto, elegir el estilo 3D costaría 6 MB.
  const vizDir = join(DEST, scan.name, 'visualizador');
  mkdirSync(vizDir, { recursive: true });
  const vizFinal = join(vizDir, 'modelo.glb');
  const vizWeld = join(OUT, `${scan.name}.viz.weld.glb`);
  const vizSimp = join(OUT, `${scan.name}.viz.simp.glb`);
  gltfTransform(['weld', final, vizWeld]);
  gltfTransform(['simplify', vizWeld, vizSimp, '--ratio', '0.08', '--error', '0.004']);
  gltfTransform([
    'optimize', vizSimp, vizFinal,
    '--compress', 'draco',
    '--texture-compress', 'webp',
    '--texture-size', '512'
  ]);
  for (const tmp of [vizWeld, vizSimp]) rmSync(tmp, { force: true });
  const vizBytes = statSync(vizFinal).size;

  for (const tmp of [weld, simp]) rmSync(tmp, { force: true });
  const after = statSync(final).size;
  console.log(
    `  ${scan.name.padEnd(13)} ${mb(before)} -> ${mb(after)}  ` +
      `(${((100 * after) / before).toFixed(1)}%, 1/${(before / after).toFixed(0)})` +
      `   visualizador: ${kb(vizBytes)}`
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
