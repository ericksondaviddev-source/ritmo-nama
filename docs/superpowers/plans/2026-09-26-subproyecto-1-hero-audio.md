# Sub-proyecto 1 — Scaffolding + DrumEngine + Header/Hero 3D

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montar la base del proyecto (Vite + Tailwind + tests), optimizar los modelos 3D, construir el motor de audio reutilizable (`drum-engine`) y publicar el Header + Hero con visor 3D y hotspot que reproduce la demo de fulia.

**Architecture:** Vite + JavaScript modular sin framework. El audio vive en `src/core/audio/*` con **inyección del `AudioContext`** (para testear con un fake), el 3D en `src/core/three/viewer.js` (import dinámico de three.js + fallback a video), y cada sección de la landing es un componente que monta DOM sobre su `<section>` de `index.html`.

**Tech Stack:** Vite, Tailwind CSS v4 (`@tailwindcss/vite`), three.js (`three/addons`: `GLTFLoader`, `OrbitControls`, `MeshoptDecoder`), Web Audio API, Vitest, `@gltf-transform/cli`.

**Spec:** `docs/superpowers/specs/2026-09-26-ritmo-nama-design.md`

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `package.json`, `vite.config.js`, `vitest.config.js`, `index.html` | Scaffolding, plugin Tailwind, shell de la página |
| `src/styles/main.css` | Import de Tailwind, tokens `@theme`, keyframes de animación de golpe |
| `src/main.js` | Bootstrap: desbloqueo de audio, montaje de header y hero |
| `src/data/config.js` | Canal de contacto (`whatsapp`/`telegram`/`null`), URL y label |
| `src/data/drums.js` | Datos de los 6 instrumentos |
| `src/data/patterns.js` | 4 patrones rítmicos de 12 pasos |
| `src/core/audio/context.js` | Singleton `AudioContext` + desbloqueo en primer gesto |
| `src/core/audio/voices.js` | Recetas de síntesis por golpe (datos puros) |
| `src/core/audio/noise.js` | Buffer de ruido cacheado por contexto |
| `src/core/audio/drum-engine.js` | Instancia el grafo de nodos de cada voz (`trigger`, `setMasterVolume`) |
| `src/core/audio/timing.js` | Cálculos puros: duración de paso, offset de swing |
| `src/core/audio/scheduler.js` | Lookahead scheduler (25 ms / 100 ms) sobre el reloj de AudioContext |
| `src/core/audio/demo.js` | Demo de fulia: reproduce un patrón N ciclos |
| `src/core/three/viewer.js` | Visor 3D: GLB, órbita, auto-rotación, hotspot proyectado, fallback video |
| `src/components/header.js` | Header sticky + CTA de contacto configurable |
| `src/components/hero.js` | Titular, visor, hotspot, botón "Escuchar la fulia" |
| `scripts/optimize-models.mjs` | Pipeline `gltf-transform` + copia de videos/fotos a `public/` |
| `tests/fakes/fake-audio-context.js` | AudioContext falso que registra nodos y eventos |
| `tests/*.test.js` | Vitest: smoke, data, voices, drum-engine, timing, scheduler |

**Regla de dependencias:** `data/*` no importa nada · `core/audio/*` no importa DOM ni three · `core/three/*` no importa audio · `components/*` orquestan.

---

### Task 1: Scaffolding del repo (Vite + Tailwind + Vitest + git)

**Files:**
- Create: `package.json`, `.gitignore`, `vite.config.js`, `vitest.config.js`, `index.html`, `src/styles/main.css`, `src/main.js`, `tests/smoke.test.js`

- [x] **Step 1: Inicializar git**

Run: `git init`
Expected: `Initialized empty Git repository in .../.git/`

- [x] **Step 2: Verificar identidad de git**

Run: `git config user.name; git config user.email`
Expected: dos valores no vacíos. **Si alguno está vacío:** pídele al usuario su nombre y email y configúralo solo en este repo (`git config user.name "..."` / `git config user.email "..."`) antes de continuar; los commits fallarían sin ello.

- [x] **Step 3: Crear `package.json`**

```json
{
  "name": "ritmo-nama",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "optimize:models": "node scripts/optimize-models.mjs"
  }
}
```

- [x] **Step 4: Crear `.gitignore`**

```gitignore
node_modules/
dist/
.superpowers/
lighthouse-report*.json
*.log
```

- [x] **Step 5: Crear `vite.config.js`**

```js
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0
  }
});
```

- [x] **Step 6: Crear `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
});
```

- [x] **Step 7: Crear `index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#09090b" />
    <meta
      name="description"
      content="Tambores infantiles artesanales Cuero Na'má: percusión de la fulia, minicurso y estudio rítmico interactivo."
    />
    <title>Ritmo Na'má | Tambores infantiles Cuero Na'má</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap"
      rel="stylesheet"
    />
  </head>
  <body class="bg-zinc-950 font-sans text-zinc-100 antialiased selection:bg-amber-500 selection:text-zinc-950">
    <a
      href="#hero"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-amber-500 focus:px-4 focus:py-2 focus:text-zinc-950"
    >
      Saltar al contenido
    </a>

    <header id="site-header"></header>

    <main>
      <section id="hero" aria-labelledby="hero-title"></section>
    </main>

    <footer class="border-t border-zinc-900 py-10 text-center text-sm text-zinc-500">
      <p class="font-bold text-zinc-300">Ritmo Na'má • Distribuidores oficiales de Cuero Na'má</p>
      <p class="mt-1">© 2026 Todos los derechos reservados.</p>
    </footer>

    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [x] **Step 8: Crear `src/styles/main.css`**

```css
@import "tailwindcss";

@theme {
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --color-brand-400: #fbbf24;
  --color-brand-500: #f59e0b;
  --color-brand-600: #d97706;
}

@keyframes drum-hit {
  0% { transform: scale(1); }
  30% { transform: scale(0.86); }
  100% { transform: scale(1); }
}

@keyframes drum-ring {
  0% { opacity: 0.9; transform: scale(0.6); }
  100% { opacity: 0; transform: scale(2.2); }
}

.is-hit .hotspot-core { animation: drum-hit 380ms cubic-bezier(0.2, 0.8, 0.3, 1); }
.is-hit .hotspot-ring { animation: drum-ring 620ms ease-out; }

@media (prefers-reduced-motion: reduce) {
  .is-hit .hotspot-core,
  .is-hit .hotspot-ring { animation: none; }
}
```

- [x] **Step 9: Crear `src/main.js` (versión mínima; se amplía en Task 6 y Task 8)**

```js
import './styles/main.css';

document.documentElement.dataset.ready = 'true';
```

- [x] **Step 10: Crear `tests/smoke.test.js`**

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('scaffolding', () => {
  it('el runner de tests funciona', () => {
    expect(1 + 1).toBe(2);
  });

  it('index.html está en español y referencia el entrypoint', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('/src/main.js');
  });
});
```

- [x] **Step 11: Instalar dependencias**

Run:
```powershell
npm install; if ($?) { npm install three }; if ($?) { npm install -D vite vitest @gltf-transform/cli tailwindcss @tailwindcss/vite }
```
Expected: `added N packages` sin errores en los tres comandos.

- [x] **Step 12: Ejecutar tests**

Run: `npm test`
Expected: `Test Files  1 passed (1)` · `Tests  2 passed (2)`

- [x] **Step 13: Build de producción**

Run: `npm run build`
Expected: `✓ built in ...` y existen `dist/index.html` y `dist/assets/`.

- [x] **Step 14: Commit**

```powershell
git add package.json package-lock.json .gitignore vite.config.js vitest.config.js index.html src tests
git commit -m "chore: scaffolding Vite + Tailwind v4 + Vitest"
```

---

### Task 2: Pipeline de optimización 3D y assets públicos

**Files:**
- Create: `scripts/optimize-models.mjs`

- [x] **Step 1: Crear `scripts/optimize-models.mjs`**

```js
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
```

- [x] **Step 2: Ejecutar el pipeline**

Run: `npm run optimize:models`
Expected: 3 líneas `Drumkidmulticolor3D.glb: 48.1 MB -> X.X MB` (etc.) + `assets listos en public/assets/`

- [x] **Step 3: Verificar el presupuesto de tamaño (< 4 MB por modelo)**

Run:
```powershell
Get-ChildItem public\assets\models | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,2)}}
```
Expected: cada `.glb` **< 4 MB**. Si alguno no llega, re-ejecuta solo ese con texturas menores:
```powershell
npx gltf-transform optimize "assets drums/visual/Drumkidmulticolor3D.glb" "public/assets/models/Drumkidmulticolor3D.glb" --compress meshopt --texture-compress webp --texture-size 1024
```
(repite el nombre para `Drumkid3D.glb` y `Mostradordrums.glb` si hace falta) y vuelve a medir.

- [x] **Step 4: Verificar assets de respaldo**

Run: `Get-ChildItem public\assets\video, public\assets\img`
Expected: 3 `.mp4` y 3 `.jpg` copiados.

- [x] **Step 5: Commit**

```powershell
git add scripts/optimize-models.mjs public
git commit -m "feat: pipeline gltf-transform y assets 3D optimizados"
```

---

### Task 3: Capa de datos (`config`, `drums`, `patterns`) con tests

**Files:**
- Create: `src/data/config.js`, `src/data/drums.js`, `src/data/patterns.js`
- Test: `tests/data.test.js`

- [x] **Step 1: Escribir el test fallido `tests/data.test.js`**

```js
import { describe, expect, it } from 'vitest';
import { contact, contactHref, contactLabel } from '../src/data/config.js';
import { DRUMS } from '../src/data/drums.js';
import { PATTERNS } from '../src/data/patterns.js';

const DRUM_IDS = ['prima', 'cruzao', 'pujao', 'paila', 'maracas', 'cuatro'];

describe('config de contacto', () => {
  it('con channel null no produce enlaces rotos', () => {
    expect(contact.channel).toBe(null);
    expect(contactHref('hero')).toBe(null);
    expect(contactLabel()).toBe('Próximamente');
  });

  it('con whatsapp arma wa.me con el mensaje de la sección', () => {
    const original = { ...contact, messages: { ...contact.messages } };
    Object.assign(contact, {
      channel: 'whatsapp',
      number: '584121234567',
      messages: { hero: 'Hola, quiero info', catalog: 'Catálogo', midipad: 'Estudio' }
    });

    expect(contactHref('hero')).toBe('https://wa.me/584121234567?text=Hola%2C%20quiero%20info');
    expect(contactHref('catalogo')).toBe('https://wa.me/584121234567?text=');

    Object.assign(contact, original);
  });

  it('con telegram arma t.me (admite @usuario)', () => {
    const original = { ...contact, messages: { ...contact.messages } };
    Object.assign(contact, { channel: 'telegram', number: '@ritmonama', messages: { hero: 'Hola' } });

    expect(contactHref('hero')).toBe('https://t.me/ritmonama?text=Hola');
    expect(contactLabel()).toBe('Escribir por Telegram');

    Object.assign(contact, original);
  });
});

describe('drums', () => {
  it('define los 6 instrumentos con campos requeridos', () => {
    expect(DRUMS.map((d) => d.id)).toEqual(DRUM_IDS);
    for (const drum of DRUMS) {
      expect(drum.name).toBeTruthy();
      expect(drum.role).toBeTruthy();
      expect(drum.color).toMatch(/^#/);
      expect(typeof drum.optional).toBe('boolean');
    }
  });
});

describe('patterns', () => {
  it('son 4 patrones con ids únicos', () => {
    expect(PATTERNS).toHaveLength(4);
    expect(new Set(PATTERNS.map((p) => p.id)).size).toBe(4);
  });

  it('cada patrón tiene 12 pasos por instrumento y acentos booleanos', () => {
    for (const pattern of PATTERNS) {
      expect(pattern.bpm).toBeGreaterThanOrEqual(80);
      expect(pattern.bpm).toBeLessThanOrEqual(180);
      for (const id of DRUM_IDS) {
        expect(pattern.steps[id]).toHaveLength(12);
        expect(pattern.accents[id]).toHaveLength(12);
        expect(pattern.steps[id].every((s) => typeof s === 'boolean')).toBe(true);
        expect(pattern.accents[id].every((s) => typeof s === 'boolean')).toBe(true);
      }
      expect(pattern.description).toBeTruthy();
    }
  });

  it('un acento solo existe donde hay golpe', () => {
    for (const pattern of PATTERNS) {
      for (const id of DRUM_IDS) {
        pattern.accents[id].forEach((accent, i) => {
          if (accent) expect(pattern.steps[id][i]).toBe(true);
        });
      }
    }
  });
});
```

- [x] **Step 2: Ejecutar para verlo fallar**

Run: `npm test`
Expected: FAIL con `Cannot find module '../src/data/config.js'`

- [x] **Step 3: Crear `src/data/config.js`**

```js
export const contact = {
  channel: null, // 'whatsapp' | 'telegram' | null
  number: null, // ej. '584121234567'
  messages: {
    hero: '',
    catalog: '',
    midipad: ''
  }
};

export function contactHref(section = 'hero') {
  const message = contact.messages[section] ?? '';
  if (contact.channel === 'whatsapp' && contact.number) {
    return `https://wa.me/${contact.number}?text=${encodeURIComponent(message)}`;
  }
  if (contact.channel === 'telegram' && contact.number) {
    const target = contact.number.startsWith('@') ? contact.number.slice(1) : contact.number;
    return `https://t.me/${target}?text=${encodeURIComponent(message)}`;
  }
  return null;
}

export function contactLabel() {
  if (contact.channel === 'whatsapp') return 'Pedir por WhatsApp';
  if (contact.channel === 'telegram') return 'Escribir por Telegram';
  return 'Próximamente';
}
```

- [x] **Step 4: Crear `src/data/drums.js`**

```js
export const DRUMS = [
  { id: 'prima', name: 'La Prima', role: 'El pulso y los repiques', color: '#f43f5e', optional: false },
  { id: 'cruzao', name: 'El Cruzao', role: 'Síncopa y sabor', color: '#10b981', optional: false },
  { id: 'pujao', name: 'El Pujao', role: 'Gravedad y fuerza', color: '#6366f1', optional: false },
  { id: 'paila', name: 'La Paila', role: 'El aro que marca el tiempo', color: '#f59e0b', optional: false },
  { id: 'maracas', name: 'Maracas', role: 'Brillo de semillas', color: '#eab308', optional: true },
  { id: 'cuatro', name: 'Cuatro', role: 'Rasgueo venezolano', color: '#f97316', optional: true }
];
```

- [x] **Step 5: Crear `src/data/patterns.js`**

```js
export const PATTERNS = [
  {
    id: 'guaira-tradicional',
    name: 'Golpe Guaireño Tradicional (6/8)',
    description:
      'El ritmo clásico de la costa de La Guaira: la Paila marca la cáscara continua mientras Pujao y Cruzao amarran el tumbao.',
    bpm: 124,
    steps: {
      prima: [true, false, false, true, false, true, false, true, false, true, true, false],
      cruzao: [false, true, false, false, true, false, false, true, false, false, true, false],
      pujao: [true, false, false, false, true, false, true, false, false, true, false, false],
      paila: [true, false, true, true, false, true, true, false, true, true, false, true],
      maracas: [true, false, true, true, false, true, true, false, true, true, false, true],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    },
    accents: {
      prima: [true, false, false, false, false, true, false, true, false, false, true, false],
      cruzao: [false, true, false, false, true, false, false, true, false, false, true, false],
      pujao: [true, false, false, false, true, false, true, false, false, false, false, false],
      paila: [true, false, false, true, false, false, true, false, false, true, false, false],
      maracas: [true, false, false, true, false, false, true, false, false, true, false, false],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    }
  },
  {
    id: 'san-millan',
    name: 'Cumaco San Millán / Naiguatá',
    description:
      'Formato festivo acelerado con repique fuerte en La Prima y acento cruzado entre Cruzao y Pujao.',
    bpm: 132,
    steps: {
      prima: [true, false, true, true, false, true, true, true, false, true, false, true],
      cruzao: [false, true, false, true, false, false, false, true, false, true, false, false],
      pujao: [true, false, false, true, false, false, true, false, false, true, false, false],
      paila: [true, true, false, true, true, false, true, true, false, true, true, false],
      maracas: [true, true, false, true, true, false, true, true, false, true, true, false],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    },
    accents: {
      prima: [true, false, false, true, false, false, true, false, false, true, false, false],
      cruzao: [false, true, false, false, false, false, false, true, false, false, false, false],
      pujao: [true, false, false, false, false, false, true, false, false, false, false, false],
      paila: [true, false, false, true, false, false, true, false, false, true, false, false],
      maracas: [true, false, false, true, false, false, true, false, false, true, false, false],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    }
  },
  {
    id: 'tarma-palo',
    name: 'Tambor de Tarma / Chichiriviche',
    description:
      'Métrica pesada e hipnótica, con acentuación fuerte en los palos de La Paila y el Pujao profundo.',
    bpm: 118,
    steps: {
      prima: [false, true, false, true, false, true, false, true, true, false, true, false],
      cruzao: [true, false, false, true, false, false, true, false, false, true, false, false],
      pujao: [true, false, false, false, false, true, true, false, false, false, false, true],
      paila: [true, false, true, false, true, true, true, false, true, false, true, true],
      maracas: [true, false, true, false, true, true, true, false, true, false, true, true],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    },
    accents: {
      prima: [false, false, false, true, false, true, false, false, true, false, false, false],
      cruzao: [true, false, false, false, false, false, true, false, false, false, false, false],
      pujao: [true, false, false, false, false, false, true, false, false, false, false, false],
      paila: [true, false, false, false, true, false, true, false, false, false, true, false],
      maracas: [true, false, false, false, true, false, true, false, false, false, true, false],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    }
  },
  {
    id: 'repique-rapido',
    name: 'Trance y Repique de Costa',
    description: 'Ritmo rápido de clímax con repiques continuos, para el momento de mayor energía.',
    bpm: 138,
    steps: {
      prima: [true, true, false, true, true, false, true, true, false, true, true, true],
      cruzao: [false, true, true, false, true, true, false, true, true, false, true, false],
      pujao: [true, false, false, true, false, true, true, false, false, true, false, true],
      paila: [true, true, true, true, true, true, true, true, true, true, true, true],
      maracas: [true, true, true, true, true, true, true, true, true, true, true, true],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    },
    accents: {
      prima: [true, true, false, false, true, false, true, true, false, false, true, true],
      cruzao: [false, true, false, false, true, false, false, true, false, false, true, false],
      pujao: [true, false, false, false, false, true, true, false, false, false, false, true],
      paila: [true, false, false, true, false, false, true, false, false, true, false, false],
      maracas: [true, false, false, true, false, false, true, false, false, true, false, false],
      cuatro: [true, false, false, true, false, false, true, false, false, true, false, false]
    }
  }
];
```

- [x] **Step 6: Ejecutar tests para verlos pasar**

Run: `npm test`
Expected: `Test Files  2 passed` · `Tests  9 passed` (2 smoke + 7 de datos).

- [x] **Step 7: Commit**

```powershell
git add src/data tests/data.test.js
git commit -m "feat: data layer (contacto, instrumentos, patrones de fulia)"
```

---

### Task 4: DrumEngine (TDD) — motor de síntesis reutilizable

**Files:**
- Create: `src/core/audio/context.js`, `src/core/audio/voices.js`, `src/core/audio/noise.js`, `src/core/audio/drum-engine.js`
- Test: `tests/fakes/fake-audio-context.js`, `tests/voices.test.js`, `tests/drum-engine.test.js`

- [x] **Step 1: Crear el AudioContext falso `tests/fakes/fake-audio-context.js`**

```js
export function createFakeAudioContext({ sampleRate = 48000, currentTime = 0 } = {}) {
  const log = [];
  let buffersCreated = 0;

  const param = (node, name) => ({
    value: 0,
    setValueAtTime(v, t) {
      log.push({ node, name, op: 'setValueAtTime', v, t });
      return this;
    },
    exponentialRampToValueAtTime(v, t) {
      log.push({ node, name, op: 'exponentialRampToValueAtTime', v, t });
      return this;
    },
    linearRampToValueAtTime(v, t) {
      log.push({ node, name, op: 'linearRampToValueAtTime', v, t });
      return this;
    }
  });

  const makeNode = (type) => ({
    type,
    connections: [],
    connect(target) {
      this.connections.push(target);
      return target;
    },
    disconnect() {
      this.connections = [];
    }
  });

  return {
    sampleRate,
    currentTime,
    state: 'running',
    destination: makeNode('destination'),
    log,
    get buffersCreated() {
      return buffersCreated;
    },
    createGain() {
      const node = makeNode('gain');
      node.gain = param(node, 'gain');
      log.push({ node, op: 'createGain' });
      return node;
    },
    createOscillator() {
      const node = makeNode('oscillator');
      node.type = 'sine';
      node.frequency = param(node, 'frequency');
      node.start = (t) => log.push({ node, op: 'start', t });
      node.stop = (t) => log.push({ node, op: 'stop', t });
      log.push({ node, op: 'createOscillator' });
      return node;
    },
    createBufferSource() {
      const node = makeNode('buffersource');
      node.buffer = null;
      node.start = (t, offset = 0) => log.push({ node, op: 'start', t, offset });
      node.stop = (t) => log.push({ node, op: 'stop', t });
      log.push({ node, op: 'createBufferSource' });
      return node;
    },
    createBiquadFilter() {
      const node = makeNode('filter');
      node.type = 'lowpass';
      node.frequency = param(node, 'frequency');
      node.Q = param(node, 'Q');
      log.push({ node, op: 'createBiquadFilter' });
      return node;
    },
    createStereoPanner() {
      const node = makeNode('panner');
      node.pan = param(node, 'pan');
      log.push({ node, op: 'createStereoPanner' });
      return node;
    },
    createBuffer(channels, length, rate) {
      buffersCreated += 1;
      const data = new Float32Array(length);
      return {
        numberOfChannels: channels,
        length,
        sampleRate: rate,
        getChannelData: () => data
      };
    }
  };
}
```

- [x] **Step 2: Escribir el test fallido `tests/voices.test.js`**

```js
import { describe, expect, it } from 'vitest';
import { PAILA_PARTIALS, voiceSpec } from '../src/core/audio/voices.js';

describe('voiceSpec', () => {
  it('pujao: osc sine con caída 130→48 en 0.18 s y ruido filtrado grave', () => {
    const [osc, noise] = voiceSpec('pujao', 1);
    expect(osc).toMatchObject({
      kind: 'osc',
      type: 'sine',
      from: 130,
      to: 48,
      glide: 0.18,
      gain: 1,
      decay: 0.45,
      stop: 0.48
    });
    expect(noise).toMatchObject({ kind: 'noise', filter: { type: 'lowpass', freq: 600 } });
  });

  it('prima: slap agudo con ruido bandpass 2400 y Q 4', () => {
    const [osc, noise] = voiceSpec('prima', 1);
    expect(osc.from).toBe(380);
    expect(osc.to).toBe(210);
    expect(noise.filter).toMatchObject({ type: 'bandpass', freq: 2400, q: 4 });
  });

  it('cruzao: triángulo medio con ruido bandpass 1200', () => {
    const [osc, noise] = voiceSpec('cruzao', 1);
    expect(osc.type).toBe('triangle');
    expect(noise.filter.freq).toBe(1200);
  });

  it('paila: 4 parciales metálicos decrecientes + ruido highpass', () => {
    const spec = voiceSpec('paila', 1);
    const oscs = spec.filter((s) => s.kind === 'osc');
    expect(oscs).toHaveLength(PAILA_PARTIALS.length);
    expect(oscs.map((o) => o.from)).toEqual(PAILA_PARTIALS);
    expect(oscs[0].gain).toBeGreaterThan(oscs[1].gain);
    expect(spec.at(-1).filter.type).toBe('highpass');
  });

  it('aplica pitchRatio a todas las frecuencias', () => {
    const [osc, noise] = voiceSpec('prima', 2);
    expect(osc.from).toBe(760);
    expect(osc.to).toBe(420);
    expect(noise.filter.freq).toBe(4800);
  });

  it('maracas y cuatro existen; id desconocido devuelve []', () => {
    expect(voiceSpec('maracas', 1).length).toBeGreaterThan(0);
    expect(voiceSpec('cuatro', 1).length).toBeGreaterThan(0);
    expect(voiceSpec('inventado', 1)).toEqual([]);
  });
});
```

- [x] **Step 3: Ejecutar para verlo fallar**

Run: `npx vitest run tests/voices.test.js`
Expected: FAIL `Cannot find module '.../src/core/audio/voices.js'`

- [x] **Step 4: Crear `src/core/audio/voices.js`**

```js
export const PAILA_PARTIALS = [840, 1420, 2650, 4100];

export function voiceSpec(id, pitchRatio = 1) {
  const p = pitchRatio;
  switch (id) {
    case 'pujao':
      return [
        { kind: 'osc', type: 'sine', from: 130 * p, to: 48 * p, glide: 0.18, gain: 1.0, decay: 0.45, stop: 0.48 },
        { kind: 'noise', duration: 0.05, filter: { type: 'lowpass', freq: 600 * p }, gain: 0.4, decay: 0.06 }
      ];
    case 'cruzao':
      return [
        { kind: 'osc', type: 'triangle', from: 220 * p, to: 110 * p, glide: 0.12, gain: 0.9, decay: 0.28, stop: 0.3 },
        { kind: 'noise', duration: 0.04, filter: { type: 'bandpass', freq: 1200 * p, q: 3 }, gain: 0.5, decay: 0.04 }
      ];
    case 'prima':
      return [
        { kind: 'osc', type: 'sine', from: 380 * p, to: 210 * p, glide: 0.08, gain: 0.85, decay: 0.18, stop: 0.2 },
        { kind: 'noise', duration: 0.03, filter: { type: 'bandpass', freq: 2400 * p, q: 4 }, gain: 0.7, decay: 0.03 }
      ];
    case 'paila':
      return [
        ...PAILA_PARTIALS.map((freq, i) => ({
          kind: 'osc',
          type: i % 2 === 0 ? 'sine' : 'square',
          from: freq * p,
          to: freq * p,
          glide: 0,
          gain: 0.3 / (i + 1),
          decay: 0.03 + i * 0.015,
          stop: 0.04 + i * 0.015
        })),
        { kind: 'noise', duration: 0.02, filter: { type: 'highpass', freq: 3200 * p }, gain: 0.8, decay: 0.025 }
      ];
    case 'maracas':
      return [
        { kind: 'noise', duration: 0.06, filter: { type: 'bandpass', freq: 6500 * p, q: 1.2 }, gain: 0.55, decay: 0.06 }
      ];
    case 'cuatro':
      return [
        { kind: 'osc', type: 'triangle', from: 294 * p, to: 294 * p, glide: 0, gain: 0.6, decay: 0.3, stop: 0.32 },
        { kind: 'noise', duration: 0.03, filter: { type: 'highpass', freq: 1800 * p }, gain: 0.3, decay: 0.04 }
      ];
    default:
      return [];
  }
}
```

- [x] **Step 5: Verificar los tests de voices**

Run: `npx vitest run tests/voices.test.js`
Expected: `Tests  6 passed`

- [x] **Step 6: Escribir el test fallido `tests/drum-engine.test.js`**

```js
import { describe, expect, it } from 'vitest';
import { createDrumEngine } from '../src/core/audio/drum-engine.js';
import { createFakeAudioContext } from './fakes/fake-audio-context.js';

function rig() {
  const ctx = createFakeAudioContext();
  const engine = createDrumEngine(() => ctx);
  return { ctx, engine };
}

const oscNodes = (ctx) => ctx.log.filter((e) => e.op === 'createOscillator').map((e) => e.node);
const gainNodes = (ctx) => ctx.log.filter((e) => e.op === 'createGain').map((e) => e.node);
const eventsFor = (ctx, node) => ctx.log.filter((e) => e.node === node);

describe('drum-engine', () => {
  it('pujao genera 1 oscilador con caída 130→48 y stop en t+0.48', () => {
    const { ctx, engine } = rig();
    engine.trigger('pujao', { time: 2 });

    const [osc] = oscNodes(ctx);
    expect(osc.type).toBe('sine');

    const ev = eventsFor(ctx, osc);
    const set = ev.find((e) => e.name === 'frequency' && e.op === 'setValueAtTime');
    expect(set).toMatchObject({ v: 130, t: 2 });

    const ramp = ev.find((e) => e.name === 'frequency' && e.op === 'exponentialRampToValueAtTime');
    expect(ramp.v).toBeCloseTo(48);
    expect(ramp.t).toBeCloseTo(2.18);

    expect(ev.find((e) => e.op === 'stop').t).toBeCloseTo(2.48);
  });

  it('el acento multiplica la ganancia por 1.3', () => {
    const plain = rig();
    plain.engine.trigger('prima', { time: 0 });
    const normalGain = gainNodes(plain.ctx)[0].gain.value;

    const accented = rig();
    accented.engine.trigger('prima', { time: 0, accent: true });
    const accentGain = gainNodes(accented.ctx)[0].gain.value;

    expect(accentGain).toBeCloseTo(normalGain * 1.3);
  });

  it('pitchShift +12 semitonos dobla la frecuencia', () => {
    const { ctx, engine } = rig();
    engine.trigger('prima', { time: 1, pitchShift: 12 });

    const [osc] = oscNodes(ctx);
    const set = eventsFor(ctx, osc).find((e) => e.name === 'frequency' && e.op === 'setValueAtTime');
    expect(set.v).toBeCloseTo(760);
  });

  it('el pan se aplica con StereoPanner acotado a [-1, 1]', () => {
    const { ctx, engine } = rig();
    engine.trigger('cruzao', { time: 0, pan: -5 });

    const panner = ctx.log.find((e) => e.op === 'createStereoPanner').node;
    expect(panner.pan.value).toBe(-1);
  });

  it('un id desconocido no crea ningún nodo', () => {
    const { ctx, engine } = rig();
    engine.trigger('inventado', { time: 0 });
    expect(ctx.log.filter((e) => e.op.startsWith('create'))).toHaveLength(0);
  });

  it('el buffer de ruido se cachea: el segundo golpe no lo recrea', () => {
    const { ctx, engine } = rig();
    engine.trigger('paila', { time: 0 });
    engine.trigger('paila', { time: 0.5 });
    expect(ctx.buffersCreated).toBe(1);
  });

  it('setMasterVolume actualiza el gain maestro conectado al destino', () => {
    const { ctx, engine } = rig();
    engine.trigger('prima', { time: 0 });

    const master = gainNodes(ctx).find((n) => n.connections.includes(ctx.destination));
    engine.setMasterVolume(0.5);

    expect(master.gain.value).toBe(0.5);
    expect(engine.getMasterVolume()).toBe(0.5);
  });

  it('sin contexto de audio no lanza excepción', () => {
    const engine = createDrumEngine(() => null);
    expect(() => engine.trigger('prima')).not.toThrow();
  });
});
```

- [x] **Step 7: Ejecutar para verlo fallar**

Run: `npx vitest run tests/drum-engine.test.js`
Expected: FAIL `Cannot find module '.../drum-engine.js'`

- [x] **Step 8: Crear `src/core/audio/context.js`**

```js
let audioContext = null;

export function getAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx({ latencyHint: 'interactive' });
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

export function unlockAudioOnFirstGesture() {
  const unlock = () => {
    getAudioContext();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}
```

- [x] **Step 9: Crear `src/core/audio/noise.js`**

```js
const CACHE = new WeakMap();

export const NOISE_SECONDS = 1;

export function getNoiseBuffer(ctx) {
  let buffer = CACHE.get(ctx);
  if (!buffer) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS));
    buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    CACHE.set(ctx, buffer);
  }
  return buffer;
}

export function noiseOffset(ctx) {
  void ctx;
  const usableSeconds = Math.max(0, NOISE_SECONDS - 0.25);
  return Math.random() * usableSeconds;
}
```

- [x] **Step 10: Crear `src/core/audio/drum-engine.js`**

```js
import { getNoiseBuffer, noiseOffset } from './noise.js';
import { voiceSpec } from './voices.js';

export function createDrumEngine(getContext, { masterVolume = 0.85 } = {}) {
  let master = null;
  let masterContext = null;
  let volume = masterVolume;

  function ensureMaster(ctx) {
    if (!master || masterContext !== ctx) {
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
      masterContext = ctx;
    }
    return master;
  }

  function renderVoice(ctx, spec, t, destination) {
    if (spec.kind === 'osc') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type;
      osc.frequency.setValueAtTime(spec.from, t);
      if (spec.glide > 0) osc.frequency.exponentialRampToValueAtTime(spec.to, t + spec.glide);
      gain.gain.setValueAtTime(spec.gain, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + spec.decay);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(t);
      osc.stop(t + spec.stop);
      return;
    }

    if (spec.kind === 'noise') {
      const source = ctx.createBufferSource();
      source.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = spec.filter.type;
      filter.frequency.setValueAtTime(spec.filter.freq, t);
      if (typeof spec.filter.q === 'number') filter.Q.setValueAtTime(spec.filter.q, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(spec.gain, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + spec.decay);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      const stopAt = t + Math.max(spec.duration, spec.decay) + 0.01;
      source.start(t, noiseOffset(ctx));
      source.stop(stopAt);
    }
  }

  function trigger(id, { time, volume: hitVolume = 1, pan = 0, pitchShift = 0, accent = false } = {}) {
    const ctx = getContext();
    if (!ctx) return;
    const t = typeof time === 'number' ? time : ctx.currentTime;

    const ratio = Math.pow(2, pitchShift / 12);
    const specs = voiceSpec(id, ratio);
    if (specs.length === 0) return;

    const out = ctx.createGain();
    out.gain.value = hitVolume * (accent ? 1.3 : 1);

    const masterNode = ensureMaster(ctx);
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(panner);
      panner.connect(masterNode);
    } else {
      out.connect(masterNode);
    }

    for (const spec of specs) renderVoice(ctx, spec, t, out);
  }

  return {
    trigger,
    setMasterVolume(value) {
      volume = Math.max(0, Math.min(1, value));
      if (master) master.gain.value = volume;
    },
    getMasterVolume() {
      return volume;
    }
  };
}
```

- [x] **Step 11: Ejecutar la suite completa**

Run: `npm test`
Expected: todos los archivos en `passed`, `0 failed` (2 smoke + 7 datos + 6 voices + 8 engine = 23).

- [x] **Step 12: Commit**

```powershell
git add src/core/audio tests/fakes tests/voices.test.js tests/drum-engine.test.js
git commit -m "feat: drum-engine con sintesis de 6 voces y tests con AudioContext falso"
```

---

### Task 5: Timing puro + Lookahead scheduler (TDD)

**Files:**
- Create: `src/core/audio/timing.js`, `src/core/audio/scheduler.js`
- Test: `tests/timing.test.js`, `tests/scheduler.test.js`

- [x] **Step 1: Escribir el test fallido `tests/timing.test.js`**

```js
import { describe, expect, it } from 'vitest';
import { MAX_SWING_PERCENT, STEPS_PER_CYCLE, stepDurationSec, swingOffsetSec } from '../src/core/audio/timing.js';

describe('timing', () => {
  it('12 pasos por ciclo y duración de paso = 60/bpm/3 (subdivisión de 6/8)', () => {
    expect(STEPS_PER_CYCLE).toBe(12);
    expect(stepDurationSec(120)).toBeCloseTo(0.16666, 5);
    expect(stepDurationSec(124)).toBeCloseTo(0.16129, 5);
  });

  it('el swing solo afecta al paso 1 de cada tercia (índice % 3 === 1)', () => {
    expect(swingOffsetSec(120, 40, 0)).toBe(0);
    expect(swingOffsetSec(120, 40, 1)).toBeGreaterThan(0);
    expect(swingOffsetSec(120, 40, 2)).toBe(0);
    expect(swingOffsetSec(120, 40, 4)).toBeGreaterThan(0);
  });

  it('con swing 0 no hay offset y el swing está acotado al 60 %', () => {
    expect(swingOffsetSec(120, 0, 1)).toBe(0);
    const atMax = swingOffsetSec(120, MAX_SWING_PERCENT, 1);
    const overMax = swingOffsetSec(120, 100, 1);
    expect(overMax).toBeCloseTo(atMax);
    expect(atMax).toBeCloseTo(0.6 * stepDurationSec(120) * 0.45);
  });
});
```

- [x] **Step 2: Ejecutar para verlo fallar**

Run: `npx vitest run tests/timing.test.js`
Expected: FAIL `Cannot find module '.../timing.js'`

- [x] **Step 3: Crear `src/core/audio/timing.js`**

```js
export const STEPS_PER_CYCLE = 12;
export const MAX_SWING_PERCENT = 60;

export function stepDurationSec(bpm) {
  return 60 / bpm / 3;
}

export function swingOffsetSec(bpm, swingPercent, stepIndex) {
  if (swingPercent <= 0) return 0;
  if (stepIndex % 3 !== 1) return 0;
  const capped = Math.min(swingPercent, MAX_SWING_PERCENT);
  return (capped / 100) * stepDurationSec(bpm) * 0.45;
}
```

- [x] **Step 4: Verificar**

Run: `npx vitest run tests/timing.test.js`
Expected: `Tests  3 passed`

- [x] **Step 5: Escribir el test fallido `tests/scheduler.test.js`**

```js
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScheduler } from '../src/core/audio/scheduler.js';
import { createFakeAudioContext } from './fakes/fake-audio-context.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('scheduler (lookahead)', () => {
  it('agenda el primer paso al iniciar y el siguiente dentro de la ventana', () => {
    vi.useFakeTimers();
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const steps = [];

    const scheduler = createScheduler({
      getContext: () => ctx,
      onStep: (step, time) => steps.push({ step, time }),
      bpm: 120,
      swing: 0
    });

    scheduler.start();
    expect(steps).toEqual([{ step: 0, time: 0.05 }]);

    ctx.currentTime = 0.25;
    vi.advanceTimersByTime(25);
    expect(steps.map((s) => s.step)).toEqual([0, 1]);
    expect(steps[1].time).toBeCloseTo(0.05 + 60 / 120 / 3);

    scheduler.stop();
    ctx.currentTime = 1;
    vi.advanceTimersByTime(100);
    expect(steps).toHaveLength(2);
  });

  it('el swing desplaza el tiempo reportado del paso 1', () => {
    vi.useFakeTimers();
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const steps = [];

    const scheduler = createScheduler({
      getContext: () => ctx,
      onStep: (step, time) => steps.push({ step, time }),
      bpm: 120,
      swing: 40
    });

    scheduler.start();
    ctx.currentTime = 0.3;
    vi.advanceTimersByTime(25);

    const step1 = steps.find((s) => s.step === 1);
    const expected = 0.05 + 60 / 120 / 3 + (40 / 100) * (60 / 120 / 3) * 0.45;
    expect(step1.time).toBeCloseTo(expected);
    scheduler.stop();
  });

  it('setBpm cambia la duración de los pasos siguientes', () => {
    vi.useFakeTimers();
    const ctx = createFakeAudioContext({ currentTime: 0 });
    const steps = [];

    const scheduler = createScheduler({
      getContext: () => ctx,
      onStep: (step, time) => steps.push({ step, time }),
      bpm: 120,
      swing: 0
    });

    scheduler.start();
    scheduler.setBpm(60);
    ctx.currentTime = 1;
    vi.advanceTimersByTime(25);

    const durations = steps.slice(1).map((s, i) => s.time - steps[i].time);
    expect(durations.at(-1)).toBeCloseTo(60 / 60 / 3);
    scheduler.stop();
  });
});
```

- [x] **Step 6: Ejecutar para verlo fallar**

Run: `npx vitest run tests/scheduler.test.js`
Expected: FAIL `Cannot find module '.../scheduler.js'`

- [x] **Step 7: Crear `src/core/audio/scheduler.js`**

```js
import { getAudioContext } from './context.js';
import { STEPS_PER_CYCLE, stepDurationSec, swingOffsetSec } from './timing.js';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.1;

export function createScheduler({
  getContext = getAudioContext,
  onStep,
  bpm = 124,
  swing = 40,
  lookaheadMs = LOOKAHEAD_MS,
  scheduleAheadSec = SCHEDULE_AHEAD_SEC,
  steps = STEPS_PER_CYCLE
} = {}) {
  let timer = null;
  let nextStepTime = 0;
  let stepIndex = -1;
  let currentBpm = bpm;
  let currentSwing = swing;

  function schedule() {
    const ctx = getContext();
    if (!ctx) return;
    while (nextStepTime < ctx.currentTime + scheduleAheadSec) {
      stepIndex = (stepIndex + 1) % steps;
      const offset = swingOffsetSec(currentBpm, currentSwing, stepIndex);
      onStep(stepIndex, nextStepTime + offset);
      nextStepTime += stepDurationSec(currentBpm);
    }
  }

  return {
    start() {
      const ctx = getContext();
      if (!ctx || timer !== null) return;
      nextStepTime = ctx.currentTime + 0.05;
      schedule();
      timer = setInterval(schedule, lookaheadMs);
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      stepIndex = -1;
    },
    setBpm(value) {
      currentBpm = Math.max(40, Math.min(240, value));
    },
    setSwing(value) {
      currentSwing = Math.max(0, Math.min(60, value));
    },
    get isRunning() {
      return timer !== null;
    },
    get step() {
      return stepIndex;
    }
  };
}
```

- [x] **Step 8: Ejecutar la suite completa**

Run: `npm test`
Expected: todos `passed`, `0 failed`.

- [x] **Step 9: Commit**

```powershell
git add src/core/audio/timing.js src/core/audio/scheduler.js tests/timing.test.js tests/scheduler.test.js
git commit -m "feat: lookahead scheduler con correccion de swing y tests"
```

---

### Task 6: Header con CTA de contacto configurable

**Files:**
- Create: `src/components/header.js`
- Modify: `src/main.js`

- [x] **Step 1: Crear `src/components/header.js`**

```js
import { contactHref, contactLabel } from '../data/config.js';

export function mountHeader(root) {
  if (!root) return null;

  root.className = 'sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md';
  root.innerHTML = `
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-20">
      <a href="#hero" class="flex items-center gap-2">
        <span class="text-xl font-black tracking-tight text-amber-500 sm:text-2xl">Ritmo Na'má</span>
        <span class="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">por Cuero Na'má</span>
      </a>
      <button
        type="button"
        data-contact-cta
        class="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-500 sm:px-5"
      >
        <span aria-hidden="true">💬</span>
        <span data-contact-label>${contactLabel()}</span>
      </button>
    </div>`;

  const cta = root.querySelector('[data-contact-cta]');
  const href = contactHref('hero');

  if (href) {
    cta.addEventListener('click', () => {
      window.open(href, '_blank', 'noopener,noreferrer');
    });
  } else {
    cta.disabled = true;
    cta.classList.add('cursor-not-allowed', 'opacity-60');
    cta.title = 'Canal de contacto por configurar';
  }

  return cta;
}
```

- [x] **Step 2: Ampliar `src/main.js`**

```js
import './styles/main.css';
import { unlockAudioOnFirstGesture } from './core/audio/context.js';
import { mountHeader } from './components/header.js';

unlockAudioOnFirstGesture();
mountHeader(document.getElementById('site-header'));

document.documentElement.dataset.ready = 'true';
```

- [x] **Step 3: Verificar en el navegador**

Run: `npm run dev`
Expected: `Local: http://localhost:5173/`. Abre la URL y comprueba: header sticky, CTA con texto **"Próximamente"** deshabilitado (sin enlace roto), consola sin errores. Cierra el servidor con `Ctrl+C`.

- [x] **Step 4: Commit**

```powershell
git add src/components/header.js src/main.js
git commit -m "feat: header sticky con CTA de contacto configurable"
```

---

### Task 7: Visor 3D (`viewer.js`) con fallback a video

**Files:**
- Create: `src/core/three/viewer.js`

- [x] **Step 1: Crear `src/core/three/viewer.js`**

```js
const HOTSPOT_ID = 'drum-hotspot';

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

function hotspotMarkup() {
  return `
    <button
      id="${HOTSPOT_ID}"
      type="button"
      class="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      aria-label="Toca el parche para escuchar la fulia"
    >
      <span class="hotspot-ring absolute inset-0 rounded-full border-2 border-amber-400"></span>
      <span class="hotspot-core relative flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/90 text-lg text-zinc-950 shadow-xl shadow-amber-500/30">
        <span aria-hidden="true">♪</span>
      </span>
    </button>`;
}

function mountFallback(container, { fallbackVideoUrl, onHotspot }) {
  container.innerHTML = `
    <div class="relative h-full w-full overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
      <video
        class="h-full w-full object-cover"
        src="${fallbackVideoUrl}"
        autoplay
        muted
        loop
        playsinline
      ></video>
      <div class="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2">${hotspotMarkup()}</div>
    </div>`;

  const button = container.querySelector(`#${HOTSPOT_ID}`);
  button.addEventListener('click', onHotspot);

  return {
    destroy() {
      container.innerHTML = '';
    }
  };
}

export async function createViewer({ container, modelUrl, fallbackVideoUrl, onHotspot }) {
  if (!container) return null;
  if (!hasWebGL()) return mountFallback(container, { fallbackVideoUrl, onHotspot });

  container.innerHTML =
    '<div class="flex h-full w-full items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-500">Cargando tambor…</div>';

  try {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(modelUrl);
    const model = gltf.scene;

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const scale = 1.9 / Math.max(size.x, size.y, size.z); // desviación: 1.9 (no 2.1) para que el tambor quepa con margen

    model.scale.setScalar(scale);
    model.position.copy(center).multiplyScalar(-scale);

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 3.6); // desviación: (0.5, 3.6) en vez de (0.55, 3.3) — encuadre comprobado en navegador

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
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
    container.insertAdjacentHTML('beforeend', hotspotMarkup());

    const hotspot = container.querySelector(`#${HOTSPOT_ID}`);
    hotspot.addEventListener('click', onHotspot);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.maxPolarAngle = Math.PI * 0.78;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6;
    controls.target.set(0, 0, 0);

    let resumeTimer = null;
    controls.addEventListener('start', () => {
      controls.autoRotate = false;
      if (resumeTimer) clearTimeout(resumeTimer);
    });
    controls.addEventListener('end', () => {
      resumeTimer = setTimeout(() => {
        controls.autoRotate = true;
      }, 3000);
    });

    // Ancla en la banda horizontal más densa (centro del parche visible), en espacio mundo.
    // Desviación: findDrumheadAnchor() en lugar de (0, size.y*scale/2, 0) — el hotspot original
    // quedaba en la punta de la baqueta (box.max.y); el GLB tiene rotación de nodo (+90°X), por
    // eso el histograma se calcula con matrixWorld (post-transformación), nunca en espacio de malla.
    const headWorld =
      findDrumheadAnchor(THREE, model) ?? new THREE.Vector3(0, (size.y * scale) / 2, 0);
    const projected = new THREE.Vector3();

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    let frame = 0;
    function render() {
      frame = requestAnimationFrame(render);
      controls.update();

      const rect = container.getBoundingClientRect();
      projected.copy(headWorld).project(camera);
      const halfW = hotspot.offsetWidth / 2 + 2;
      const halfH = hotspot.offsetHeight / 2 + 2;
      const x = Math.min(Math.max((projected.x * 0.5 + 0.5) * rect.width, halfW), rect.width - halfW);
      const y = Math.min(Math.max((-projected.y * 0.5 + 0.5) * rect.height, halfH), rect.height - halfH);
      hotspot.style.left = `${x}px`;
      hotspot.style.top = `${y}px`;
      hotspot.style.opacity = projected.z > 1 ? '0' : '1';

      renderer.render(scene, camera);
    }
    render();

    return {
      destroy() {
        cancelAnimationFrame(frame);
        if (resumeTimer) clearTimeout(resumeTimer);
        resizeObserver.disconnect();
        controls.dispose();
        renderer.dispose();
        container.innerHTML = '';
      }
    };
  } catch (error) {
    console.warn('[viewer] fallback a video:', error);
    return mountFallback(container, { fallbackVideoUrl, onHotspot });
  }
}
```

- [x] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: `✓ built in ...` sin errores de import de `three/addons/*`.

- [x] **Step 3: Commit**

```powershell
git add src/core/three/viewer.js
git commit -m "feat: visor 3D con orbit, auto-rotacion, hotspot proyectado y fallback video"
```

---

### Task 8: Hero con demo de fulia

**Files:**
- Create: `src/core/audio/demo.js`, `src/components/hero.js`
- Modify: `src/main.js`

- [x] **Step 1: Crear `src/core/audio/demo.js`**

```js
import { PATTERNS } from '../../data/patterns.js';
import { createScheduler } from './scheduler.js';

export function playFuliaDemo({ engine, patternId = 'guaira-tradicional', cycles = 3, swing = 40, onStop } = {}) {
  const pattern = PATTERNS.find((p) => p.id === patternId);
  if (!pattern || !engine) return null;

  let completedCycles = 0;
  const lastStep = pattern.steps.prima.length - 1;

  const scheduler = createScheduler({
    bpm: pattern.bpm,
    swing,
    onStep(step, time) {
      if (completedCycles >= cycles) return;
      for (const [drumId, steps] of Object.entries(pattern.steps)) {
        if (steps[step]) {
          engine.trigger(drumId, { time, accent: Boolean(pattern.accents?.[drumId]?.[step]) });
        }
      }
      if (step === lastStep) {
        completedCycles += 1;
        if (completedCycles >= cycles) {
          scheduler.stop();
          onStop?.();
        }
      }
    }
  });

  scheduler.start();
  return scheduler;
}
```

- [x] **Step 2: Crear `src/components/hero.js`**

```js
import { playFuliaDemo } from '../core/audio/demo.js';
import { getAudioContext } from '../core/audio/context.js';
import { createViewer } from '../core/three/viewer.js';

const MODEL_URL = '/assets/models/Drumkidmulticolor3D.glb';
const FALLBACK_VIDEO_URL = '/assets/video/Drumkidmulticolor3D.mp4';

export function mountHero(root, { engine } = {}) {
  if (!root) return null;

  root.className = 'relative overflow-hidden border-b border-zinc-900 py-12 lg:py-20';
  root.innerHTML = `
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-600/10 via-zinc-950/0 to-zinc-950"></div>

    <div class="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
      <div class="space-y-6 text-center lg:text-left">
        <span class="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
          <span class="h-2 w-2 animate-pulse rounded-full bg-amber-500"></span>
          Edición infantil • 100% artesanal
        </span>

        <h1 id="hero-title" class="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          El ritmo que nace en las
          <span class="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">manos de los más pequeños</span>
        </h1>

        <p class="mx-auto max-w-xl text-lg leading-relaxed text-zinc-400 lg:mx-0">
          Tambores artesanales Cuero Na'má, diseñados ergonómicamente para niños.
          Afinación profesional adaptada, madera noble y el sonido auténtico de la fulia venezolana.
        </p>

        <div class="flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
          <button
            type="button"
            data-play-demo
            class="rounded-xl bg-amber-500 px-8 py-4 text-base font-bold text-zinc-950 shadow-xl shadow-amber-500/20 transition-all hover:bg-amber-400"
          >
            ▶ Escuchar la fulia
          </button>
          <a
            href="#catalogo"
            class="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-4 text-center text-base font-semibold text-zinc-300 transition-all hover:bg-zinc-800"
          >
            Ver los tambores ↓
          </a>
        </div>

        <p data-audio-hint class="hidden text-sm font-medium text-amber-400/90 lg:text-left">
          🔊 Toca cualquier lugar para activar el sonido
        </p>
      </div>

      <div class="relative">
        <div class="absolute inset-0 -z-10 rounded-full bg-gradient-to-tr from-amber-600/20 to-orange-500/20 blur-3xl"></div>
        <div
          data-viewer
          class="h-[340px] w-full overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-amber-600/10 sm:h-[440px]"
        ></div>
        <p class="mt-3 text-center text-xs text-zinc-500">Arrastra para rotar 360° · Toca el ♪ para la demo</p>
      </div>
    </div>`;

  const container = root.querySelector('[data-viewer]');
  const playButton = root.querySelector('[data-play-demo]');
  let activeDemo = null;

  function triggerFulia() {
    container.classList.remove('is-hit');
    void container.offsetWidth; // reinicia las animaciones CSS
    container.classList.add('is-hit');
    setTimeout(() => container.classList.remove('is-hit'), 700);

    if (activeDemo) {
      activeDemo.stop();
      activeDemo = null;
    }
    activeDemo = playFuliaDemo({
      engine,
      onStop: () => {
        activeDemo = null;
      }
    });
  }

  playButton.addEventListener('click', triggerFulia);

  const hint = root.querySelector('[data-audio-hint]');
  if (getAudioContext()?.state === 'suspended') {
    hint.classList.remove('hidden');
    window.addEventListener(
      'pointerdown',
      () => hint.classList.add('hidden'),
      { once: true }
    );
  }

  let viewer = null;
  createViewer({
    container,
    modelUrl: MODEL_URL,
    fallbackVideoUrl: FALLBACK_VIDEO_URL,
    onHotspot: triggerFulia
  }).then((handle) => {
    viewer = handle;
  });

  return {
    destroy() {
      if (activeDemo) activeDemo.stop();
      viewer?.destroy();
    }
  };
}
```

- [x] **Step 3: Ampliar `src/main.js` (versión final del sub-proyecto)**

```js
import './styles/main.css';
import { mountHeader } from './components/header.js';
import { mountHero } from './components/hero.js';
import { createDrumEngine } from './core/audio/drum-engine.js';
import { getAudioContext, unlockAudioOnFirstGesture } from './core/audio/context.js';

unlockAudioOnFirstGesture();

const engine = createDrumEngine(getAudioContext);

mountHeader(document.getElementById('site-header'));
mountHero(document.getElementById('hero'), { engine });

document.documentElement.dataset.ready = 'true';
```

- [x] **Step 4: Ejecutar la suite de tests**

Run: `npm test`
Expected: todos `passed`, `0 failed`.

- [x] **Step 5: Verificación funcional en el navegador**

Run: `npm run dev` y abre `http://localhost:5173/`

Checklist (todos deben cumplirse):
- [x] El header es sticky y su CTA dice "Próximamente" (deshabilitado).
- [x] El visor muestra el tambor multicolor, rota solo y **sigue el arrastre** al tocarlo.
- [x] El botón ♪ aparece proyectado sobre el parche y sigue al modelo al rotar.
- [x] Al hacer clic en ♪ (o en "▶ Escuchar la fulia"): la animación de golpe se dispara y **suena el patrón Guaireño** (~6 s) sin errores en consola.
- [x] En consola no hay errores rojos ni avisos de red fallida (`/assets/models/...` debe responder 200).

- [x] **Step 6: Commit**

```powershell
git add src/core/audio/demo.js src/components/hero.js src/main.js src/core/three/viewer.js
git commit -m "feat: hero con visor 3D, hotspot proyectado y demo de fulia"
```

---

### Task 9: Verificación final del sub-proyecto

**Files:**
- Modify: ninguno (solo verificación y arreglos puntuales)

- [x] **Step 1: Suite completa + build**

Run:
```powershell
npm test; if ($?) { npm run build }
```
Expected: `0 failed` y `✓ built in ...`.

- [x] **Step 2: Preview de producción**

Run: `npm run preview`
Expected: `Local: http://localhost:4173/`. Comprueba el checklist del Task 8 Step 5 sobre este servidor (no el de desarrollo).

- [x] **Step 3: Auditar Lighthouse (móvil)**

Run:
```powershell
npx lighthouse http://localhost:4173 --preset=perf --form-factor=mobile --screenEmulation.mobile --quiet --output=json --output-path=./lighthouse-report.json
```
Expected: el informe se genera (`lighthouse-report.json` está en `.gitignore`). Objetivo: **performance ≥ 90** en móvil. Si queda por debajo, aplica en este orden: (1) asegurar que three.js solo se carga tras el primer render (ya es import dinámico), (2) `loading="lazy"`/`preload` de fuentes, (3) revisar que el modelo pese < 4 MB (Task 2).

- [x] **Step 4: Revisión de accesibilidad básica**

Run: en el navegador, navega con `Tab` por el header y el hero.
Expected: foco visible en el CTA, en "Escuchar la fulia" y en el hotspot; el hotspot tiene `aria-label`.

- [x] **Step 5: Commit final**

```powershell
git add -A
git commit -m "chore: verificacion del sub-proyecto 1 (hero 3D + drum-engine)"
```
Expected: `nothing to commit` si no hubo cambios, o un commit con los ajustes detectados.

---

## Notas de ejecución

- **Orden:** los tasks son secuenciales; los tests de cada task verifican el anterior.
- **Si un test no coincide con el conteo esperado:** manda en `passed`/`failed` real sobre el número indicado; el número es orientativo y los fallos reales siempre se investigan (nunca se "arreglan" editando el test para que pase).
- **Fuera de alcance de este sub-proyecto:** catálogo/configurador, minicurso, MidiPad Pro, configuración del canal de contacto (ver spec §6, §7, §8, §9).

