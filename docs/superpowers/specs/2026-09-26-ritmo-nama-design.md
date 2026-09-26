# Ritmo Na'má — Diseño de la plataforma web

**Fecha:** 2026-09-26 · **Estado:** Aprobado por el cliente
**Producto:** Landing page + mini-app interactiva (SPA) para Ritmo Na'má, distribuidores oficiales de Cuero Na'má (tambores artesanales infantiles de la fulia venezolana).

---

## 1. Objetivo y audiencia

Plataforma de alta conversión y retención dirigida a **padres**, que combina:

1. Experiencia sensorial de alta gama: estética **oscura, sofisticada, minimalista y artesanal** con Tailwind CSS.
2. Herramientas interactivas con **Web Audio API**: visor 3D, reproductor de patrones rítmicos, mini-curso animado y **MidiPad Pro** (secuenciador multipista con grabación extendida y stems).

**Métrica de éxito principal:** clic en el CTA de contacto (canal aún por definir) desde cualquier sección. **Secundaria:** tiempo en el MidiPad y loops exportados.

---

## 2. Decisiones de arquitectura (aprobadas)

| Decisión | Elección | Motivo |
|---|---|---|
| Stack | **Vite + JavaScript modular (ES Modules), sin framework** | Módulos reutilizables, bundle ligero, mobile-first, despliegue estático |
| Estilos | **Tailwind CSS compilado** (no CDN) | Rendimiento y control en producción |
| 3D | **three.js cargando los `.glb` existentes** | Fidelidad al producto real; hotspot y export 360° desde el mismo modelo |
| Estructura de páginas | **Híbrido:** landing en scroll continuo + MidiPad Pro como **vista a pantalla completa** | Conversión por scroll + experiencia de app |
| Audio | **Síntesis 100% con Web Audio API** (sin samples) | Sin dependencia de assets de audio; buffers pre-cacheados |
| Contacto | **Diferido** (`config.js` con `whatsapp \| telegram \| null`) | El cliente aún no decide el canal |
| Demo de referencia | Solo **referencia de comportamiento**; todo se reconstruye desde cero | Código reutilizable y mantenible |

---

## 3. Estructura de carpetas

```
src/
  main.js                      # bootstrap + import dinámico de secciones
  core/
    audio/drum-engine.js       # síntesis de golpes (módulo reutilizable)
    audio/scheduler.js         # lookahead scheduler (25 ms / 100 ms)
    audio/exporter.js          # OfflineAudioContext + WAV/MP3 + mezcla de voz
    three/viewer.js            # visor 3D, hotspot, materiales, export 360°
  components/
    header.js  hero.js  catalog.js  minicourse.js  midipad.js
  data/
    drums.js  patterns.js  catalog.js  config.js   # contenido = datos, no código
  styles/                      # Tailwind entry + tokens de diseño
public/assets/                 # GLB optimizados, videos .mp4/.webm, fotos
docs/superpowers/specs/        # este documento
```

**Regla de módulos:** cada módulo tiene una única responsabilidad, expone una interfaz pública clara y no conoce el interior de los demás. `drum-engine` no depende de DOM ni de three.js.

---

## 4. Estándares de rendimiento

- **Pipeline `gltf-transform`** sobre los GLB (hoy 47–52 MB por archivo, causado por 3 texturas PNG sin comprimir; la geometría son solo ~69k vértices):
  - Texturas a ≤ 2048 px, formato WebP/JPEG.
  - Compresión meshopt + DRACO.
  - **Objetivo: < 4 MB por modelo** sin pérdida visual perceptible.
- **Import dinámico** de three.js y del MidiPad (solo cuando se usan). Presupuesto de JS inicial: **< 150 KB gzip**.
- Audio: `AudioContext` creado en el **primer gesto del usuario**; ruido/buffers precacheados; síntesis en el momento → **latencia de pad < 50 ms**.
- Playhead del secuenciador animado por **CSS/transform vía refs**, sin re-render de estado por step.
- Lighthouse mobile objetivo: **≥ 90**.

---

## 5. Fase 1 — Header + Hero

- **Header** sticky: marca "Ritmo Na'má" + subtítulo "por Cuero Na'má" + **CTA de contacto persistente** (canal configurable).
- **Hero:** titular emocional/cultural sobre percusión infantil + **visor 3D** del `Drumkidmulticolor3D.glb` con rotación libre 360° (auto-rotación suave que se pausa al interactuar).
- **Hotspot sobre el parche:** al presionarlo se ejecuta
  1. animación visual de golpe (impacto + onda expansiva), y
  2. la **demostración rítmica completa de fulia** (patrón *Guaireño Tradicional*, swing 40 %).
- **Fallback:** sin WebGL o fallo de carga → video `.mp4` con el mismo hotspot y audio.

---

## 6. Fase 2 — Catálogo / Configurador 3D

**Productos (data en `catalog.js`):**

| Nombre | Asset | Precio |
|---|---|---|
| Drumkid Multicolor | `Drumkidmulticolor3D.glb` | 49 $ |
| Drumkid Clásico | `Drumkid3D.glb` | 49 $ |
| Set Na'má (exhibidor de diseños) | `Mostradordrums.glb` | 49 $ por unidad |
| **Personaliza el tuyo** (tarjeta CTA, no producto) | — | — |

**Kit incluido (49 $):** doble parche sintético impermeable, **baqueta** profesional, forro de tela de obsequio, garantía de 6 meses, acceso al minicurso y a la mini-app.

- Tarjetas con **reel de video corto** (`.mp4`, ~1.2 MB) en hover/tap.
- Visor 3D central con rotación libre y **selector de acabados en tiempo real**: madera del cilindro · parches · splatter (recorrido de materiales del GLB por nombre y tinte en `material.color`).
- **Export de clip 360°:** render de la rotación del modelo personalizado → `canvas.captureStream()` + `MediaRecorder` → archivo descargable.

---

## 7. Fase 3 — Mini-curso de fulia (4 módulos)

Tarjetas interactivas para **Prima, Cruzao, Pujao, Paila**, cada una con:

1. Concepto cultural.
2. Técnica de ejecución ergonómica para niños.
3. Patrón visual esquemático.
4. Botón de reproducción de audio real en loop, con **baja latencia** (sonido sintetizado por `drum-engine`, no un clip de ejemplo).

Los textos culturales los valida el cliente antes de la implementación de esta fase.

---

## 8. Fase 4 — MidiPad Pro (vista a pantalla completa)

- **6 filas de stems:** Prima, Cruzao, Pujao, Paila + Maracas y Cuatro (opcionales).
- Grid de **12 pasos en métrica 6/8**.
- Acento en **3 estados** por celda (vacío → normal → acento).
- **BPM 80–180**, slider de **swing/tumbao 0–60 %**, 4 presets culturales (Guaireño Tradicional, San Millán/Naiguatá, Tarma/Chichiriviche, Repique de Costa).
- **Mixer por stem:** volumen, pan, afinación, solo/mute + volumen master.
- **Scheduler lookahead** (setInterval de 25 ms que agenda 100 ms por delante sobre el reloj de `AudioContext`), con corrección de swing por step.
- **Grabación de loops de hasta 60 s.**
- **Grabación de voz opcional** por micrófono (`getUserMedia` + `MediaRecorder`), como capa sobre la base rítmica.
- **Export final** con voz + rítmica **ya mezcladas**. Formato: **WAV 16 bits real por defecto**; MP3 solo si se incorpora lamejs al bundle (decisión técnica en el plan de la Fase 4). Nunca un WAV renombrado con extensión/ MIME de MP3.
- Pads táctiles multi-touch con pre-warm de síntesis.

---

## 9. Canal de contacto (diferido)

`src/data/config.js`:

```js
export const contact = {
  channel: null,          // 'whatsapp' | 'telegram' | null
  number: null,           // ej. '584121234567'
  messages: { hero: '', catalog: '', midipad: '' }  // mensaje preconfigurado por sección
};
```

Mientras `channel` sea `null`, los CTAs muestran estado "próximamente" (sin enlaces rotos). Decisión final del cliente: al cierre del proyecto.

---

## 10. Manejo de errores

| Caso | Comportamiento |
|---|---|
| WebGL no disponible / GLB falla | Video `.mp4` de respaldo con hotspot equivalente |
| `AudioContext` suspendido | Aviso "toca para activar el sonido"; se resuelve en el primer gesto |
| Micrófono denegado | Mensaje amigable infantil: "¡Pide permiso a tus papás…" |
| `MediaRecorder` no soportado | El botón de export se deshabilita con aviso de formato |
| Error de red al cargar assets | Reintento + fallback al poster estático |

---

## 11. Plan de construcción (sub-proyectos)

Cada sub-proyecto tiene su propio ciclo spec → plan → implementación:

1. **Sub-proyecto 1 (inicio):** scaffolding Vite + Tailwind, pipeline `gltf-transform`, **DrumEngine** (motor de audio reutilizable) + **Header y Hero 3D** con hotspot.
2. **Sub-proyecto 2:** Catálogo / Configurador 3D + export de clip 360°.
3. **Sub-proyecto 3:** Minicurso de fulia (4 tarjetas).
4. **Sub-proyecto 4:** MidiPad Pro completo.
5. **Sub-proyecto 5:** Pulido, Lighthouse, pruebas en dispositivo y deploy.

---

## 12. Verificación

- Tests unitarios con **Vitest** para `drum-engine` (firma de onda por golpe) y `patterns` (forma de los datos).
- Prueba manual en Chrome/Safari móvil: latencia de pads, autoplay policy, export.
- **Lighthouse mobile ≥ 90** antes del deploy.
- Revisión de accesibilidad: contraste en tema oscuro, foco visible, `prefers-reduced-motion`.

---

## 13. Fuera de scope

- Generador de video "Video-Ritmos" de la demo de referencia.
- Backend, base de datos, carrito o pagos en línea.
- Estética infantil clara de la demo (la dirección es oscura/artesanal).
- Decisión y configuración del canal de contacto (ver §9).
