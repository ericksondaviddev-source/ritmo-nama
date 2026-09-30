#!/usr/bin/env node
/**
 * Deja los medios de cada tambor juntos y livianos:
 *
 *   public/assets/drums/<Tambor>/modelo.glb
 *   public/assets/drums/<Tambor>/foto.webp
 *   public/assets/drums/<Tambor>/video.mp4
 *
 * Así de un vistazo se ve qué tambor tiene sus tres medios y cuál está
 * incompleto, y el catálogo nunca puede apuntar a un archivo suelto.
 *
 * Las fotos se pasan a WebP al tamaño de tarjeta (se muestran en 4/3 dentro de
 * un grid, no en pantalla completa) y los vídeos se re-codifican a H.264/AAC,
 * que es lo que reproduce cualquier Android sin volverse a descargar codecs.
 */
import { mkdirSync, copyFileSync, existsSync, statSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const RAIZ = resolve('assets drums');
const NUEVA = join(RAIZ, 'Nueva carpeta');
const VISUAL = join(RAIZ, 'visual');
const DEST = resolve('public/assets/drums');

const FOTO_ANCHO = 900; // la tarjeta es 4/3 en un grid de 3 columnas
const VIDEO_MAX_ANCHO = 720;
const VIDEO_CRF = 27;

/** Un tambor = un nombre de carpeta. `foto`/`video` pueden venir de cualquier origen. */
const TAMBORES = [
  {
    carpeta: 'Tricolor',
    foto: join(VISUAL, 'drumskidmulticolor.jpg'),
    video: join(VISUAL, 'Drumkidmulticolor3D.mp4')
  },
  {
    carpeta: 'AzulRayas',
    foto: join(NUEVA, 'azul con rayas 2.jpg'),
    video: null
  },
  { carpeta: 'GrisPlateado', foto: join(NUEVA, 'gris-plateado.jpg'), video: null },
  { carpeta: 'MaderaClara', foto: join(NUEVA, 'madera clara.jpg'), video: join(NUEVA, 'madera clara.mp4') },
  {
    carpeta: 'MaderaOscura',
    // El archivo se llama "madura oscura.jpg" (sin la e) en la carpeta del taller.
    foto: join(NUEVA, 'madura oscura.jpg'),
    video: join(NUEVA, 'madera oscura.mp4')
  },
  { carpeta: 'Rayas', foto: join(NUEVA, 'rayas.jpg'), video: null },
  { carpeta: 'RojoConKit', foto: null, video: null },
  {
    // El kit no tiene escaneo 3D: es el conjunto de tambor + baqueta + forro.
    carpeta: 'KitClasico',
    foto: join(NUEVA, 'kit-clasico. tambor-baqueta-forro.jpg'),
    // El nombre lleva una 'ñ', que no sobrevive a ir escrito a mano en el código.
    // El primero es el del kit; los otros dos son variantes numeradas.
    video: buscar(
      NUEVA,
      'kit-tambor',
      (n) => n.toLowerCase().endsWith('.mp4') && !/\d\.mp4$/.test(n)
    )
  }
];

/** Primer archivo de `carpeta` que empieza por `prefijo` y pasa el filtro. */
function buscar(carpeta, prefijo, filtro = () => true) {
  if (!existsSync(carpeta)) return null;
  const hit = readdirSync(carpeta).find((n) => n.startsWith(prefijo) && filtro(n));
  return hit ? join(carpeta, hit) : null;
}

const kb = (n) => `${Math.round(n / 1024)} KB`;

function foto(destino, origen) {
  if (!origen || !existsSync(origen)) return null;
  return sharp(origen)
    .rotate()
    .resize(FOTO_ANCHO, FOTO_ANCHO, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82, effort: 5 })
    .toFile(destino)
    .then(() => {
      console.log(`    foto   ${kb(statSync(origen).size)} -> ${kb(statSync(destino).size)}`);
      return destino;
    });
}

function video(destino, origen) {
  if (!origen || !existsSync(origen)) return null;
  // -vf escalado condicional: no ampliar si el original ya es menor.
  const filtro = `scale='min(${VIDEO_MAX_ANCHO},iw)':-2`;
  execFileSync(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error', '-i', origen,
      '-vf', filtro,
      '-c:v', 'libx264', '-crf', String(VIDEO_CRF), '-preset', 'slow',
      '-pix_fmt', 'yuv420p', '-profile:v', 'baseline', '-level', '3.1',
      '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '96k',
      destino
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  console.log(`    video  ${kb(statSync(origen).size)} -> ${kb(statSync(destino).size)}`);
  return destino;
}

const informe = [];
for (const t of TAMBORES) {
  const dir = join(DEST, t.carpeta);
  mkdirSync(dir, { recursive: true });
  console.log(`\n[${t.carpeta}]`);

  const modelo = join(dir, 'modelo.glb');
  const tieneModelo = existsSync(modelo);
  if (tieneModelo) console.log(`    modelo ${kb(statSync(modelo).size)}`);

  await foto(join(dir, 'foto.webp'), t.foto);
  video(join(dir, 'video.mp4'), t.video);

  const completa = {
    modelo: tieneModelo,
    foto: existsSync(join(dir, 'foto.webp')),
    video: existsSync(join(dir, 'video.mp4'))
  };
  informe.push({ tambor: t.carpeta, ...completa, falta: Object.entries(completa).filter(([, v]) => !v).map(([k]) => k) });
}

console.log('\n--- Resumen por tambor ---');
for (const i of informe) {
  const estado = i.falta.length === 0 ? 'completo' : `FALTA: ${i.falta.join(', ')}`;
  console.log(`  ${i.tambor.padEnd(14)} ${estado}`);
}
