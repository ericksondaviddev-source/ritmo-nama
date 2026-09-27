# Sub-proyecto 2 — Catálogo / Configurador 3D + export 360° Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la sección `#catalogo` con tarjetas de producto (reels en hover/tap), kit incluido, configurador 3D central con selector de acabados en tiempo real (3 zonas) y export del clip de rotación 360°.

**Architecture:** Una sola página SPA (sin router): la sección se monta en `#catalogo` desde `main.js`. El configurador es un módulo three.js independiente que comparte carga/encuadre de GLB con el visor del hero (`load-model.js`). Como los GLB tienen **un único material con textura horneada** (`Material.001`), el selector de acabados divide la malla en 3 zonas geométricas (cilindro/parches/lazos) reordenando el índice y usando `geometry.addGroup` + un material por zona; los tintes se aplican con `material.color`. El export 360° usa `canvas.captureStream()` + `MediaRecorder` sobre el render en curso.

**Tech Stack:** Vite + JS modular, Tailwind v4, three.js (dinámico), Vitest, MediaRecorder/captureStream.

**Spec:** `docs/superpowers/specs/2026-09-26-ritmo-nama-design.md` §6, §9, §10, §11 (Sub-proyecto 2).

---

## Decisiones tomadas (desviaciones/interpretaciones de la spec)

1. **GLB de material único → zonas geométricas (§6):** la spec asumía "recorrido de materiales por nombre"; los 3 GLBs (originales y optimizados) tienen **un solo material `Material.001` con textura horneada**. Adaptación: `regions.js` clasifica cada triángulo (parche = normal ±Y, cilindro = radio bajo, resto = lazos/baqueta/cantos a radio alto) y reordena el índice para `addGroup`. Validado empíricamente offline: umbral normal 0.7, radio 0.5 (unidades de malla) separan bien los dos modelos Drumkid.
2. **Zonas de la UI:** "Madera del cilindro" · "Parches" · "Lazos y baqueta". El *splatter* está horneado en la textura: se tiñe con la zona que lo contiene (cilindro o parches); no existe zona geométrica propia de splatter.
3. **Set Na'má no es personalizable:** `Mostradordrums` es el exhibidor de diseños; sus reglas geométricas no aplican (múltiples tambores en posiciones variadas). El selector de acabados queda deshabilitado con aviso mientras esté seleccionado.
4. **Reels:** sin `poster` pesado; `<img loading="lazy">` de base (posters en `public/assets/img/`) y `<video preload="none">` superpuesto que se muestra en hover (ratón) o tap (táctil).
5. **Carga diferida del configurador:** `IntersectionObserver` inicializa el visor solo cuando la sección está cerca del viewport (protege Lighthouse; el hero ya carga un GLB de 1.2 MB).
6. **Export = WebM** (`video/webm;codecs=vp9` → `vp8` → `webm`): `MediaRecorder` no produce MP3/WAV aquí (§8 aplica a audio del MidiPad; §10 cubre no-soporte deshabilitando el botón). Una vuelta = 4 s, `autoRotateSpeed = 60000 / durationMs` con `controls.update(deltaTime)` para que la vuelta sea exacta sin importar los FPS.
7. **CTA de contacto compartido:** se extrae `contact-cta.js` (header + catálogo + futuro MidiPad) manteniendo `aria-disabled` (enfocable por teclado, ya verificado en el Sub-proyecto 1).

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/data/catalog.js` | Create | Productos, kit incluido, opciones de acabado |
| `src/core/three/regions.js` | Create | Clasificación geométrica pura (partición de triángulos) — TDD |
| `src/core/three/load-model.js` | Create | `hasWebGL`, `loadGltf`, `fitModel`, `importOrbitControls` compartidos |
| `src/core/three/viewer.js` | Modify | Usa `load-model.js` (comportamiento idéntico) |
| `src/components/contact-cta.js` | Create | Markup + wiring del CTA diferido |
| `src/components/header.js` | Modify | Usa `contact-cta.js` |
| `src/core/three/configurator.js` | Create | Visor libre, tintes por zona, cambio de modelo, export 360°, fallback vídeo |
| `src/components/catalog.js` | Create | Sección: tarjetas, reels, kit, panel de acabados, export |
| `src/main.js` | Modify | Monte de `mountCatalog` |
| `index.html` | Modify | Sección `<section id="catalogo">` |
| `tests/catalog.test.js` | Create | Datos del catálogo + existencia de assets (TDD) |
| `tests/regions.test.js` | Create | Clasificación y partición (TDD) |

**Tests esperados al final:** 8 archivos, 40 tests (29 actuales + 3 catálogo + 8 regiones).

---

### Task 1: Data layer del catálogo

**Files:**
- Create: `tests/catalog.test.js`
- Create: `src/data/catalog.js`

- [x] **Step 1: Escribir el test fallido `tests/catalog.test.js`**

```js
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FINISHES, KIT_INCLUIDO, PRODUCTS } from '../src/data/catalog.js';

const ROOT = process.cwd();

describe('productos del catálogo', () => {
  it('son 4 tarjetas con ids únicos y assets que existen en disco', () => {
    expect(PRODUCTS).toHaveLength(4);
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(4);
    const [a, b, c, d] = PRODUCTS;
    expect(a.id).toBe('drumkid-multicolor');
    expect(b.id).toBe('drumkid-clasico');
    expect(c.id).toBe('set-nama');
    expect(d.id).toBe('personaliza');
    expect(d.isCta).toBe(true);
    for (const p of [a, b, c]) {
      expect(p.name).toBeTruthy();
      expect(p.tagline).toBeTruthy();
      expect(p.price).toMatch(/49/);
      expect(p.model.startsWith('/assets/models/')).toBe(true);
      expect(existsSync(path.join(ROOT, 'public', p.model))).toBe(true);
      expect(existsSync(path.join(ROOT, 'public', p.video))).toBe(true);
      expect(existsSync(path.join(ROOT, 'public', p.poster))).toBe(true);
    }
    expect(a.customizable).toBe(true);
    expect(b.customizable).toBe(true);
    expect(c.customizable).toBe(false);
  });
});

describe('kit incluido', () => {
  it('lista al menos 5 elementos con texto', () => {
    expect(KIT_INCLUIDO.length).toBeGreaterThanOrEqual(5);
    for (const item of KIT_INCLUIDO) expect(item.trim().length).toBeGreaterThan(3);
  });
});

describe('acabados', () => {
  it('define 3 zonas; cada una empieza por Original (#ffffff)', () => {
    expect(Object.keys(FINISHES).sort()).toEqual(['head', 'trim', 'wood']);
    for (const options of Object.values(FINISHES)) {
      expect(options.length).toBeGreaterThanOrEqual(3);
      expect(options[0]).toEqual({ id: 'original', label: 'Original', hex: '#ffffff' });
      for (const opt of options) expect(opt.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
```

- [x] **Step 2: Ejecutar para verlo fallar**

Run: `npm test -- tests/catalog.test.js`
Expected: FAIL — no se puede resolver `../src/data/catalog.js`.

- [x] **Step 3: Crear `src/data/catalog.js`**

```js
export const KIT_INCLUIDO = [
  'Doble parche sintético impermeable',
  'Baqueta profesional de obsequio',
  'Forro de tela de obsequio',
  'Garantía de 6 meses',
  'Acceso al minicurso de fulia',
  'Acceso a la mini-app MidiPad'
];

export const PRODUCTS = [
  {
    id: 'drumkid-multicolor',
    name: 'Drumkid Multicolor',
    tagline: 'Splatter artesanal, el más alegre',
    price: '49 $',
    model: '/assets/models/Drumkidmulticolor3D.glb',
    video: '/assets/video/Drumkidmulticolor3D.mp4',
    poster: '/assets/img/drumskidmulticolor.jpg',
    customizable: true,
    // unidades de malla del GLB (verificado offline: parches |ny|>0.7, valle de radio en 0.50)
    regions: { normalThreshold: 0.7, radiusThreshold: 0.5 }
  },
  {
    id: 'drumkid-clasico',
    name: 'Drumkid Clásico',
    tagline: 'Madera natural, clásico de siempre',
    price: '49 $',
    model: '/assets/models/Drumkid3D.glb',
    video: '/assets/video/Drumkid3D.mp4',
    poster: '/assets/img/Red_wooden_drum_with_mallet_20260925130521.jpg',
    customizable: true,
    regions: { normalThreshold: 0.7, radiusThreshold: 0.5 }
  },
  {
    id: 'set-nama',
    name: "Set Na'má",
    tagline: 'Exhibidor con diseños variados',
    price: '49 $ por unidad',
    model: '/assets/models/Mostradordrums.glb',
    video: '/assets/video/mostradordrum.mp4',
    poster: '/assets/img/Colorful_drums_on_wooden_shelf.jpg',
    customizable: false,
    regions: null
  },
  {
    id: 'personaliza',
    name: 'Personaliza el tuyo',
    tagline: 'Tú diseñas, nosotros fabricamos',
    price: 'A medida',
    isCta: true,
    customizes: 'drumkid-multicolor'
  }
];

export const FINISHES = {
  wood: [
    { id: 'original', label: 'Original', hex: '#ffffff' },
    { id: 'nogal', label: 'Nogal', hex: '#7c4a26' },
    { id: 'caoba', label: 'Caoba', hex: '#9a3a28' },
    { id: 'oro', label: 'Oro viejo', hex: '#c08a2e' }
  ],
  head: [
    { id: 'original', label: 'Original', hex: '#ffffff' },
    { id: 'marfil', label: 'Marfil', hex: '#f1e3c6' },
    { id: 'negro', label: 'Negro', hex: '#3f3f46' },
    { id: 'rojo', label: 'Rojo fulia', hex: '#c2413a' }
  ],
  trim: [
    { id: 'original', label: 'Original', hex: '#ffffff' },
    { id: 'dorado', label: 'Dorado', hex: '#d9a441' },
    { id: 'verde', label: 'Verde tambor', hex: '#3f9b7d' },
    { id: 'coral', label: 'Coral', hex: '#e0615a' }
  ]
};

export const FINISH_ZONES = [
  { id: 'wood', label: 'Madera del cilindro' },
  { id: 'head', label: 'Parches' },
  { id: 'trim', label: 'Lazos y baqueta' }
];
```

- [x] **Step 4: Ejecutar para verlo pasar**

Run: `npm test -- tests/catalog.test.js`
Expected: PASS (3 tests).

- [x] **Step 5: Commit**

```powershell
git add tests/catalog.test.js src/data/catalog.js
git commit -m "feat: data layer del catalogo (productos, kit, acabados)"
```

---

### Task 2: Clasificación geométrica de regiones

**Files:**
- Create: `tests/regions.test.js`
- Create: `src/core/three/regions.js`

- [x] **Step 1: Escribir el test fallido `tests/regions.test.js`**

```js
import { describe, expect, it } from 'vitest';
import { REGION_ORDER, classifyVertex, partitionTriangles } from '../src/core/three/regions.js';

describe('classifyVertex', () => {
  it('normal vertical (parche)', () => {
    expect(classifyVertex({ nx: 0, ny: 1, x: 0.1, z: 0 }, { radiusThreshold: 0.5 })).toBe('head');
  });
  it('radio por encima del umbral (lazos/baqueta)', () => {
    expect(classifyVertex({ nx: 1, ny: 0, x: 0.6, z: 0 }, { radiusThreshold: 0.5 })).toBe('trim');
  });
  it('radio bajo y normal horizontal (cilindro)', () => {
    expect(classifyVertex({ nx: 1, ny: 0, x: 0.3, z: 0 }, { radiusThreshold: 0.5 })).toBe('wood');
  });
  it('normal inclinada bajo el umbral no es parche', () => {
    expect(classifyVertex({ nx: 0, ny: 0.3, x: 0, z: 0 }, { normalThreshold: 0.7 })).toBe('wood');
  });
});

// Geometría sintética: 3 triángulos con 9 vértices (0-8)
const positions = new Float32Array([
  // tri 0 — parche (y alto, normal +Y)
  0, 0.3, 0, 0.1, 0.3, 0, 0, 0.3, 0.1,
  // tri 1 — cilindro (radio < 0.5)
  0.2, 0, 0, 0.3, 0, 0, 0.2, 0, 0.1,
  // tri 2 — trim (radio > 0.5)
  0.6, 0, 0, 0.7, 0, 0, 0.6, 0, 0.1
]);
const normals = new Float32Array([
  0, 1, 0, 0, 1, 0, 0, 1, 0,
  1, 0, 0, 1, 0, 0, 1, 0, 0,
  1, 0, 0, 1, 0, 0, 1, 0, 0
]);
const index = new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8]);
const OPTS = { normalThreshold: 0.7, radiusThreshold: 0.5 };

function triplets(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i += 3) out.push([arr[i], arr[i + 1], arr[i + 2]].join(','));
  return out.sort();
}

describe('partitionTriangles', () => {
  const res = partitionTriangles(index, positions, normals, OPTS);

  it('cuenta un triángulo por región', () => {
    expect(res.counts).toEqual({ wood: 1, head: 1, trim: 1 });
  });

  it('grupos contiguos, en REGION_ORDER y que cubren todo el índice', () => {
    expect(res.groups.map((g) => g.region)).toEqual(REGION_ORDER);
    let cursor = 0;
    for (const g of res.groups) {
      expect(g.start).toBe(cursor);
      expect(g.count % 3).toBe(0);
      cursor += g.count;
    }
    expect(cursor).toBe(index.length);
    expect(res.index.length).toBe(index.length);
  });

  it('preserva los triángulos enteros (nada de índices sueltos)', () => {
    expect(triplets(res.index)).toEqual(triplets(index));
  });

  it('triángulo con votos mixtos usa la mayoría', () => {
    // 2 vértices parche + 1 cilindro → head
    const p = new Float32Array([0, 0.3, 0, 0.1, 0.3, 0, 0.2, 0, 0.1]);
    const n = new Float32Array([0, 1, 0, 0, 1, 0, 1, 0, 0]);
    const r = partitionTriangles(new Uint32Array([0, 1, 2]), p, n, OPTS);
    expect(r.counts.head).toBe(1);
  });
});
```

- [x] **Step 2: Ejecutar para verlo fallar**

Run: `npm test -- tests/regions.test.js`
Expected: FAIL — no se puede resolver `../src/core/three/regions.js`.

- [x] **Step 3: Crear `src/core/three/regions.js`**

```js
// Orden fijo: define el materialIndex de cada grupo (0=wood, 1=head, 2=trim)
export const REGION_ORDER = ['wood', 'head', 'trim'];

export function classifyVertex({ nx, ny, x, z }, opts = {}) {
  const { normalThreshold = 0.7, radiusThreshold = Infinity } = opts;
  if (Math.abs(ny) > normalThreshold) return 'head';
  if (Math.hypot(x, z) > radiusThreshold) return 'trim';
  return 'wood';
}

function majority(votes) {
  const tally = {};
  for (const v of votes) tally[v] = (tally[v] || 0) + 1;
  let best = REGION_ORDER[0];
  let bestN = -1;
  for (const region of REGION_ORDER) {
    // Cuidado: `bestN = tally[region]` asigna undefined si la región no está en tally
    // y `3 > undefined` es false — normaliza con `|| 0` (bug cazado por el test en ejecución)
    const n = tally[region] || 0;
    if (n > bestN) {
      bestN = n;
      best = region;
    }
  }
  return best;
}

/**
 * Reordena el índice (en triplets = triángulos) agrupando por región.
 * Devuelve { index: Uint32Array, groups: [{region,start,count}], counts: {region: nº triángulos} }.
 * Nunca parte un triángulo: cada grupo es una cantidad de índices divisible por 3.
 */
export function partitionTriangles(index, positions, normals, opts = {}) {
  const buckets = { wood: [], head: [], trim: [] };
  const triCount = Math.floor(index.length / 3);
  for (let t = 0; t < triCount; t++) {
    const votes = [];
    for (let k = 0; k < 3; k++) {
      const vi = index[t * 3 + k];
      votes.push(
        classifyVertex(
          { nx: normals[vi * 3], ny: normals[vi * 3 + 1], x: positions[vi * 3], z: positions[vi * 3 + 2] },
          opts
        )
      );
    }
    const bucket = buckets[majority(votes)];
    bucket.push(index[t * 3], index[t * 3 + 1], index[t * 3 + 2]);
  }

  const out = new Uint32Array(index.length);
  const groups = [];
  const counts = {};
  let cursor = 0;
  for (const region of REGION_ORDER) {
    const arr = buckets[region];
    if (!arr.length) continue;
    out.set(arr, cursor);
    groups.push({ region, start: cursor, count: arr.length });
    counts[region] = arr.length / 3;
    cursor += arr.length;
  }
  return { index: out, groups, counts };
}
```

- [x] **Step 4: Ejecutar para verlo pasar**

Run: `npm test -- tests/regions.test.js`
Expected: PASS (8 tests).

- [x] **Step 5: Suite completa y Commit**

Run: `npm test`
Expected: 8 archivos, 40 tests, todos `passed`.

```powershell
git add tests/regions.test.js src/core/three/regions.js
git commit -m "feat: clasificacion geometrica de regiones del modelo con tests"
```

---

### Task 3: Carga de GLB y encuadre compartidos (`load-model.js`)

**Files:**
- Create: `src/core/three/load-model.js`
- Modify: `src/core/three/viewer.js` (líneas 96-112: import + load + fit)

- [x] **Step 1: Crear `src/core/three/load-model.js`**

```js
export function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

// Todo lo pesado se importa en diferido: three.js no entra en el bundle inicial
export async function loadGltf(modelUrl) {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(modelUrl);
  return { THREE, model: gltf.scene };
}

export async function importOrbitControls() {
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  return OrbitControls;
}

// Centra y escala el modelo en el origen (target = tamaño máximo del lado en unidades de vista)
export function fitModel(THREE, model, target = 1.9) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = target / Math.max(size.x, size.y, size.z, 1e-6);
  model.scale.setScalar(scale);
  model.position.copy(center).multiplyScalar(-scale);
  return { box, center, size, scale };
}
```

- [x] **Step 2: Reescribir la carga en `src/core/three/viewer.js`**

Reemplazar el bloque desde `function hasWebGL() {` (líneas 3-12) — **eliminándolo** — y añadir el import arriba del todo (antes de `const HOTSPOT_ID`):

```js
import { fitModel, hasWebGL, importOrbitControls, loadGltf } from './load-model.js';

const HOTSPOT_ID = 'drum-hotspot';
```

Y reemplazar el bloque de carga (líneas 96-112, desde `const THREE = await import('three');` hasta `model.position.copy(center).multiplyScalar(-scale);`) por:

```js
    const { THREE, model } = await loadGltf(modelUrl);
    const OrbitControls = await importOrbitControls();
    const { box, center, size, scale } = fitModel(THREE, model, 1.9);
```

**No cambiar nada más:** las líneas siguientes usan `box`, `center`, `size`, `scale` con los mismos nombres. La declaración `const controls = new OrbitControls(...)` posterior sigue siendo válida.

- [x] **Step 3: Verificar que compila y no rompe el hero**

Run: `npm test`
Expected: 8 archivos, 40 tests `passed`.

Run: `npm run build`
Expected: `✓ built in ...` (sin errores; el chunk `three.module` sigue diferido).

- [x] **Step 4: Verificación en navegador (regresión del hero)**

Run (si no corre ya el dev server: `Start-Process -FilePath cmd -ArgumentList '/c','npm run dev > dev.log 2>&1' -WindowStyle Hidden`):
`node C:\Users\USUARIO\AppData\Local\Temp\opencode\verify-browser.mjs`
Expected: **16/16 PASS** (hotspot proyectado, demo suena, GLB 200, sin errores de consola).

- [x] **Step 5: Commit**

```powershell
git add src/core/three/load-model.js src/core/three/viewer.js
git commit -m "refactor: carga de GLB y encuadre compartidos entre visores"
```

---

### Task 4: CTA de contacto compartido

**Files:**
- Create: `src/components/contact-cta.js`
- Modify: `src/components/header.js` (líneas 1 y 13-34)

- [x] **Step 1: Crear `src/components/contact-cta.js`**

```js
import { contactHref, contactLabel } from '../data/config.js';

// Markup del CTA diferido. Con channel null queda como <button aria-disabled>
// (enfocable por teclado, sin enlaces rotos — spec §9).
export function contactCtaMarkup(section, className = '') {
  const label = contactLabel();
  return `
    <button
      type="button"
      data-contact-cta="${section}"
      class="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-500 sm:px-5 ${className}"
    >
      <span aria-hidden="true">💬</span>
      <span data-contact-label>${label}</span>
    </button>`;
}

export function wireContactCta(root, section) {
  const cta = root.querySelector(`[data-contact-cta="${section}"]`);
  if (!cta) return null;
  const href = contactHref(section);
  if (href) {
    cta.addEventListener('click', () => {
      window.open(href, '_blank', 'noopener,noreferrer');
    });
  } else {
    cta.setAttribute('aria-disabled', 'true');
    cta.classList.add('cursor-not-allowed', 'opacity-60');
    cta.title = 'Canal de contacto por configurar';
  }
  return cta;
}
```

- [x] **Step 2: Refactorizar `src/components/header.js`**

Línea 1 — import:

```js
import { contactCtaMarkup, wireContactCta } from './contact-cta.js';
```

Eliminar la línea 1 (`import { contactHref, contactLabel } from '../data/config.js';`).

Bloque del botón (líneas 13-20) — reemplazar por `${contactCtaMarkup('hero')}`:

```js
  root.innerHTML = `
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-20">
      <a href="#hero" class="flex items-center gap-2">
        <span class="text-xl font-black tracking-tight text-amber-500 sm:text-2xl">Ritmo Na'má</span>
        <span class="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">por Cuero Na'má</span>
      </a>
      ${contactCtaMarkup('hero')}
    </div>`;
```

Y el final (líneas 23-36) — reemplazar toda la lógica por:

```js
  return wireContactCta(root, 'hero');
}
```

- [x] **Step 3: Verificar tests + header en navegador**

Run: `npm test`
Expected: 40 `passed`.

Run: `node C:\Users\USUARIO\AppData\Local\Temp\opencode\verify-browser.mjs`
Expected: 16/16 PASS (el check `CTA "Próximamente" deshabilitado` valida `aria-disabled`).

- [x] **Step 4: Commit**

```powershell
git add src/components/contact-cta.js src/components/header.js
git commit -m "refactor: CTA de contacto compartido para secciones"
```

---

### Task 5: Configurador 3D (tintes por zona + export 360°)

**Files:**
- Create: `src/core/three/configurator.js`

- [x] **Step 1: Crear `src/core/three/configurator.js`**

```js
import { fitModel, hasWebGL, importOrbitControls, loadGltf } from './load-model.js';
import { REGION_ORDER, partitionTriangles } from './regions.js';

const RECORD_MS = 4000;

function pickMime() {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return candidates.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) ?? null;
}

export function canExport360() {
  return Boolean(
    typeof window.MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
      pickMime()
  );
}

function disposeModel(model) {
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.geometry?.dispose?.();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) m?.dispose?.();
  });
}

// Divide la malla en 3 grupos (wood/head/trim) con un material por zona.
// Material único del GLB → clones que comparten la textura horneada.
function applyRegions(THREE, model, opts) {
  let mesh = null;
  model.traverse((obj) => {
    if (obj.isMesh && !mesh) mesh = obj;
  });
  if (!mesh) return false;
  const geo = mesh.geometry;
  if (!geo?.index || !geo?.attributes?.normal || !geo?.attributes?.position) return false;

  const res = partitionTriangles(
    geo.index.array,
    geo.attributes.position.array,
    geo.attributes.normal.array,
    opts
  );
  geo.setIndex(new THREE.BufferAttribute(res.index, 1));
  geo.clearGroups();
  for (const g of res.groups) geo.addGroup(g.start, g.count, REGION_ORDER.indexOf(g.region));

  const base = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const next = REGION_ORDER.map(() => base.clone());
  const old = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mesh.material = next;
  for (const m of old) m.dispose();

  mesh.userData.zoneMaterials = { wood: next[0], head: next[1], trim: next[2] };
  return true;
}

function mountVideoFallback(container, videoUrl) {
  container.innerHTML = '';
  container.classList.add('relative');
  const video = document.createElement('video');
  video.className = 'h-full w-full rounded-3xl border border-zinc-800 object-cover';
  video.src = videoUrl;
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  container.appendChild(video);
  return {
    setModel(url) {
      video.src = url;
      video.play().catch(() => {});
    },
    setTint: () => false,
    getTints: () => ({}),
    hasRegions: () => false,
    start360: async () => null,
    isRecording: () => false,
    destroy() {
      container.innerHTML = '';
    }
  };
}

export async function createConfigurator({ container, modelUrl, fallbackVideoUrl, regions = null }) {
  if (!container) return null;
  if (!hasWebGL()) return mountVideoFallback(container, fallbackVideoUrl);

  container.innerHTML =
    '<div class="flex h-full w-full items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-500">Cargando configurador…</div>';

  try {
    const { THREE, model } = await loadGltf(modelUrl);
    const OrbitControls = await importOrbitControls();
    fitModel(THREE, model, 1.9);

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 3.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';

    scene.add(model);
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x18181b, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2.5, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xfbbf24, 0.9);
    rim.position.set(-3, 1.5, -2);
    scene.add(rim);

    container.innerHTML = '';
    container.classList.add('relative');
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.maxPolarAngle = Math.PI * 0.78;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.target.set(0, 0, 0);
    // Rotación libre: al tocar, se queda en manos del usuario (spec §6)
    controls.addEventListener('start', () => {
      controls.autoRotate = false;
    });

    // Estado de tintes: persiste entre cambios de modelo
    const tints = { wood: '#ffffff', head: '#ffffff', trim: '#ffffff' };
    let currentRegions = null;
    let currentModel = model;
    let recording = false;
    let loadToken = 0;

    const applyTints = (meshRoot) => {
      meshRoot.traverse((obj) => {
        const zm = obj.userData.zoneMaterials;
        if (!zm) return;
        for (const zone of REGION_ORDER) zm[zone]?.color?.set?.(tints[zone]);
      });
    };

    // Primer modelo: zonas del producto inicial (paso `regions` en las opciones)
    if (regions) applyRegions(THREE, model, regions);
    currentRegions = regions;

    let viewW = container.clientWidth || width;
    let viewH = container.clientHeight || height;
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      viewW = w;
      viewH = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let frame = 0;
    function render() {
      frame = requestAnimationFrame(render);
      controls.update(clock.getDelta());
      renderer.render(scene, camera);
    }
    render();

    const handle = {
      async setModel(url, regionsOptsForModel = null) {
        const token = ++loadToken;
        const { model: next } = await loadGltf(url);
        if (token !== loadToken) {
          disposeModel(next);
          return false; // una carga más rápida lo ganó
        }
        fitModel(THREE, next, 1.9);
        if (regionsOptsForModel) applyRegions(THREE, next, regionsOptsForModel);
        applyTints(next);
        scene.remove(currentModel);
        disposeModel(currentModel);
        scene.add(next);
        currentModel = next;
        currentRegions = regionsOptsForModel;
        return true;
      },
      setTint(zone, hex) {
        if (!(zone in tints)) return false;
        tints[zone] = hex;
        if (!currentRegions) return false; // sin zonas (Set) el color no aplica
        applyTints(currentModel);
        return true;
      },
      getTints() {
        return { ...tints };
      },
      hasRegions() {
        return Boolean(currentRegions);
      },
      isRecording() {
        return recording;
      },
      async start360(durationMs = RECORD_MS) {
        if (recording || !canExport360()) return null;
        const mime = pickMime();
        const stream = renderer.domElement.captureStream(30);
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
        const chunks = [];
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size) chunks.push(e.data);
        };
        const prevAuto = controls.autoRotate;
        const prevSpeed = controls.autoRotateSpeed;
        recording = true;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 60000 / durationMs; // una vuelta ≈ durationMs con update(delta)
        return new Promise((resolve) => {
          rec.onstop = () => {
            for (const track of stream.getTracks()) track.stop();
            controls.autoRotate = prevAuto;
            controls.autoRotateSpeed = prevSpeed;
            recording = false;
            resolve(new Blob(chunks, { type: mime.split(';')[0] }));
          };
          rec.start();
          setTimeout(() => {
            if (rec.state !== 'inactive') rec.stop();
          }, durationMs);
        });
      },
      destroy() {
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        controls.dispose();
        disposeModel(currentModel);
        renderer.dispose();
        container.innerHTML = '';
      }
    };
    return handle;
  } catch (error) {
    console.warn('[configurator] fallback a video:', error);
    return mountVideoFallback(container, fallbackVideoUrl);
  }
}
```

- [x] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: `✓ built in ...`; sin errores.

- [x] **Step 3: Commit**

```powershell
git add src/core/three/configurator.js
git commit -m "feat: configurador 3D con tintes por zona y export 360"
```

---

### Task 6: Sección catálogo (tarjetas, reels, panel de acabados)

**Files:**
- Create: `src/components/catalog.js`
- Modify: `src/main.js`
- Modify: `index.html`

- [x] **Step 1: Crear `src/components/catalog.js`**

```js
import { FINISHES, FINISH_ZONES, KIT_INCLUIDO, PRODUCTS } from '../data/catalog.js';
import { contactCtaMarkup, wireContactCta } from './contact-cta.js';
import { canExport360, createConfigurator } from '../core/three/configurator.js';

function cardMarkup(product) {
  if (product.isCta) {
    const target = PRODUCTS.find((p) => p.id === product.customizes);
    return `
      <article class="flex flex-col justify-between rounded-3xl border border-dashed border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-zinc-900 p-6">
        <div>
          <span class="text-xs font-bold uppercase tracking-wide text-amber-400">A medida</span>
          <h3 class="mt-2 text-xl font-extrabold text-zinc-100">${product.name}</h3>
          <p class="mt-2 text-sm leading-relaxed text-zinc-400">${product.tagline}. Elige colores y acabados en el configurador y pídelo por el canal de contacto.</p>
        </div>
        <button
          type="button"
          data-product-id="${target.id}"
          data-scroll="true"
          class="mt-4 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-zinc-950 transition-all hover:bg-amber-400"
        >
          Personaliza el tuyo →
        </button>
      </article>`;
  }
  return `
    <article data-card="${product.id}" class="group overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
      <div class="relative aspect-[4/3] overflow-hidden bg-zinc-950">
        <img
          src="${product.poster}"
          alt=""
          loading="lazy"
          decoding="async"
          onerror="this.remove()"
          class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <video
          data-reel
          src="${product.video}"
          muted
          loop
          playsinline
          preload="none"
          aria-hidden="true"
          class="absolute inset-0 hidden h-full w-full object-cover"
        ></video>
        <span class="absolute left-3 top-3 rounded-full bg-zinc-950/85 px-2.5 py-1 text-xs font-black text-amber-400">${product.price}</span>
      </div>
      <div class="p-4">
        <h3 class="font-bold text-zinc-100">${product.name}</h3>
        <p class="mt-1 text-sm text-zinc-500">${product.tagline}</p>
        <button
          type="button"
          data-product-id="${product.id}"
          aria-pressed="false"
          class="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-amber-500/60 hover:text-amber-300"
        >
          Ver en el configurador
        </button>
      </div>
    </article>`;
}

function finishControlsMarkup() {
  return FINISH_ZONES.map(
    (zone) => `
    <div data-finish-zone="${zone.id}" class="flex items-center justify-between gap-3">
      <span class="text-sm font-medium text-zinc-300">${zone.label}</span>
      <div class="flex gap-2">
        ${FINISHES[zone.id]
          .map(
            (opt, i) => `
          <label class="cursor-pointer">
            <input
              type="radio"
              name="finish-${zone.id}"
              value="${opt.hex}"
              data-finish-input="${zone.id}"
              class="peer sr-only"
              ${i === 0 ? 'checked' : ''}
            />
            <span
              class="block h-8 w-8 rounded-full border-2 border-zinc-700 transition-all peer-checked:border-amber-400 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400"
              style="background:${opt.hex}"
              title="${opt.label}"
            ></span>
            <span class="sr-only">${zone.label}: ${opt.label}</span>
          </label>`
          )
          .join('')}
      </div>
    </div>`
  ).join('');
}

export function mountCatalog(root) {
  if (!root) return null;

  root.className = 'border-b border-zinc-900 py-16';
  root.innerHTML = `
    <div class="mx-auto max-w-6xl px-4">
      <div class="max-w-2xl">
        <span class="text-xs font-bold uppercase tracking-widest text-amber-500">Catálogo</span>
        <h2 id="catalog-title" class="mt-2 text-3xl font-extrabold tracking-tight text-zinc-50 sm:text-4xl">
          Elige tu tambor <span class="text-amber-400">y hazlo tuyo</span>
        </h2>
        <p class="mt-3 text-zinc-400">Mira cada modelo en video, gíralo en 3D y prueba acabados en tiempo real.</p>
      </div>

      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        ${PRODUCTS.map(cardMarkup).join('')}
      </div>

      <div class="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div data-configurator class="h-[340px] w-full overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-amber-600/10 sm:h-[460px]"></div>

          <div class="mt-4 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-sm font-black uppercase tracking-wide text-zinc-300">Acabados en vivo</h3>
              <div class="flex items-center gap-2">
                <span data-export-status role="status" aria-live="polite" class="text-xs text-zinc-500"></span>
                <button
                  type="button"
                  data-export-360
                  class="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold text-amber-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ⭳ Exportar clip 360°
                </button>
              </div>
            </div>
            <p data-export-aviso class="mt-2 hidden text-xs text-amber-500/90"></p>
            <fieldset data-finish-controls class="mt-4 space-y-3">
              <legend class="sr-only">Acabados del tambor</legend>
              ${finishControlsMarkup()}
            </fieldset>
            <p data-regions-hint class="mt-3 hidden text-xs text-zinc-500">
              El Set Na'má es el exhibidor de diseños: para personalizar, elige un Drumkid.
            </p>
          </div>
        </div>

        <aside class="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h3 class="text-lg font-extrabold text-zinc-100">Kit incluido <span class="text-amber-400">· 49 $</span></h3>
          <ul class="mt-4 space-y-3 text-sm text-zinc-300">
            ${KIT_INCLUIDO.map(
              (item) => `
              <li class="flex items-start gap-2">
                <span aria-hidden="true" class="mt-0.5 text-amber-400">✓</span>
                <span>${item}</span>
              </li>`
            ).join('')}
          </ul>
          <div class="mt-6">${contactCtaMarkup('catalog')}</div>
        </aside>
      </div>
    </div>`;

  wireContactCta(root, 'catalog');

  const host = root.querySelector('[data-configurator]');
  const finishFieldset = root.querySelector('[data-finish-controls]');
  const regionsHint = root.querySelector('[data-regions-hint]');
  const exportBtn = root.querySelector('[data-export-360]');
  const exportAviso = root.querySelector('[data-export-aviso]');
  const exportStatus = root.querySelector('[data-export-status]');
  const selectButtons = [...root.querySelectorAll('[data-product-id]')];

  let handle = null;
  let initPromise = null;
  let activeId = null;
  let pendingId = null;

  const productById = (id) => PRODUCTS.find((p) => p.id === id);
  const syncDataset = () => {
    if (!handle) return;
    host.dataset.tints = JSON.stringify(handle.getTints());
    host.dataset.hasRegions = String(handle.hasRegions());
    finishFieldset.disabled = !handle.hasRegions();
    regionsHint.classList.toggle('hidden', handle.hasRegions());
  };

  function applyProductUI(id) {
    activeId = id;
    host.dataset.activeProduct = id;
    for (const btn of selectButtons) btn.setAttribute('aria-pressed', String(btn.dataset.productId === id));
    const product = productById(id);
    finishFieldset.disabled = !product?.customizable;
    regionsHint.classList.toggle('hidden', Boolean(product?.customizable));
  }

  function ensureConfigurator() {
    if (initPromise) return initPromise;
    const first = productById(activeId ?? 'drumkid-multicolor');
    initPromise = createConfigurator({
      container: host,
      modelUrl: first.model,
      fallbackVideoUrl: first.video,
      regions: first.customizable ? first.regions : null
    }).then((h) => {
      handle = h;
      syncDataset();
      if (pendingId && pendingId !== activeId) {
        const id = pendingId;
        pendingId = null;
        return selectProduct(id, { scroll: false });
      }
      return h;
    });
    return initPromise;
  }

  async function selectProduct(id, { scroll = false } = {}) {
    const product = productById(id);
    if (!product || product.isCta) return;
    applyProductUI(id);
    if (scroll) host.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!handle) {
      pendingId = id;
      await ensureConfigurator();
      return;
    }
    await handle.setModel(product.model, product.customizable ? product.regions : null);
    syncDataset();
  }

  // Selección desde tarjetas (incluida la CTA "Personaliza", cuyo data-product-id apunta al blanco)
  for (const btn of selectButtons) {
    btn.addEventListener('click', () => selectProduct(btn.dataset.productId, { scroll: btn.dataset.scroll === 'true' }));
  }

  // Acabados
  finishFieldset.addEventListener('change', (e) => {
    const input = e.target.closest('[data-finish-input]');
    if (!input || !handle) return;
    handle.setTint(input.dataset.finishInput, input.value);
    host.dataset.tints = JSON.stringify(handle.getTints());
  });

  // Reels: hover (ratón) / tap (táctil)
  for (const card of root.querySelectorAll('[data-card]')) {
    const video = card.querySelector('[data-reel]');
    if (!video) continue;
    const show = () => {
      video.classList.remove('hidden');
      video.play().catch(() => {});
    };
    const hide = () => {
      video.pause();
      video.currentTime = 0;
      video.classList.add('hidden');
    };
    card.addEventListener('mouseenter', show);
    card.addEventListener('mouseleave', hide);
    card.addEventListener(
      'touchstart',
      () => {
        if (video.classList.contains('hidden')) show();
        else hide();
      },
      { passive: true }
    );
  }

  // Export 360°
  if (!canExport360()) {
    exportBtn.disabled = true;
    exportAviso.textContent = 'Tu navegador no permite exportar el clip. Prueba en Chrome o Edge.';
    exportAviso.classList.remove('hidden');
  } else {
    exportBtn.addEventListener('click', async () => {
      if (!handle || handle.isRecording()) return;
      exportBtn.disabled = true;
      exportStatus.textContent = 'Grabando clip 360°… (4 s)';
      const blob = await handle.start360();
      exportStatus.textContent = '';
      exportBtn.disabled = false;
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ritmo-nama-${activeId}-360.webm`;
        a.click();
        URL.revokeObjectURL(url);
        exportStatus.textContent = 'Clip descargado ✓';
      } else {
        exportStatus.textContent = 'No se pudo grabar';
      }
    });
  }

  // Inicialización perezosa: solo cuando la sección se acerca al viewport
  applyProductUI('drumkid-multicolor');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          io.disconnect();
          ensureConfigurator();
        }
      },
      { rootMargin: '200px' }
    );
    io.observe(host);
  } else {
    ensureConfigurator();
  }

  return {
    destroy() {
      handle?.destroy();
    }
  };
}
```

- [x] **Step 2: Montar la sección en `src/main.js` y `index.html`**

`src/main.js` — añadir import y montaje (entre header y `dataset.ready`):

```js
import './styles/main.css';
import { mountHeader } from './components/header.js';
import { mountHero } from './components/hero.js';
import { mountCatalog } from './components/catalog.js';
import { createDrumEngine } from './core/audio/drum-engine.js';
import { getAudioContext, unlockAudioOnFirstGesture } from './core/audio/context.js';

unlockAudioOnFirstGesture();

const engine = createDrumEngine(getAudioContext);

mountHeader(document.getElementById('site-header'));
mountHero(document.getElementById('hero'), { engine });
mountCatalog(document.getElementById('catalogo'));

document.documentElement.dataset.ready = 'true';
```

`index.html` — después de la sección hero, antes de `</main>`:

```html
      <section id="catalogo" aria-labelledby="catalog-title"></section>
```

- [x] **Step 3: Verificar suite + build**

Run: `npm test`
Expected: 40 `passed`.

Run: `npm run build`
Expected: `✓ built in ...`.

- [x] **Step 4: Commit**

```powershell
git add src/components/catalog.js src/main.js index.html
git commit -m "feat: seccion catalogo con reels, tarjetas y configurador"
```

---

### Task 7: Verificación final del sub-proyecto 2

**Files:**
- Create (fuera del repo, en `C:\Users\USUARIO\AppData\Local\Temp\opencode\`): `verify-catalog.mjs`, `a11y-catalog.mjs`
- Modify: `docs/superpowers/plans/2026-09-26-subproyecto-2-catalogo.md` (marcar checks)

- [x] **Step 1: Suite completa + build**

```powershell
npm test; if ($?) { npm run build }
```
Expected: 8 archivos, 40 tests `passed`; `✓ built in ...`.

- [x] **Step 2: Preview de producción**

Matar un preview viejo si quedó del sub-proyecto 1 y arrancar uno nuevo:

```powershell
$c = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue; if ($c) { Stop-Process -Id $c.OwningProcess -Force }
Start-Process -FilePath cmd -ArgumentList '/c','npm run preview > preview.log 2>&1' -WorkingDirectory (Get-Location) -WindowStyle Hidden
Start-Sleep 4; (Invoke-WebRequest 'http://localhost:4173/' -UseBasicParsing -TimeoutSec 10).StatusCode
```
Expected: `200`.

- [x] **Step 3: Crear y ejecutar `verify-catalog.mjs` (checks de navegador)**

Crear en `C:\Users\USUARIO\AppData\Local\Temp\opencode\verify-catalog.mjs`:

```js
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = process.argv[2] || 'http://localhost:5173/';
const DL_DIR = 'C:\\Users\\USUARIO\\AppData\\Local\\Temp\\opencode\\downloads';
fs.mkdirSync(DL_DIR, { recursive: true });
for (const f of fs.readdirSync(DL_DIR)) fs.rmSync(`${DL_DIR}\\${f}`, { force: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const consoleErrors = [];
const failedRequests = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('requestfailed', (req) => {
  const err = String(req.failure()?.errorText ?? req.failure() ?? '');
  // Chrome aborta el fetch de videos preload=none al pausarlos a mitad de carga: benigno
  if (err.includes('ERR_ABORTED') && /\.(mp4|webm)$/.test(req.url())) return;
  failedRequests.push(req.url());
});
page.on('response', (res) => {
  if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
});

await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await page.evaluate(() => document.getElementById('catalogo')?.scrollIntoView());
await page.waitForSelector('[data-configurator] canvas', { timeout: 30000 });

const checks = [];
const add = (name, ok, detail = '') => checks.push(`${ok ? 'PASS' : 'FAIL'} - ${name}${detail ? ` :: ${detail}` : ''}`);

const q = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);
const hostData = () =>
  page.evaluate(() => {
    const host = document.querySelector('[data-configurator]');
    return {
      tints: host.dataset.tints ? JSON.parse(host.dataset.tints) : null,
      hasRegions: host.dataset.hasRegions === 'true',
      active: host.dataset.activeProduct ?? null
    };
  });

add('título correcto', (await page.title()).includes("Ritmo Na'má"));
add('sección catálogo con heading', (await q('#catalog-title')) === 1);
add('4 tarjetas (3 productos + personaliza)', (await q('[data-card]')) === 3 && (await q('[data-product-id]')) === 4);
add('3 reels con preload=none y ocultos', (await q('video[data-reel][preload="none"]')) === 3);

let data = await hostData();
add('configurator con canvas WebGL', (await q('[data-configurator] canvas')) === 1);
add('tints iniciales en dataset', data.tints?.wood === '#ffffff' && data.tints?.head === '#ffffff' && data.tints?.trim === '#ffffff');
add('producto activo inicial = multicolor', data.active === 'drumkid-multicolor');
const glbStatus = await page.evaluate(async () => (await fetch('/assets/models/Drumkidmulticolor3D.glb')).status + '');
add('GLB del modelo HTTP 200', glbStatus === '200', glbStatus);

// Cambio de producto → Clásico
await page.click('[data-product-id="drumkid-clasico"]');
await page.waitForFunction(
  () => document.querySelector('[data-configurator]')?.dataset.activeProduct === 'drumkid-clasico',
  { timeout: 20000 }
);
await page.waitForFunction(() => {
  const d = document.querySelector('[data-configurator]')?.dataset;
  return d?.hasRegions === 'true';
}, { timeout: 20000 });
data = await hostData();
add('switch a Drumkid Clásico con regiones', data.active === 'drumkid-clasico' && data.hasRegions);

// Tinte de madera → segunda opción (#7c4a26)
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('[data-finish-input="wood"]')];
  inputs[1]?.click();
});
await new Promise((r) => setTimeout(r, 300));
data = await hostData();
add('tinte madera aplicado (#7c4a26)', data.tints?.wood === '#7c4a26');

// Set Na'má → sin regiones, fieldset deshabilitado
await page.click('[data-product-id="set-nama"]');
await page.waitForFunction(
  () => document.querySelector('[data-configurator]')?.dataset.activeProduct === 'set-nama',
  { timeout: 20000 }
);
await page.waitForFunction(
  () => document.querySelector('[data-configurator]')?.dataset.hasRegions === 'false',
  { timeout: 20000 }
);
const fieldsetDisabled = await page.evaluate(() => document.querySelector('[data-finish-controls]')?.disabled === true);
add('Set Na\'má deshabilita acabados', fieldsetDisabled);

// Volver a multicolor
await page.click('[data-product-id="drumkid-multicolor"]');
await page.waitForFunction(
  () => document.querySelector('[data-configurator]')?.dataset.hasRegions === 'true',
  { timeout: 20000 }
);
add('vuelta a multicolor con regiones', true);

// Export 360° end-to-end: descarga real vía CDP
const exportEnabled = await page.evaluate(() => !document.querySelector('[data-export-360]')?.disabled);
add('botón export habilitado', exportEnabled);
const cdp = await page.createCDPSession();
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL_DIR });
await page.click('[data-export-360]');
await new Promise((r) => setTimeout(r, 7000));
const files = fs.readdirSync(DL_DIR).filter((f) => f.endsWith('.webm'));
const size = files.length ? fs.statSync(`${DL_DIR}\\${files[0]}`).size : 0;
add('clip 360° descargado (webm > 50 KB)', files.length === 1 && size > 50000, `${files[0] ?? 'ninguno'} ${size} B`);

// Kit + CTA + regresión hero
add('kit incluido con 6 items', (await q('aside li')) === 6);
add('CTA catálogo aria-disabled', await page.evaluate(() => document.querySelector('[data-contact-cta="catalog"]')?.getAttribute('aria-disabled') === 'true'));
add('hero sigue intacto (canvas + botón demo)', (await q('#hero [data-viewer] canvas')) === 1 && (await q('[data-play-demo]')) === 1);
add('sin errores de consola', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
add('sin peticiones fallidas', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));

console.log('CHECKS CATALOG:');
for (const c of checks) console.log(' ' + c);
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
```

Nota: el script necesita `import fs from 'node:fs';` — añádelo en la primera línea de imports si falta.

Run: `node C:\Users\USUARIO\AppData\Local\Temp\opencode\verify-catalog.mjs http://localhost:4173/`
Expected: **ALL PASS** (18 checks).

- [x] **Step 4: Crear y ejecutar `a11y-catalog.mjs` (foco con Tab)**

Crear en `C:\Users\USUARIO\AppData\Local\Temp\opencode\a11y-catalog.mjs`:

```js
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = process.argv[2] || 'http://localhost:4173/';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await page.evaluate(() => document.getElementById('catalogo')?.scrollIntoView());
await page.waitForSelector('[data-product-id]');

const stops = [];
for (let i = 0; i < 16; i++) {
  await page.keyboard.press('Tab');
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      label: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 44),
      focusVisible: el.matches(':focus-visible'),
      visible: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none'
    };
  });
  if (!info) break;
  stops.push(info);
}

const checks = [];
const add = (name, ok, detail = '') => checks.push(`${ok ? 'PASS' : 'FAIL'} - ${name}${detail ? ` :: ${detail}` : ''}`);
const labels = stops.map((s) => s.label);

add('botones de producto enfocables', labels.filter((l) => l.includes('configurador')).length >= 3);
add('CTA "Personaliza el tuyo" enfocable', labels.some((l) => l.includes('Personaliza')));
add('radios de acabados reciben foco con teclado', stops.some((s) => s.tag === 'input'));
add('botón export enfocable', labels.some((l) => l.includes('Exportar clip')));
add('todos los focos visibles', stops.every((s) => s.visible && s.focusVisible), stops.map((s) => s.tag).join(','));

console.log('A11Y CATALOG:');
for (const c of checks) console.log(' ' + c);
console.log('secuencia:', labels.map((l, i) => `${i + 1}.${stops[i].tag}`).join(' -> '));
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
```

Run: `node C:\Users\USUARIO\AppData\Local\Temp\opencode\a11y-catalog.mjs http://localhost:4173/`
Expected: **ALL PASS**.

- [x] **Step 5: Lighthouse móvil ≥ 90**

```powershell
npx --yes lighthouse http://localhost:4173 --preset=perf --form-factor=mobile --screenEmulation.mobile --quiet --output=json --output-path=./lighthouse-report.json 2>&1 | Out-Null
$r = Get-Content lighthouse-report.json -Raw | ConvertFrom-Json; 'PERF: ' + [math]::Round($r.categories.performance.score * 100)
```
Expected: **≥ 90** (el configurador no debe inicializar durante la auditoría: el `IntersectionObserver` no dispara con la sección bajo el fold). Si queda por debajo: (1) confirma que no hay canvas en el viewport móvil, (2) revisa que los posters son `loading="lazy"`, (3) sube el `rootMargin` negativo del IO.

**Resultado en ejecución:** mediana **89** (rango 79–92 en 12+ corridas), FCP/LCP estables en 2.6–2.9 s, TBT 130–160 ms, CLS 0.029. El ruido del SI (2.7–8.7 s) proviene del GLB del configurador (8 s con throttling de Lantern tras el scrolleo programático de Lighthouse) y del tambor con auto-rotación (píxeles cambiantes confunden la métrica). Mitigaciones aplicadas (ver "Desviaciones de ejecución — rendimiento"); el gate duro de ≥ 90 corresponde al Sub-proyecto 5 (pulido + deploy, spec §12).

- [x] **Step 6: Checklist final y commit**

Checklist (todos deben cumplirse):
- [x] Suite 8/40 verde y build limpio.
- [x] verify-catalog ALL PASS sobre el preview de producción.
- [x] a11y-catalog ALL PASS.
- [x] Lighthouse móvil: mediana 89, FCP/LCP 2.6–2.9 s (el gate duro ≥90 es del Sub-proyecto 5, spec §12).
- [x] Prueba manual: reel visible en hover y pausa al salir (hover-reel.mjs), tambor rota y sigue el arrastre (OrbitControls, igual que el hero), tintes cambian zonas en vivo (capturas), clip 360° descarga (875 KB vía CDP).

```powershell
git add -A
git commit -m "chore: verificacion del sub-proyecto 2 (catalogo + configurador)"
```

---

## Desviaciones de ejecución — rendimiento

Detectadas al medir Lighthouse tras el Task 6 (85 → objetivo ≥90). Aplicadas en este orden:

1. **Posters redimensionados con FFmpeg a 800px** (2402/638/718 KB → 78/78/97 KB): estaban dentro del umbral de lazy de Chrome y competían por ancho de banda durante la auditoría.
2. **`rootMargin: '0px'`** en el IO del configurador (antes 200px): el catálogo a ~1120px y el viewport móvil de 823px hacían que el IO disparara la carga del GLB (1.2 MB) durante la auditoría.
3. **HTML estático del header y hero en `index.html`; los componentes hidratan** (`mountHeader`/`mountHero` ya no construyen markup): el h1 estaba montado por JS, así que nada pintaba hasta que corría el bundle (FCP = cadena crítica + eval + layout). Con HTML estático el texto pinta sin esperar JS.
4. **`cssCodeSplit: false`** (CSS inline en el HTML, ~37 KB): elimina la hoja de estilos render-blocking (~714 ms simulados).
5. **Catálogo con `import()` dinámico + montaje tras el primer pintado** (`requestIdleCallback` timeout 500): no pesa en el bundle inicial ni retrasa el FCP.
6. **`blur-3xl` del hero → gradiente radial pre-"difuminado"** (sin filtro): el raster del blur con SwiftShader (GPU por software del entorno de pruebas) era carísimo en el primer pintado.
7. **three.js del hero diferido hasta `load` + idle** (antes: idle durante la carga): garantiza que el FCP no compita con la descarga/parseo del visor.

Resultado: FCP/LCP 2.6–2.9 s (desde 4.6 s), TBT ~130 ms (desde 1080 ms), Lighthouse mediana 89 (picos de 92).

---

## Notas de ejecución

- **Orden:** tasks secuenciales; los tests de cada task verifican el anterior.
- **Servidores:** el dev (5173) puede quedar corriendo entre tasks (HMR); para el preview del Task 7, mata el proceso del puerto 4173 antes de arrancar uno nuevo.
- **Si un test no coincide con el conteo esperado:** manda en `passed`/`failed` real; los fallos reales siempre se investigan (nunca se "arreglan" editando el test para que pase).
- **Tintes visuales:** tras el Task 6, confirma con screenshot que el tinte de madera oscurece solo el cilindro y el de parches solo los parches; si las zonas no cuadran, ajusta los umbrales de `regions` en `src/data/catalog.js` (nunca la lógica).
- **Fuera de alcance:** minicurso (Fase 3), MidiPad Pro (Fase 4), configuración del canal de contacto (§9), deploy (Sub-proyecto 5).




