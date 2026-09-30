import { playFuliaDemo } from '../core/audio/demo.js';
import { getAudioContext } from '../core/audio/context.js';
import { createViewer } from '../core/three/viewer.js';
import { HERO } from '../data/catalog.js';

const MODEL_URL = HERO.modelo;
const FALLBACK_VIDEO_URL = HERO.videoFondo;

// El markup del hero es HTML estático en index.html (el FCP pinta sin esperar JS):
// este módulo solo hidrata eventos y monta el visor.
export function mountHero(root, { engine } = {}) {
  if (!root) return null;

  const container = root.querySelector('[data-viewer]');
  const playButton = root.querySelector('[data-play-demo]');
  let activeDemo = null;

  /**
   * Fondo de vídeo. En un móvil con datos limitados son 345 KB que no aportan
   * mucho, así que se respeta `saveData`; y si el usuario pidió menos
   * movimiento, se congela el primer fotograma (el póster) en vez de animar.
   */
  const fondo = root.querySelector('[data-hero-video]');
  const fondoVideo = root.querySelector('[data-hero-video-el]');
  let playFondo = null;

  function arrancarFondo() {
    if (!fondo || !fondoVideo) return;
    const pocoMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const datosLimitados = Boolean(navigator.connection?.saveData);
    if (pocoMovimiento || datosLimitados) {
      fondo.dataset.pausado = 'true';
      return;
    }
    fondoVideo.src = fondoVideo.querySelector('source')?.src ?? '';
    playFondo = fondoVideo.play();
    if (playFondo?.catch) playFondo.catch(() => {}); // si el móvil lo bloquea, sigue el póster
  }

  function detenerFondo() {
    if (!fondoVideo) return;
    fondoVideo.pause();
    if (playFondo?.catch) playFondo.catch(() => {});
  }

  if ('IntersectionObserver' in window) {
    // No se reproduce un vídeo que nadie está mirando: en móvil eso es batería.
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) fondoVideo.play().catch(() => {});
          else fondoVideo.pause();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(fondo);
  }
  if (document.readyState === 'complete') arrancarFondo();
  else window.addEventListener('load', arrancarFondo, { once: true });

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
  const startViewer = () =>
    createViewer({
      container,
      modelUrl: MODEL_URL,
      fallbackVideoUrl: FALLBACK_VIDEO_URL,
      onHotspot: triggerFulia
    }).then((handle) => {
      viewer = handle;
    });
  // Difiere three.js hasta después del load + idle: el primer pintado (FCP) no debe
  // esperar la descarga/parseo del visor 3D
  const startViewerWhenIdle = () => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(startViewer, { timeout: 1500 });
    } else {
      setTimeout(startViewer, 64);
    }
  };
  if (document.readyState === 'complete') startViewerWhenIdle();
  else window.addEventListener('load', startViewerWhenIdle, { once: true });

  return {
    destroy() {
      if (activeDemo) activeDemo.stop();
      detenerFondo();
      io?.disconnect();
      viewer?.destroy();
    }
  };
}
