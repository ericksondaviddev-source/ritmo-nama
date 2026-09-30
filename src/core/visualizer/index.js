/**
 * Visualizador del estudio rítmico.
 *
 * Es una VISTA de la composición que se está tocando, no un reproductor: no
 * tiene reloj propio ni dispara audio, sólo recibe los pasos del scheduler y
 * dibuja. Por eso lo que se ve es exactamente lo que se oye, y por eso grabar
 * la salida es igual de fácil en cualquier estilo: todos pintan en el mismo
 * canvas.
 *
 * Un estilo implementa `dibujar(ctx, t)` y recibe en `marcar` la lista de
 * tambores que suenan en el paso actual, con su instante de audio para que la
 * animación ocurra cuando toca y no antes.
 */
import { createCanvasVisualizer } from './styles/canvas-2d.js';
import { createAsciiVisualizer } from './styles/ascii.js';
import { createFiestaVisualizer } from './styles/fiesta.js';
import { createDrums3DVisualizer } from './styles/drums-3d.js';

export const ESTILOS = [
  {
    id: 'barras',
    nombre: 'Barras',
    descripcion: 'Lo clásico: una barra por paso',
    crear: createCanvasVisualizer
  },
  {
    id: 'ascii',
    nombre: 'ASCII',
    descripcion: 'Los tambores en letras y símbolos',
    crear: createAsciiVisualizer
  },
  {
    id: 'fiesta',
    nombre: 'Fiesta',
    descripcion: 'Brillo, partículas y confeti en los acentos',
    crear: createFiestaVisualizer
  },
  {
    id: '3d',
    nombre: '3D',
    descripcion: 'Los tambores de verdad, rebotando',
    necesitaWebGL: true,
    crear: createDrums3DVisualizer
  }
];

export const estiloPorId = (id) => ESTILOS.find((e) => e.id === id) ?? ESTILOS[0];

/**
 * @param {object} opciones
 * @param {HTMLCanvasElement} opciones.canvas
 * @param {object}   opciones.composicion  snapshot() del midipad
 * @param {Function} opciones.alTocarElRitmo (step, time, golpeados) => fn
 * @param {object}   opciones.drums  { id, color, name } para colores
 * @param {string}   opciones.estilo
 */
export function createVisualizer({
  canvas: lienzoInicial,
  composicion,
  alTocarElRitmo,
  drums = [],
  estilo = 'barras',
  getContext = null
} = {}) {
  if (!lienzoInicial) return null;
  let lienzo = lienzoInicial;
  const ctx = lienzo.getContext('2d');
  if (!ctx) return null;
  let alCambiarLienzo = null;

  const def = estiloPorId(estilo);
  // Un estilo que quiere WebGL no debe pedir contexto 2D: si se lo pedimos
  // primero, el elemento queda tomado y WebGLRenderer falla con
  // "Canvas has an existing context of a different type".
  const crear = (c) =>
    def.necesitaWebGL
      ? def.crear({ canvas: c, ctx: null, drums, getContext, composicion })
      : def.crear({ canvas: c, ctx: c.getContext('2d'), drums, getContext, composicion });
  const vista = crear(lienzo);
  if (!vista) return null;

  /**
   * Un canvas sólo admite un tipo de contexto. Para el estilo 3D hace falta
   * WebGL, así que se sustituye el elemento por uno gemelo y se avisa a quien
   * lo graba (el grabador de vídeo necesita el elemento nuevo).
   */
  function lienzoNuevo() {
    const gemelo = document.createElement('canvas');
    gemelo.width = lienzo.width;
    gemelo.height = lienzo.height;
    for (const clase of lienzo.classList) gemelo.classList.add(clase);
    // Se copian los data-* para que quien lo busque por atributo lo siga
    // encontrando tras el cambio de estilo.
    for (const attr of lienzo.attributes) {
      if (attr.name.startsWith('data-')) gemelo.setAttribute(attr.name, attr.value);
    }
    gemelo.setAttribute('aria-label', lienzo.getAttribute('aria-label') ?? 'Visualizador de tu ritmo');
    lienzo.replaceWith(gemelo);
    lienzo = gemelo;
    alCambiarLienzo?.(gemelo);
    return gemelo;
  }

  // Colas de pasos agendados. El scheduler adelanta ~100 ms, así que el dibujo
  // no puede seguir la llamada: sólo cuando el reloj de audio alcanza su instante.
  let cola = [];
  let pasoActivo = -1;
  let inicioDelPaso = 0;
  let ultimo = performance.now();
  let corriendo = false;
  let fotograma = null;
  let suelto = null;

  const duracionPaso = () => {
    const bpm = composicion?.state?.bpm ?? 124;
    return 60 / bpm / 2; // 6/8: dos pasos por tiempo
  };

  function alTocar(step, time, golpeados) {
    if (!corriendo) return;
    cola.push({ step, time, golpeados });
  }

  function avanzarCola(now) {
    let avanzo = false;
    while (cola.length && cola[0].time <= now) {
      const v = cola.shift();
      pasoActivo = v.step;
      inicioDelPaso = v.time;
      avanzo = true;
      vista.marcar(v.step, v.golpeados, v.time);
    }
    if (!cola.length && avanzo && !inicioDelPaso) inicioDelPaso = now;
  }

  function bucle() {
    fotograma = null;
    if (!corriendo) return;
    const ahora = performance.now();
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    avanzarCola(ahora / 1000);
    const progreso = inicioDelPaso
      ? Math.min(Math.max((ahora / 1000 - inicioDelPaso) / duracionPaso(), 0), 1)
      : 0;
    vista.dibujar({ paso: pasoActivo, progreso, dt, duracion: duracionPaso() });
    fotograma = requestAnimationFrame(bucle);
  }

  /**
   * Copia un estilo sobre `vista` conservando sus getters. `Object.assign`
   * leería `cargando` una sola vez (true) y dejaría un valor congelado, así
   * que el aviso de "cargando modelos 3D" no se apagaría nunca.
   */
  function mezclar(destino, fuente) {
    for (const [clave, desc] of Object.entries(
      Object.getOwnPropertyDescriptors(fuente)
    )) {
      if (typeof desc.get === 'function' || typeof desc.set === 'function') {
        Object.defineProperty(destino, clave, {
          get: desc.get,
          set: desc.set,
          enumerable: true,
          configurable: true
        });
      } else {
        destino[clave] = fuente[clave];
      }
    }
  }

  return {
    estilo: def.id,
    nombreEstilo: def.nombre,
    setAlCambiarLienzo(fn) {
      alCambiarLienzo = fn;
    },
    get isRunning() {
      return corriendo;
    },
    start() {
      if (corriendo) return;
      corriendo = true;
      cola = [];
      pasoActivo = -1;
      inicioDelPaso = 0;
      ultimo = performance.now();
      suelto = alTocarElRitmo?.(alTocar) ?? null;
      vista.iniciar?.();
      bucle();
    },
    stop() {
      corriendo = false;
      cola = [];
      pasoActivo = -1;
      inicioDelPaso = 0;
      if (fotograma !== null) cancelAnimationFrame(fotograma);
      fotograma = null;
      suelto?.();
      suelto = null;
      vista.detener?.();
      vista.limpiar?.();
    },
    /** Cambia de estilo en caliente sin perder la grabación en curso. */
    async setEstilo(id) {
      const nuevo = estiloPorId(id);
      if (nuevo.id === vista.estilo) return true;
      const estabaCorriendo = corriendo;
      if (estabaCorriendo) this.stop();

      // Si el estilo nuevo quiere WebGL y este lienzo ya tiene contexto 2D,
      // hay que cambiar el elemento antes de construirlo.
      if (nuevo.necesitaWebGL) {
        const yaWebGL = vista.necesitaWebGL;
        if (!yaWebGL) {
          const nuevoLienzo = lienzoNuevo();
          const conWebgl = nuevo.crear({
            canvas: nuevoLienzo,
            ctx: null,
            drums,
            getContext,
            composicion
          });
          if (!conWebgl) return false;
          mezclar(vista, conWebgl);
        }
      } else {
        // Si veníamos de 3D, este lienzo tiene contexto WebGL y hay que
        // sustituirlo también para poder pintar en 2D.
        if (vista.necesitaWebGL) lienzoNuevo();
        const siguiente = nuevo.crear({
          canvas: lienzo,
          ctx: lienzo.getContext('2d'),
          drums,
          getContext,
          composicion
        });
        if (!siguiente) return false;
        mezclar(vista, siguiente);
      }

      Object.defineProperty(vista, 'estilo', { value: nuevo.id, configurable: true });
      this.estilo = nuevo.id;
      this.nombreEstilo = nuevo.nombre;
      if (estabaCorriendo) this.start();
      return true;
    },
    /** true mientras el estilo 3D baja sus modelos. Los demás, siempre false. */
    get cargando() {
      return vista.cargando === true;
    },
    destroy() {
      this.stop();
      vista.destroy?.();
    }
  };
}
