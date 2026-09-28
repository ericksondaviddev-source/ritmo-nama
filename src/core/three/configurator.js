import { fitModel, hasWebGL, importOrbitControls, loadGltf } from './load-model.js';

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
    start360: async () => null,
    isRecording: () => false,
    destroy() {
      container.innerHTML = '';
    }
  };
}

export async function createConfigurator({ container, modelUrl, fallbackVideoUrl }) {
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

    // Estado: modelo actual + grabación
    let currentModel = model;
    let recording = false;
    let loadToken = 0;

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
    let visible = true;
    function render() {
      frame = 0;
      if (!visible) return;
      frame = requestAnimationFrame(render);
      controls.update(clock.getDelta());
      renderer.render(scene, camera);
    }
    render();

    // Pausa el render fuera de pantalla (batería y estabilidad del Speed Index)
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        const now = entries.some((en) => en.isIntersecting);
        if (now === visible) return;
        visible = now;
        if (visible && !frame) render();
        if (!visible && frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { rootMargin: '100px' }
    );
    visibilityObserver.observe(container);

    const handle = {
      async setModel(url) {
        const token = ++loadToken;
        const { model: next } = await loadGltf(url);
        if (token !== loadToken) {
          disposeModel(next);
          return false; // una carga más rápida lo ganó
        }
        fitModel(THREE, next, 1.9);
        scene.remove(currentModel);
        disposeModel(currentModel);
        scene.add(next);
        currentModel = next;
        return true;
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
        visibilityObserver.disconnect();
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
