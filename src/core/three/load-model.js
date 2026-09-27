export function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

// Todo lo pesado se importa en diferido: three.js no entra en el bundle inicial
export async function loadGltf(modelUrl) {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(modelUrl);
  return { THREE, model: gltf.scene };
}

export async function importOrbitControls() {
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  return OrbitControls;
}

// Centra y escala el modelo en el origen (target = tamaño máximo del lado en unidades de vista)
export function fitModel(THREE, model, target = 1.9) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = target / Math.max(size.x, size.y, size.z, 1e-6);
  model.scale.setScalar(scale);
  model.position.copy(center).multiplyScalar(-scale);
  return { box, center, size, scale };
}
