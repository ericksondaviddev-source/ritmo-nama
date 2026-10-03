import { fitModel, hasWebGL, importOrbitControls, loadGltf } from './load-model.js';

const HOTSPOT_ID = 'drum-hotspot';

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

function findDrumheadAnchor(THREE, model) {
  // Debe llamarse tras aplicar escala/posición: trabaja en ESPACIO MUNDO
  model.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(model);
  const span = box.max.y - box.min.y;
  if (!(span > 0)) return null;

  const BUCKETS = 50;
  const buckets = Array.from({ length: BUCKETS }, () => ({ n: 0, sx: 0, sy: 0, sz: 0 }));
  const v = new THREE.Vector3();
  let sampled = 0;

  model.traverse((obj) => {
    const pos = obj.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
      const b = Math.max(0, Math.min(BUCKETS - 1, Math.floor(((v.y - box.min.y) / span) * BUCKETS)));
      const t = buckets[b];
      t.n += 1;
      t.sx += v.x;
      t.sy += v.y;
      t.sz += v.z;
      sampled += 1;
    }
  });

  if (!sampled) return null;
  // La banda horizontal más densa cruza el centro del parche visible
  let best = buckets[0];
  for (const t of buckets) if (t.n > best.n) best = t;
  if (!best.n) return null;
  return new THREE.Vector3(best.sx / best.n, best.sy / best.n, best.sz / best.n);
}

export async function createViewer({ container, modelUrl, fallbackVideoUrl, onHotspot }) {
  if (!container) return null;
  if (!hasWebGL()) return mountFallback(container, { fallbackVideoUrl, onHotspot });

  container.innerHTML =
    '<div class="flex h-full w-full items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-500">Cargando tambor…</div>';

  try {
    const { THREE, model } = await loadGltf(modelUrl);
    const OrbitControls = await importOrbitControls();
    const { box, center, size, scale } = fitModel(THREE, model, 1.9);

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 3.6);

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

    // Ancla en la banda horizontal más densa (centro del parche visible), en espacio mundo
    const headWorld =
      findDrumheadAnchor(THREE, model) ?? new THREE.Vector3(0, (size.y * scale) / 2, 0);
    const projected = new THREE.Vector3();

    // Tamaños cacheados: leer layout cada frame provoca forced reflow
    let viewW = container.clientWidth || width;
    let viewH = container.clientHeight || height;
    let spotW = hotspot.offsetWidth;
    let spotH = hotspot.offsetHeight;

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      viewW = w;
      viewH = h;
      spotW = hotspot.offsetWidth;
      spotH = hotspot.offsetHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    let frame = 0;
    let visible = true;
    function render() {
      frame = 0;
      if (!visible) return;
      // Durante la exportación de MP4 la página se congela (clase
      // `exportando`): este bucle es independiente del visualizador principal
      // y seguía renderizando el 3D a 17 fps, saturando la GPU software y
      // dejando al codificador de vídeo sin tiempo (exportación a ~1 fps).
      // Se mantiene vivo el rAF pero sin trabajo: al terminar la exportación
      // el render continúa solo.
      if (document.documentElement.classList.contains('exportando')) {
        frame = requestAnimationFrame(render);
        return;
      }
      frame = requestAnimationFrame(render);
      controls.update();

      projected.copy(headWorld).project(camera);
      const halfW = spotW / 2 + 2;
      const halfH = spotH / 2 + 2;
      const x = Math.min(Math.max((projected.x * 0.5 + 0.5) * viewW, halfW), viewW - halfW);
      const y = Math.min(Math.max((-projected.y * 0.5 + 0.5) * viewH, halfH), viewH - halfH);
      hotspot.style.left = `${x}px`;
      hotspot.style.top = `${y}px`;
      hotspot.style.opacity = projected.z > 1 ? '0' : '1';

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

    return {
      destroy() {
        cancelAnimationFrame(frame);
        visibilityObserver.disconnect();
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
