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
    const scale = 2.1 / Math.max(size.x, size.y, size.z);

    model.scale.setScalar(scale);
    model.position.copy(center).multiplyScalar(-scale);

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.55, 3.3);

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

    // Centro del parche en coordenadas de mundo (el modelo está centrado en el origen)
    const headWorld = new THREE.Vector3(0, (size.y * scale) / 2, 0);
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
      hotspot.style.left = `${(projected.x * 0.5 + 0.5) * rect.width}px`;
      hotspot.style.top = `${(-projected.y * 0.5 + 0.5) * rect.height}px`;
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
