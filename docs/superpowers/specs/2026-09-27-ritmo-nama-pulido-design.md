# Ritmo Na'má — Pulido final: identidad, tema, audio v2 y video export

**Fecha:** 2026-09-27
**Estado:** aprobado por el cliente ("si apruebo... ejecuta")

## 1. Objetivo

Cerrar la landing para su lanzamiento: identidad visual (logo/favicon), tema claro "solar" con glassmorphism, personalización honesta por catálogo, sección de contacto completa, síntesis de audio v2 en capas, minicurso mejorado (textos expandidos + paila corregida + narración TTS) y video export del estudio rítmico.

## 2. Decisiones aprobadas

1. **Sonidos:** síntesis en capas mejorada (Web Audio API); sin grabaciones por ahora.
2. **Audio del minicurso:** ambos — narración TTS de la explicación + botón de patrón existente.
3. **Personalizar:** por catálogo — se elimina el tinte en vivo (inconsistente con la textura horneada); elegir modelo + paleta de colores de referencia → mensaje pre-armado por WhatsApp.
4. **Contacto:** WhatsApp — el número + Instagram + TikTok los pasa el cliente al cierre; el canal queda configurable (`src/data/config.js`) y se activa solo al configurarlo.
5. **Catálogo:** nuevos modelos los pasa el cliente (GLB + video corto + foto); estructura data-driven lista para admitirlos.
6. **Tema claro:** "solar", con toggle en header, persistencia y glassmorphism en paneles (no a página completa).
7. **Video export:** canvas + MediaRecorder en el navegador; sin Remotion/HyperFrames ni servidor.

## 3. Identidad visual (logo + favicon)

- SVG artesanal: tambor de fulia estilizado (cuerpo con splatter sutil, dos baquetas en X) + wordmark "Ritmo Na'má".
- Variante clara/oscura vía `currentColor` para respetar el tema.
- `favicon.svg` actualizado: tambor en ámbar sobre fondo oscuro.
- Logo en el header (reemplaza el wordmark de texto plano).

## 4. Tema claro "solar" + glassmorphism

- Paleta solar: crema (#faf6ee), ámbar profundo (#b45309), terracota (#c2410c), texto café oscuro (#3f2d1d).
- Implementación con tokens: `[data-theme="solar"]` sobrescribe las variables de `@theme` y las utilidades de sección; botón ☀️/🌙 en el header; persistencia en `localStorage`; primera visita respeta `prefers-color-scheme`; transición de colores suave.
- Glassmorphism en paneles de las 4 secciones: `backdrop-blur-md` + fondo translúcido + borde luminoso sutil. No a página completa (protege el FCP).

## 5. Personalización por catálogo + contacto

- Configurador: se eliminan `regions`/`applyRegions`/`setTint` (tinte en vivo); conserva rotación libre, cambio de modelo y export 360°.
- Panel "Personaliza tu tambor": paleta de colores de referencia (Splatter Clásico, Rojo Fulia, Azul Guaira, Verde Tambor, Negro Caoba) con swatch + nombre; el botón abre WhatsApp con mensaje pre-armado (modelo + acabado elegido).
- Nueva sección `#contacto`: CTA grande, texto de venta (kit, garantía, minicurso incluido) y canal configurable; sin enlaces rotos mientras `channel` sea null (spec §9 del diseño original).

## 6. Audio v2 (síntesis en capas)

- Cada golpe = capas: cuerpo grave (oscilador con caída de tono), parche (ruido bandpass + slap), borde (resonancia breve), reverb por convolución con impulso procedural + envelopes mejoradas.
- Se mantiene la firma `trigger(id, { time, volume, pan, pitchShift, accent, context })` — backward-compatible; los tests existentes deben seguir pasando (ajustes solo si la firma de las voces cambia semánticamente).
- Verificación: tests del engine + comparación en navegador.

## 7. Minicurso mejorado

- Textos expandidos: concepto cultural más rico (La Guaira/Barlovento/Curiepe, Cruz de Mayo 3–31 mayo), técnica ergonómica y contexto por módulo.
- **Paila corregida: se toca con las manos** (golpes de palma y dedos) — investigado; marcado para validación del cliente.
- Narración TTS por tarjeta (edge-tts en build → MP3 en `public/assets/audio/course/`) con botón de audio narrado, junto al botón de patrón existente.

## 8. Video export del estudio rítmico

- Visualizador en canvas 2D sincronizado al reloj de `AudioContext`.
- Selector de **stems visibles** (checkboxes) y **estilo de animación** (ondas circulares, barras, anillos reactivos).
- `MediaRecorder` sobre `canvas.captureStream()` + pista de audio del `MediaStreamDestination` → WebM/MP4 descargable. 100% en el navegador.

## 9. Verificación

- Tests unitarios (Vitest) para las piezas puras; checks de navegador por sección; a11y Tab; Lighthouse (sin regresión: glassmorphism solo en paneles).

## 10. Fuera de scope

- Grabaciones reales del tambor (fase futura si el cliente pasa audios).
- Assets nuevos de catálogo (el cliente los pasa; se agregan entonces).
- Deploy (requiere hosting).
