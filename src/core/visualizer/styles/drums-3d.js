/**
 * Estilo "3D": los tambores de verdad, rebotando con cada golpe.
 *
 * Usa las copias ultraligeras de `public/assets/drums/<T>/visualizador/modelo.glb`
 * (134-248 KB cada una) y las carga sólo cuando el visitante elige este estilo:
 * son 1,3 MB que no se descargan si nunca lo elige.
 *
 * Los tambores rebotan por su columna, cada uno con el color que tiene en la
 * rejilla, y giran despacio solos. El render es sobre el mismo canvas que el
 * resto de estilos, así que grabar funciona igual.
 */
/**
 * Qué tambor del catálogo representa cada uno de los cuatro del visualizador.
 *
 * No tiene por qué ser el tambor del mismo nombre: aquí importa que se distingan
 * bien a ojo. El gris plateado salió del catálogo y ocupaba el slot del cruzao,
 * así que ahora lo lleva el tricolor, que junto al turquesa es el más colorido:
 * contraste claro entre los cuatro, que es lo que un niño necesita para no
 * perder de vista quién está sonando.
 *
 * Exportado para que los tests lean este mapa en vez de duplicarlo: cuando se
 * duplicaba, cambiar un slot dejaba el test mirando un modelo que ya no existía.
 */
export const MODELOS_VISUALIZADOR = {
  prima: 'AzulRayas',
  cruzao: 'Tricolor',
  pujao: 'MaderaOscura',
  paila: 'MaderaClara'
};

export function createDrums3DVisualizer({ canvas, drums = [] }) {
  let THREE = null;
  let escena = null;
  let camara = null;
  let renderer = null;
  const Tambores = new Map(); // id -> { malla, base, fuerza }
  let cargando = true;
  let fallo = null;

  const colorDe = new Map(drums.map((d) => [d.id, d.color]));

  async function montar() {
    if (escena) return escena;
    const [tres, gltf, draco] = await Promise.all([
      import('three'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/loaders/DRACOLoader.js')
    ]);
    THREE = tres;
    const { GLTFLoader } = gltf;
    const { DRACOLoader } = draco;

    const dec = new DRACOLoader();
    dec.setDecoderPath('/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dec);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    escena = new THREE.Scene();
    // Fondo opaco: el resto de estilos pintan sobre negro y así el 3D no deja
    // transparentear la página clara por debajo del canvas.
    escena.background = new THREE.Color(0x09090b);
    camara = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camara.position.set(0, 1.15, 4.55);
    camara.lookAt(0, 0.8, 0);

    escena.add(new THREE.HemisphereLight(0xfff4e0, 0x1b1b22, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(3, 5, 4);
    escena.add(key);

    // Los cuatro tambores, uno al lado del otro, todos con la base apoyada en
    // el suelo. Cada modelo trae su geometría con el origen donde le/toque, así
    // que se mete en un grupo y se recentra sobre su propia caja: si sólo se
    // escala, el tambor queda flotando o medio enterrado.
    const ids = Object.keys(MODELOS_VISUALIZADOR);
    const cargados = await Promise.all(
      ids.map(
        (id) =>
          new Promise((res) => {
            loader.load(
              `/assets/drums/${MODELOS_VISUALIZADOR[id]}/visualizador/modelo.glb`,
              (g) => res([id, g.scene]),
              undefined,
              () => res([id, null])
            );
          })
      )
    );

    const ALTO = 1.5;
    const SEPARACION = 1.62;

    ids.forEach((id, i) => {
      const [, cargada] = cargados[i];
      if (!cargada) return;

      // 1) Escalar a un alto conocido.
      const cajaPre = new THREE.Box3().setFromObject(cargada);
      const tamPre = cajaPre.getSize(new THREE.Vector3());
      const escala = ALTO / Math.max(tamPre.y, tamPre.x, tamPre.z, 1e-6);
      cargada.scale.setScalar(escala);

      // 2) Recalcular la caja ya escalada y meter la malla en un grupo cuyo
      //    origen queda en el centro de la base del tambor.
      const caja = new THREE.Box3().setFromObject(cargada);
      const centro = caja.getCenter(new THREE.Vector3());
      const grupo = new THREE.Group();
      cargada.position.sub(centro);
      grupo.add(cargada);

      // 3) Colocar el grupo sobre el suelo, en fila y algo escalonado en
      //    profundidad para que no se tapen entre sí.
      grupo.position.set(
        (i - (ids.length - 1) / 2) * SEPARACION,
        -caja.min.y * escala,
        -i * 0.3
      );
      escena.add(grupo);
      Tambores.set(id, { malla: grupo, base: -caja.min.y * escala, fuerza: 0 });
    });

    redimensionar();
    window.addEventListener('resize', redimensionar);
    cargando = false;
    return escena;
  }

  function redimensionar() {
    if (!renderer || !camara) return;
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }

  return {
    estilo: '3d',
    // Un canvas no puede tener a la vez un contexto 2D y uno WebGL. Como los
    // otros estilos usan 2D, al entrar aquí hay que cambiar el elemento: quien
    // llama a createVisualizer lo hace con un lienzo nuevo.
    necesitaWebGL: true,
    get cargando() {
      return cargando;
    },
    get fallo() {
      return fallo;
    },

    /** Se dispara al elegir el estilo: carga los modelos y pinta el 2D mientras. */
    async iniciar() {
      try {
        await montar();
      } catch (e) {
        fallo = e;
        cargando = false;
      }
    },

    marcar(_step, golpeados) {
      for (const g of golpeados ?? []) {
        const t = Tambores.get(g.id);
        if (t) t.fuerza = g.acento ? 1 : 0.62;
      }
    },

    dibujar({ dt }) {
      // Antes de que exista el renderer NO se pinta nada en el lienzo: pedir un
      // contexto 2D aquí dejaría el elemento tomado y WebGLRenderer fallaría
      // con "Canvas has an existing context of a different type". El aviso de
      // carga lo pone el componente en el DOM, no en el canvas.
      if (!renderer || !escena) return;
      const paso = Math.min(0.05, dt || 0.016);
      for (const t of Tambores.values()) {
        t.fuerza = Math.max(0, t.fuerza - paso * 3.2);
        // Rebote: sube y vuelve con muelle.
        t.malla.position.y = t.base + t.fuerza * 0.55;
        t.malla.rotation.y += paso * 0.35;
      }
      renderer.render(escena, camara);
    },

    limpiar() {
      // El lienzo 3D lo limpia WebGL; no hay contexto 2D que tocar.
    },

    destroy() {
      window.removeEventListener('resize', redimensionar);
      renderer?.dispose();
    }
  };
}
