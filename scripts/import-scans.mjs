#!/usr/bin/env node
/**
 * Convierte los escaneos OBJ del taller a un GLB intermedio listo para
 * `gltf-transform weld/simplify/optimize`.
 *
 * Los OBJ originales (68-103 MB, 500K-750K vertices, 1-1.5M triángulos) salen
 * de un escáner: traen una sola malla, un solo material, textura atlas y CERO
 * normales. Aquí se calculan las normales, se empaqueta metallic+roughness en un
 * solo canal (glTF: G=roughness, B=metallic) y se redimensionan las texturas.
 *
 * Uso:
 *   node scripts/import-scans.mjs [--size 2048] [--only "azul con rayas 2"]
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';

const SRC = resolve('assets drums/Nueva carpeta');
const OUT = resolve('node_modules/.cache/scans');

/** Los tres escaneos del taller. El nombre de salida es estable y legible. */
const SCANS = [
  { dir: 'azul con rayas 2', name: 'EscaneoAzul' },
  { dir: 'gris-plateado', name: 'EscaneoGris' },
  { dir: 'negro con chispas', name: 'EscaneoNegro' }
];

const argv = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const TEX_SIZE = Number(argOf('--size', 2048));
const ONLY = argOf('--only', null);

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

/* ------------------------------------------------------------------ *
 * Lectura de números directamente del Buffer.
 * Un scan de 103 MB con ~3M números no puede permitirse crear 3M subcadenas,
 * así que aquí no se usa ni split() ni toString() por número.
 * ------------------------------------------------------------------ */
function readFloat(buf, start, end) {
  let i = start;
  let neg = false;
  if (buf[i] === 45) {
    neg = true;
    i++;
  }
  let val = 0;
  while (i < end) {
    const c = buf[i];
    if (c < 48 || c > 57) break;
    val = val * 10 + (c - 48);
    i++;
  }
  if (buf[i] === 46) {
    i++;
    let frac = 0.1;
    while (i < end) {
      const c = buf[i];
      if (c < 48 || c > 57) break;
      val += (c - 48) * frac;
      frac *= 0.1;
      i++;
    }
  }
  const e = buf[i];
  if (e === 101 || e === 69) {
    // Notación científica (algunos escáneres la emiten en las UV).
    i++;
    let esign = 1;
    if (buf[i] === 45) {
      esign = -1;
      i++;
    } else if (buf[i] === 43) i++;
    let exp = 0;
    while (i < end) {
      const c = buf[i];
      if (c < 48 || c > 57) break;
      exp = exp * 10 + (c - 48);
      i++;
    }
    val *= 10 ** (esign * exp);
  }
  return neg ? -val : val;
}

/** Array tipado que crece por trozos, para no reservar 1.5M de arrays sueltos. */
class Growable {
  constructor(Type, capacity = 1 << 16) {
    this.Type = Type;
    this.data = new Type(capacity);
    this.length = 0;
  }
  push(...vals) {
    if (this.length + vals.length > this.data.length) {
      const bigger = new this.Type(Math.max(this.data.length * 2, this.length + vals.length));
      bigger.set(this.data.subarray(0, this.length));
      this.data = bigger;
    }
    for (let i = 0; i < vals.length; i++) this.data[this.length++] = vals[i];
  }
  trimmed() {
    return this.data.subarray(0, this.length);
  }
}

const VERT_KEY_SHIFT = 1048576; // 2^20: índices v y vt caben (< 1.05M)

/**
 * Parsea el OBJ. Devuelve arrays desduplicados por par (v, vt) más normales
 * suaves calculadas por área (el OBJ no trae ninguna).
 */
function parseObj(buf, label) {
  const rawPos = new Growable(Float32Array, 1 << 22);
  const rawUv = new Growable(Float32Array, 1 << 21);
  const corners = new Growable(Int32Array, 1 << 24); // 2 ints por esquina

  const len = buf.length;
  let lineStart = 0;
  let vCount = 0;
  let vtCount = 0;
  let triCount = 0;

  while (lineStart < len) {
    let lineEnd = lineStart;
    while (lineEnd < len && buf[lineEnd] !== 10) lineEnd++;

    const c0 = buf[lineStart];
    const c1 = buf[lineStart + 1];

    if ((c0 === 118 || c0 === 102) && c1 === 32) {
      // "v ..." (118) o "f ..." (102)
      const tag = c0;
      if (tag === 118) {
        let p = lineStart + 2;
        for (let k = 0; k < 3; k++) {
          while (p < lineEnd && buf[p] === 32) p++;
          let e = p;
          while (e < lineEnd && buf[e] !== 32) e++;
          rawPos.push(readFloat(buf, p, e));
          p = e;
        }
        vCount++;
      } else {
        // Cara: "f v/vt v/vt ...". Se admite v/vt/vn, v/vt, v//vn y v.
        const parts = [];
        let p = lineStart + 2;
        while (p < lineEnd) {
          while (p < lineEnd && buf[p] === 32) p++;
          if (p >= lineEnd) break;
          let e = p;
          while (e < lineEnd && buf[e] !== 32) e++;
          // primer campo antes de '/'
          let slash = p;
          while (slash < e && buf[slash] !== 47) slash++;
          const vi = readFloat(buf, p, slash);
          let ti = 0;
          if (slash < e) {
            let t2 = slash + 1;
            let t2e = t2;
            while (t2e < e && buf[t2e] !== 47) t2e++;
            if (t2e > t2) ti = readFloat(buf, t2, t2e);
          }
          parts.push(vi, ti);
          p = e;
        }
        const n = parts.length >> 1;
        for (let k = 2; k < n; k++) {
          // Abanico: (0,k-1,k)
          corners.push(parts[0], parts[1], parts[(k - 1) * 2], parts[(k - 1) * 2 + 1], parts[k * 2], parts[k * 2 + 1]);
          triCount++;
        }
      }
    } else if (c0 === 118 && c1 === 116) {
      // "vt u v"
      let p = lineStart + 3;
      for (let k = 0; k < 2; k++) {
        while (p < lineEnd && buf[p] === 32) p++;
        let e = p;
        while (e < lineEnd && buf[e] !== 32) e++;
        rawUv.push(readFloat(buf, p, e));
        p = e;
      }
      vtCount++;
    }

    lineStart = lineEnd + 1;
  }

  const posRaw = rawPos.trimmed();
  const uvRaw = rawUv.trimmed();
  const corner = corners.trimmed();

  // Dedup por par (v, vt). El escáner parte vértices por UV, así que sin esto
  // el simplificador no puede colapsar nada.
  const map = new Map();
  const positions = new Growable(Float32Array, posRaw.length);
  const uvs = new Growable(Float32Array, (uvRaw.length / 2) * 2);
  const indices = new Growable(Uint32Array, corner.length);

  const nCorners = corner.length >> 1;
  for (let k = 0; k < nCorners; k++) {
    const vi = corner[k * 2] - 1; // OBJ es 1-based
    const ti = corner[k * 2 + 1] - 1;
    const key = vi * VERT_KEY_SHIFT + (ti >= 0 ? ti : 0);
    let out = map.get(key);
    if (out === undefined) {
      out = positions.length / 3;
      positions.push(posRaw[vi * 3], posRaw[vi * 3 + 1], posRaw[vi * 3 + 2]);
      if (ti >= 0) uvs.push(uvRaw[ti * 2], uvRaw[ti * 2 + 1]);
      else uvs.push(0, 0);
      map.set(key, out);
    }
    indices.push(out);
  }

  const P = positions.trimmed();
  const U = uvs.trimmed();
  const I = indices.trimmed();

  // Normales suaves por área. Sin esto el modelo se ve plano: el OBJ no trae vn.
  const N = new Float32Array(P.length);
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = I[t] * 3;
    const b = I[t + 1] * 3;
    const c = I[t + 2] * 3;
    const ux = P[b] - P[a];
    const uy = P[b + 1] - P[a + 1];
    const uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a];
    const vy = P[c + 1] - P[a + 1];
    const vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    N[a] += nx; N[a + 1] += ny; N[a + 2] += nz;
    N[b] += nx; N[b + 1] += ny; N[b + 2] += nz;
    N[c] += nx; N[c + 1] += ny; N[c + 2] += nz;
  }
  for (let k = 0; k < N.length; k += 3) {
    const x = N[k];
    const y = N[k + 1];
    const z = N[k + 2];
    const len2 = Math.hypot(x, y, z);
    if (len2 > 1e-12) {
      N[k] = x / len2;
      N[k + 1] = y / len2;
      N[k + 2] = z / len2;
    } else {
      N[k + 1] = 1;
    }
  }

  console.log(
    `  ${label}: v=${vCount} vt=${vtCount} -> ${P.length / 3} vértices, ` +
      `${triCount} triángulos, ${I.length / 3} índices`
  );

  return { positions: P, uvs: U, normals: N, indices: I };
}

/* ------------------------------------------------------------------ *
 * Texturas
 *
 * glTF solo admite 'image/jpeg' e 'image/png' en el núcleo; WebP exige la
 * extensión EXT_texture_webp. Por eso aquí se emite JPEG/PNG (MIME válido) y
 * es `gltf-transform optimize --texture-compress webp` quien reencoda a WebP
 * declarando la extensión correctamente.
 * ------------------------------------------------------------------ */
const findTexture = (files, kind) => {
  const hit = files.find((f) => f.toLowerCase().endsWith('.png') && f.toLowerCase().includes(kind));
  if (!hit) throw new Error(`No se encontró la textura "${kind}"`);
  return hit;
};

async function baseColorTexture(doc, dir, files) {
  const file = files.find((f) => f.toLowerCase().endsWith('.png') && !/_metallic|_roughness|_normal/.test(f.toLowerCase()));
  if (!file) throw new Error('No se encontró la textura baseColor');
  const { data, info } = await sharp(join(dir, file))
    .resize(TEX_SIZE, TEX_SIZE, { fit: 'fill' })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  console.log(`    baseColor  ${file} ${mb(info.size)} -> ${kb(data.length)}`);
  return doc.createTexture('baseColor').setImage(new Uint8Array(data)).setMimeType('image/jpeg');
}

/**
 * glTF espera un solo mapa para metallic+roughness: G=roughness, B=metallic.
 * El escáner entrega dos PNG en gris, así que se fusionan canal a canal.
 */
async function metalRoughTexture(doc, dir, files) {
  const mFile = findTexture(files, 'metallic');
  const rFile = findTexture(files, 'roughness');
  const opts = { fit: 'fill', raw: { depth: 'uchar' } };

  const rough = await sharp(join(dir, rFile)).resize(TEX_SIZE, TEX_SIZE, opts).greyscale().raw().toBuffer();
  const metal = await sharp(join(dir, mFile)).resize(TEX_SIZE, TEX_SIZE, opts).greyscale().raw().toBuffer();
  if (rough.length !== metal.length) throw new Error('Tamaños de metallic/roughness distintos');

  const px = rough.length;
  const out = Buffer.alloc(px * 4);
  for (let i = 0; i < px; i++) {
    out[i * 4 + 0] = 255; // R: reservado (AO)
    out[i * 4 + 1] = rough[i]; // G: roughness
    out[i * 4 + 2] = metal[i]; // B: metallic
    out[i * 4 + 3] = 255; // A: reservado
  }
  const { data, info } = await sharp(out, { raw: { width: TEX_SIZE, height: TEX_SIZE, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  console.log(`    ORM        ${mFile} + ${rFile} -> ${mb(info.size)}`);
  return doc.createTexture('metalRough').setImage(new Uint8Array(data)).setMimeType('image/png');
}

async function normalTexture(doc, dir, files) {
  const file = findTexture(files, 'normal');
  const { data, info } = await sharp(join(dir, file))
    .resize(TEX_SIZE, TEX_SIZE, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  console.log(`    normal     ${file} ${mb(info.size)} -> ${mb(info.size)}`);
  return doc.createTexture('normal').setImage(new Uint8Array(data)).setMimeType('image/png');
}

/* ------------------------------------------------------------------ *
 * Conversión
 * ------------------------------------------------------------------ */
async function convert(scan) {
  const dir = join(SRC, scan.dir);
  if (!existsSync(dir)) throw new Error(`No existe la carpeta "${scan.dir}"`);

  const files = readdirSync(dir);
  const objFile = files.find((f) => f.toLowerCase().endsWith('.obj'));
  if (!objFile) throw new Error(`No hay .obj en "${scan.dir}"`);

  console.log(`\n[${scan.name}] ${scan.dir}`);
  const geo = parseObj(readFileSync(join(dir, objFile)), objFile.slice(0, 8));

  const doc = new Document();
  doc.createBuffer();
  const material = doc
    .createMaterial('Tambor')
    .setBaseColorFactor([1, 1, 1, 1])
    .setMetallicFactor(1)
    .setRoughnessFactor(1)
    .setDoubleSided(false);

  material.setBaseColorTexture(await baseColorTexture(doc, dir, files));
  material.setMetallicRoughnessTexture(await metalRoughTexture(doc, dir, files));
  material.setNormalTexture(await normalTexture(doc, dir, files));

  const buffer = doc.getRoot().listBuffers()[0];
  const prim = doc
    .createPrimitive()
    .setAttribute(
      'POSITION',
      doc.createAccessor('positions').setType('VEC3').setArray(geo.positions).setBuffer(buffer)
    )
    .setAttribute(
      'TEXCOORD_0',
      doc.createAccessor('uvs').setType('VEC2').setArray(geo.uvs).setBuffer(buffer)
    )
    .setAttribute(
      'NORMAL',
      doc.createAccessor('normals').setType('VEC3').setArray(geo.normals).setBuffer(buffer)
    )
    .setIndices(doc.createAccessor('indices').setType('SCALAR').setArray(geo.indices).setBuffer(buffer))
    .setMaterial(material);

  doc.createScene('Scene').addChild(doc.createNode(scan.name).setMesh(doc.createMesh(scan.name).addPrimitive(prim)));

  const glb = await new NodeIO().writeBinary(doc);
  mkdirSync(OUT, { recursive: true });
  const outPath = join(OUT, `${scan.name}.raw.glb`);
  writeFileSync(outPath, glb);
  console.log(`  -> ${outPath} (${mb(glb.length)})`);
  return outPath;
}

/* ------------------------------------------------------------------ *
 * Cadena de optimización (weld -> simplify -> optimize)
 *
 * Los OBJ traen vértices partidos por UV; sin 'weld' el simplificador no
 * colapsa nada. Draco y WebP los aplica la CLI, que además declara las
 * extensiones (EXT_texture_webp) que un encoder manual no declara.
 * ------------------------------------------------------------------ */
const CLI = (() => {
  const pkgPath = resolve('node_modules/@gltf-transform/cli/package.json');
  const { bin } = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return join(dirname(pkgPath), bin['gltf-transform']);
})();

const RATIO = Number(argOf('--ratio', 0.15));
const DEST = resolve('public/assets/models');

function gltfTransform(args) {
  execFileSync(process.execPath, [CLI, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function optimize(scan) {
  const c = OUT;
  const raw = join(c, `${scan.name}.raw.glb`);
  const weld = join(c, `${scan.name}.weld.glb`);
  const simp = join(c, `${scan.name}.simp.glb`);
  const final = join(DEST, `${scan.name}.glb`);

  gltfTransform(['weld', raw, weld]);
  gltfTransform(['simplify', weld, simp, '--ratio', String(RATIO), '--error', '0.001']);
  mkdirSync(DEST, { recursive: true });
  gltfTransform(['optimize', simp, final, '--compress', 'draco', '--texture-compress', 'webp']);

  for (const tmp of [raw, weld, simp]) rmSync(tmp, { force: true });
  const bytes = statSync(final).size;
  console.log(`  -> public/assets/models/${scan.name}.glb  ${mb(bytes)}`);
  return bytes;
}

mkdirSync(OUT, { recursive: true });
const targets = ONLY ? SCANS.filter((s) => s.dir === ONLY || s.name === ONLY) : SCANS;
if (!targets.length) {
  console.error(`No coincide "${ONLY}". Disponibles: ${SCANS.map((s) => s.dir).join(', ')}`);
  process.exit(1);
}
console.log(`Texturas a ${TEX_SIZE}px · simplificado al ${(RATIO * 100).toFixed(0)}% · salida en public/assets/models`);
for (const scan of targets) {
  await convert(scan);
  optimize(scan);
}
console.log('\nListo.');
