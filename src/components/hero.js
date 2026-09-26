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
