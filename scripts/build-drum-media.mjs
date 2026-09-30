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
    video: join(NUEVA, 'diseño tricolor.mp4')
  },
  {
    carpeta: 'AzulRayas',
    foto: join(NUEVA, 'azul con rayas 2.jpg'),
    video: join(NUEVA, 'azul con rayas.mp4')
  },
  { carpeta: 'MaderaClara', foto: join(NUEVA, 'madera clara.jpg'), video: join(NUEVA, 'madera clara.mp4') },
  {
    carpeta: 'MaderaOscura',
    // El archivo se llama "madura oscura.jpg" (sin la e) en la carpeta del taller.
    foto: join(NUEVA, 'madura oscura.jpg'),
    video: join(NUEVA, 'madera oscura.mp4')
  },
  { carpeta: 'Rayas', foto: join(NUEVA, 'rayas.jpg'), video: join(NUEVA, 'rayas.mp4') },
  {
    // El Tambor Rojo con Kit se fusionó con el Kit Clásico: el 3D es el escaneo
    // del tambor rojo y la foto y el vídeo son los del conjunto con baqueta y
    // forro. Antes eran dos carpetas y dos fichas, cada una con la mitad.
    carpeta: 'RojoConKit',
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

/**
 * Póster: un fotograma del propio vídeo.
 *
 * Sin él, una tarjeta con `preload="none"` no muestra nada hasta que se pasa el
 * dedo, y en la sección del taller es un rectángulo negro. Se extrae del archivo
 * ya transcodado, no del original: así el póster y el vídeo siempre coinciden.
 */
function poster(destino, video_) {
  if (!video_ || !existsSync(video_)) return null;
  const dur = Number(execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', video_], { encoding: 'utf8' }).trim());
  // A los 2 s, o antes si el clip es corto: donde ya se ve el tambor y no el
  // plano inicial en negro.
  const ss = Math.min(2, Math.max(0.5, dur / 3));
  execFileSync(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error', '-ss', String(ss), '-i', video_,
      '-frames:v', '1', '-vf', "scale='min(900,iw)':-2",
      '-c:v', 'libwebp', '-quality', '72', destino
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  console.log(`    poster ${kb(statSync(destino).size)}  (fotograma a ${ss.toFixed(1)} s)`);
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
  const rutaVideo = video(join(dir, 'video.mp4'), t.video);
  poster(join(dir, 'video.webp'), rutaVideo);

  const completa = {
    modelo: tieneModelo,
    foto: existsSync(join(dir, 'foto.webp')),
    video: existsSync(join(dir, 'video.mp4')),
    poster: existsSync(join(dir, 'video.webp'))
  };
  informe.push({ tambor: t.carpeta, ...completa, falta: Object.entries(completa).filter(([, v]) => !v).map(([k]) => k) });
}

console.log('\n--- Resumen por tambor ---');
for (const i of informe) {
  const estado = i.falta.length === 0 ? 'completo' : `FALTA: ${i.falta.join(', ')}`;
  console.log(`  ${i.tambor.padEnd(14)} ${estado}`);
}
