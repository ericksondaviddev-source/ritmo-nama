import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'assets drums', 'visual');
const OUT_MODELS = path.join(ROOT, 'public', 'assets', 'models');
const OUT_VIDEO = path.join(ROOT, 'public', 'assets', 'video');
const OUT_IMG = path.join(ROOT, 'public', 'assets', 'img');

const MODELS = ['Drumkidmulticolor3D.glb', 'Drumkid3D.glb', 'Mostradordrums.glb'];
const COPIES = [
  ['Drumkidmulticolor3D.mp4', OUT_VIDEO],
  ['Drumkid3D.mp4', OUT_VIDEO],
  ['mostradordrum.mp4', OUT_VIDEO],
  ['drumskidmulticolor.jpg', OUT_IMG],
  ['Red_wooden_drum_with_mallet_20260925130521.jpg', OUT_IMG],
  ['Colorful_drums_on_wooden_shelf.jpg', OUT_IMG]
];

const mb = (file) => `${(statSync(file).size / 1024 / 1024).toFixed(1)} MB`;

mkdirSync(OUT_MODELS, { recursive: true });
mkdirSync(OUT_VIDEO, { recursive: true });
mkdirSync(OUT_IMG, { recursive: true });

for (const file of MODELS) {
  const input = path.join(SRC, file);
  const output = path.join(OUT_MODELS, file);
  if (!existsSync(input)) {
    console.warn(`no existe: ${input}`);
    continue;
  }
  rmSync(output, { force: true });
  const result = spawnSync(
    'gltf-transform',
    [
      'optimize',
      `"${input}"`,
      `"${output}"`,
      '--compress', 'meshopt',
      '--texture-compress', 'webp',
      '--texture-size', '2048'
    ],
    { shell: true, stdio: 'inherit', cwd: ROOT }
  );
  if (result.status !== 0) {
    console.error(`fallo optimizando ${file}`);
    process.exitCode = 1;
    continue;
  }
  console.log(`${file}: ${mb(input)} -> ${mb(output)}`);
}

for (const [file, dir] of COPIES) {
  const from = path.join(SRC, file);
  if (existsSync(from)) copyFileSync(from, path.join(dir, file));
}
console.log('assets listos en public/assets/');
