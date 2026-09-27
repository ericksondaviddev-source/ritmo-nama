import { playFuliaDemo } from '../core/audio/demo.js';
import { getAudioContext } from '../core/audio/context.js';
import { createViewer } from '../core/three/viewer.js';

const MODEL_URL = '/assets/models/Drumkidmulticolor3D.glb';
const FALLBACK_VIDEO_URL = '/assets/video/Drumkidmulticolor3D.mp4';

// El markup del hero es HTML estático en index.html (el FCP pinta sin esperar JS):
// este módulo solo hidrata eventos y monta el visor.
export function mountHero(root, { engine } = {}) {
  if (!root) return null;

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
      viewer?.destroy();
    }
  };
}
