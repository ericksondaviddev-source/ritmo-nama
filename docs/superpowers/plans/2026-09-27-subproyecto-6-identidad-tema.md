# Sub-proyecto 6 — Identidad, tema solar y pulido UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps usan checkbox.

**Goal:** Logo + favicon artesanales, tema claro "solar" con toggle persistente, glassmorphism en paneles, personalización por catálogo (sin tinte en vivo), sección de contacto completa y estructura lista para nuevos modelos.

**Architecture:** Tema vía variables CSS de Tailwind v4 (los overrides de `[data-theme="solar"]` cambian la paleta zinc/amber global — las utilidades de v4 leen vars CSS). Glassmorphism con clase `.glass` (vars `--glass-*`). El configurador pierde el tinte (se eliminan `regions.js` + tests, 9 tests menos). El contacto se activa cuando el cliente pase el número.

**Spec:** `docs/superpowers/specs/2026-09-27-ritmo-nama-pulido-design.md` §3-5.

---

### Task 1: Logo + favicon

**Files:** Modify `index.html` (header), Rewrite `public/favicon.svg`

- [ ] **Step 1: Favicon nuevo** — tambor en ámbar sobre fondo oscuro (ver `docs/superpowers/specs` §3): elipse del parche + cuerpo + lazos en zigzag + splatter + baquetas en X.
- [ ] **Step 2: Logo en el header** — SVG inline (currentColor) + wordmark existente.
- [ ] **Step 3: Verificar en navegador + commit** — `git commit -m "feat: logo y favicon artesanales de Ritmo Nama"`

### Task 2: Tema claro solar + toggle

**Files:** Modify `src/styles/main.css`, `index.html`, `src/components/header.js`, Create `src/components/theme-toggle.js`

- [ ] **Step 1:** Overrides `[data-theme="solar"]` de las vars `--color-zinc-*` y `--color-amber-*` (crema #faf6ee fondo, café #3f2d1d texto, ámbar profundo #b45309) + transición suave en body/.glass.
- [ ] **Step 2:** Script inline en `<head>` que aplica el tema antes del primer pintado (localStorage `ritmonama-theme` ?? `prefers-color-scheme`).
- [ ] **Step 3:** Botón ☀️/🌙 en el header con aria-label; persiste en localStorage.
- [ ] **Step 4:** Verificar (toggle funciona, sin flash) + commit — `git commit -m "feat: tema claro solar con toggle persistente"`

### Task 3: Glassmorphism en paneles

**Files:** Modify `src/styles/main.css`, los paneles de hero/catálogo/curso/midipad/contacto

- [ ] **Step 1:** Clase `.glass` en `main.css`: fondo translúcido (var), `backdrop-blur`, borde `--glass-border` (blanco/12 en oscuro, café/14 en solar).
- [ ] **Step 2:** Aplicar `.glass` a tarjetas y paneles (reemplaza `bg-zinc-900(/60)` + border).
- [ ] **Step 3:** Verificar + commit — `git commit -m "feat: glassmorphism en paneles de las secciones"`

### Task 4: Personalización por catálogo

**Files:** Modify `src/core/three/configurator.js`, `src/components/catalog.js`, `src/data/catalog.js`, `src/data/config.js`, `tests/catalog.test.js`, `tests/data.test.js`; Delete `src/core/three/regions.js`, `tests/regions.test.js`

- [ ] **Step 1:** `config.js`: `whatsappLink(message)` (canal-aware) + `PALETTES` en catalog.js (5 acabados de referencia con 3 colores c/u) + tests (whatsappLink, palettes).
- [ ] **Step 2:** Configurador sin tinte: quitar `applyRegions`/`setTint`/`hasRegions`/`getTints`/imports de regions; API = `setModel(url)`, `start360`, `isRecording`, `destroy`.
- [ ] **Step 3:** catalog.js: eliminar FINISHES/FINISH_ZONES/fieldset de radios → panel "Personaliza tu tambor": swatches por paleta + CTA WhatsApp con mensaje pre-armado (`Hola, quiero un {modelo} con acabado {paleta}`); "Próximamente" si canal null.
- [ ] **Step 4:** Eliminar `src/core/three/regions.js` + `tests/regions.test.js`.
- [ ] **Step 5:** Suite + verify-catalog actualizado (paletas en vez de tints) + commit — `git commit -m "feat: personalizacion por catalogo con mensaje pre-armado"`

### Task 5: Sección de contacto completa

**Files:** Create `src/components/contact.js`, Modify `index.html`, `src/main.js`, `src/data/config.js` (redes: instagram/tiktok null por ahora)

- [ ] **Step 1:** Sección `#contacto`: heading, copy de venta (kit, garantía, minicurso incluido), CTA grande de WhatsApp, chips del kit, redes sociales (solo si están configuradas).
- [ ] **Step 2:** Monte + tests de data (whatsappLink con redes) + commit — `git commit -m "feat: seccion de contacto completa con redes configurables"`

### Task 6: Verificación final

- [ ] Suite completa, build, checks de navegador (todas las secciones), a11y (tema + glass no rompen foco), Lighthouse (sin regresión), commit final.
