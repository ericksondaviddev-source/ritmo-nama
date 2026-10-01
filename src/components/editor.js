/**
 * Editor de vídeo: monta tu clip para compartirlo.
 *
 * Lo que se ve al elegir es EXACTAMENTE lo que se descarga. La previsualización
 * es un `<video>` normal con un lienzo encima que se redibuja en cada fotograma,
 * así que es instantánea y no cuesta nada; el render de verdad, que tarda, sólo
 * ocurre al pulsar descargar y va en segundo plano (ver `core/media/trabajos.js`).
 *
 * Lo único que se escribe a mano es el nombre. El resto son plantillas, a
 * propósito: ver `core/media/plantillas.js` para por qué.
 */
import { FORMATOS, MAX_NOMBRE, NOMBRE_POR_DEFECTO, PLANTILLAS, plantillaPorId } from '../core/media/plantillas.js';
import { dibujarFotograma } from '../core/media/dibujar.js';
import { exportarClip, elegirFormato, puedeExportar } from '../core/media/video-export.js';
import { lanzarTrabajo, trabajoActual } from '../core/media/trabajos.js';

/** Los clips que se pueden editar. Todos verticales, del taller. */
const CLIPES = [
  { id: 'diseno-azul', src: '/assets/video/diseno-azul.mp4', titulo: 'Diseño Azul' },
  { id: 'multicolor', src: '/assets/video/multicolor-estrella.mp4', titulo: 'Estrella multicolor' },
  { id: 'paseo', src: '/assets/video/paseo-taller.mp4', titulo: 'Paseo por el taller' },
  { id: 'en-la-plaza', src: '/assets/video/en-la-plaza.mp4', titulo: 'En la plaza, en familia' },
  { id: 'recorrido', src: '/assets/video/recorrido-taller.mp4', titulo: 'Recorrido por el taller' },
  { id: 'madera-clara', src: '/assets/video/madera-clara.mp4', titulo: 'Madera clara' }
];

export function mountEditor(root) {
  if (!root) return null;

  root.className = 'border-b border-zinc-900 py-16';
  root.innerHTML = `
    <div class="mx-auto max-w-6xl px-4">
      <div class="max-w-2xl">
        <span class="text-xs font-bold uppercase tracking-widest text-amber-500">Comparte</span>
        <h2 id="editor-title" class="mt-2 text-3xl font-extrabold tracking-tight text-zinc-50 sm:text-4xl">
          Monta tu clip <span class="text-amber-400">con la marca</span>
        </h2>
        <p class="mt-3 text-zinc-400">
          Elige un vídeo, ponle tu nombre y descarga. Se hace aquí mismo, en tu
          móvil: el fichero no se sube a ningún sitio.
        </p>
      </div>

      <div class="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
        <div class="space-y-5">
          <fieldset>
            <legend class="text-xs font-black uppercase tracking-wide text-zinc-400">1 · El vídeo</legend>
            <div data-clips class="mt-2 grid grid-cols-2 gap-2">
              ${CLIPES.map(
                (c, i) => `
                <button
                  type="button"
                  data-clip="${c.id}"
                  aria-pressed="${i === 0}"
                  class="rounded-xl border-2 border-zinc-800 px-3 py-2.5 text-left text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-600 aria-pressed:border-amber-400 aria-pressed:text-amber-300"
                >${c.titulo}</button>`
              ).join('')}
            </div>
          </fieldset>

          <fieldset>
            <legend class="text-xs font-black uppercase tracking-wide text-zinc-400">2 · La plantilla</legend>
            <div data-plantillas class="mt-2 grid grid-cols-2 gap-2">
              ${PLANTILLAS.map(
                (p, i) => `
                <button
                  type="button"
                  data-plantilla="${p.id}"
                  aria-pressed="${i === 0}"
                  title="${p.descripcion}"
                  class="rounded-xl border-2 border-zinc-800 px-3 py-2.5 text-left text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-600 aria-pressed:border-amber-400 aria-pressed:text-amber-300"
                >${p.nombre}</button>`
              ).join('')}
            </div>
            <p data-desc-plantilla class="mt-2 text-xs text-zinc-500"></p>
          </fieldset>

          <div>
            <label for="editor-nombre" class="text-xs font-black uppercase tracking-wide text-zinc-400">
              3 · Tu nombre
            </label>
            <input
              id="editor-nombre"
              data-nombre
              type="text"
              maxlength="${MAX_NOMBRE}"
              placeholder="${NOMBRE_POR_DEFECTO}"
              autocomplete="off"
              class="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
            />
            <p class="mt-1.5 text-xs text-zinc-500">
              Hasta ${MAX_NOMBRE} caracteres. Si lo dejas vacío usamos «${NOMBRE_POR_DEFECTO}».
            </p>
          </div>

          <fieldset>
            <legend class="text-xs font-black uppercase tracking-wide text-zinc-400">4 · El formato</legend>
            <div data-formatos class="mt-2 flex gap-2">
              ${Object.values(FORMATOS)
                .map(
                  (f, i) => `
                <button
                  type="button"
                  data-formato="${f.id}"
                  aria-pressed="${f.id === 'vertical'}"
                  class="flex-1 rounded-xl border-2 border-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-600 aria-pressed:border-amber-400 aria-pressed:text-amber-300"
                >${f.etiqueta}</button>`
                )
                .join('')}
            </div>
          </fieldset>

          <button
            type="button"
            data-descargar
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3.5 text-sm font-bold text-zinc-950 transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true">⭳</span> Descargar el clip
          </button>
          <p data-aviso class="hidden text-xs text-amber-400/90"></p>
          <p class="text-xs text-zinc-500">
            El vídeo se monta aquí, fotograma a fotograma. Puede tardar entre 10 y
            40 segundos, según el teléfono.
          </p>
        </div>

        <div>
          <h3 class="text-sm font-black uppercase tracking-wide text-zinc-400">Así se va a ver</h3>
          <div class="mt-2 flex justify-center">
            <div data-marco class="relative w-full max-w-[300px] overflow-hidden rounded-3xl bg-zinc-950 shadow-2xl">
              <video data-preview-video src="" loop muted playsinline preload="metadata" class="block w-full"></video>
              <canvas data-preview-lienzo class="pointer-events-none absolute inset-0 block h-full w-full"></canvas>
            </div>
          </div>
          <p data-estado class="mt-3 text-center text-xs text-zinc-500" role="status" aria-live="polite"></p>
        </div>
      </div>
    </div>`;

  const video = root.querySelector('[data-preview-video]');
  const lienzo = root.querySelector('[data-preview-lienzo]');
  const ctx = lienzo.getContext('2d');
  const nombreInput = root.querySelector('[data-nombre]');
  const botonDescargar = root.querySelector('[data-descargar]');
  const aviso = root.querySelector('[data-aviso]');
  const estado = root.querySelector('[data-estado]');
  const descPlantilla = root.querySelector('[data-desc-plantilla]');

  const seleccion = { clip: CLIPES[0], plantilla: PLANTILLAS[0], formato: FORMATOS.vertical };

  /** Ajusta el lienzo al tamaño de salida del formato elegido. */
  function ajustarLienzo() {
    const { ancho, alto } = seleccion.formato;
    if (lienzo.width !== ancho || lienzo.height !== alto) {
      lienzo.width = ancho;
      lienzo.height = alto;
    }
  }

  function pintar() {
    ajustarLienzo();
    dibujarFotograma(ctx, {
      fotograma: video.readyState >= 2 ? video : null,
      plantilla: seleccion.plantilla,
      nombre: nombreInput.value,
      formato: seleccion.formato
    });
  }

  // Un solo bucle, siempre activo mientras haya vídeo: redibuja el lienzo por
  // fotograma del vídeo. Es barato (son unas formas de texto) y es lo que hace
  // que la previsualización vaya en vivo.
  let pedido = 0;
  function bucle() {
    if (video.readyState >= 2) pintar();
    else pintar(); // sin fotograma aún: se ve la plantilla sola
    requestAnimationFrame(bucle);
  }
  requestAnimationFrame(bucle);

  async function cargarClip(clip) {
    seleccion.clip = clip;
    estado.textContent = 'Cargando el vídeo…';
    // El `preload="metadata"` de más arriba es para la primera; a partir de aquí
    // hay que tener el fichero entero para poder dibujarlo.
    video.src = clip.src;
    video.load();
    try {
      await video.play();
    } catch {
      // Autoplay bloqueado: se ve el primer fotograma y ya está.
    }
    estado.textContent = `${clip.titulo} · en bucle`;
  }

  for (const boton of root.querySelectorAll('[data-clip]')) {
    boton.addEventListener('click', () => {
      marcar(root, '[data-clip]', 'clip', boton.dataset.clip);
      cargarClip(CLIPES.find((c) => c.id === boton.dataset.clip));
    });
  }

  for (const boton of root.querySelectorAll('[data-plantilla]')) {
    boton.addEventListener('click', () => {
      const p = plantillaPorId(boton.dataset.plantilla);
      seleccion.plantilla = p;
      descPlantilla.textContent = p.descripcion;
      marcar(root, '[data-plantilla]', 'plantilla', p.id);
      pintar();
    });
  }
  descPlantilla.textContent = seleccion.plantilla.descripcion;

  for (const boton of root.querySelectorAll('[data-formato]')) {
    boton.addEventListener('click', () => {
      seleccion.formato = FORMATOS[boton.dataset.formato];
      marcar(root, '[data-formato]', 'formato', boton.dataset.formato);
      ajustarLienzo();
      pintar();
    });
  }

  // Cada tecla redibuja: así se ve el nombre exactamente como va a salir.
  let temporizador = null;
  nombreInput.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(pintar, 60);
  });

  // El aviso del formato real se mira una vez, al montar.
  (async () => {
    if (!puedeExportar()) {
      botonDescargar.disabled = true;
      aviso.textContent =
        'Este navegador no puede exportar vídeo. En un móvil, prueba con Chrome o con Safari actualizado.';
      aviso.classList.remove('hidden');
      return;
    }
    const eleccion = await elegirFormato();
    if (eleccion) {
      estado.textContent = `Se descargará en ${eleccion.etiqueta}`;
    }
  })();

  botonDescargar.addEventListener('click', async () => {
    botonDescargar.disabled = true;
    aviso.classList.add('hidden');

    // El render necesita el fichero entero; la previsualización sólo tenía los
    // metadatos.
    const blob = await descargarFichero(seleccion.clip.src);

    lanzarTrabajo({
      ejecutar: (informe) =>
        exportarClip({
          blob,
          plantilla: seleccion.plantilla,
          nombre: nombreInput.value,
          formato: seleccion.formato,
          alProgresar: informe
        })
    });
    botonDescargar.disabled = false;
  });

  cargarClip(seleccion.clip);

  return {
    destroy() {
      void pedido;
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  };
}

/** Marca el botón pulsado de un grupo y quita la marca a los demás. */
function marcar(root, selector, attr, valor) {
  for (const b of root.querySelectorAll(selector)) {
    b.setAttribute('aria-pressed', String(b.dataset[attr] === valor));
  }
}

/** Baja un fichero para poder trabajar con él como Blob. */
async function descargarFichero(src) {
  const r = await fetch(src);
  if (!r.ok) throw new Error('No se pudo cargar el vídeo.');
  return r.blob();
}

/** Para los tests: el estado de trabajo, por si el componente quiere reflejarlo. */
export { trabajoActual };