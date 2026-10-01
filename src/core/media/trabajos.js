/**
 * Los trabajos de render del editor de vídeo.
 *
 * Esto vive FUERA del componente a propósito. Si el estado del render estuviera
 * en el editor, al hacer scroll o al desmontarlo se perdería: el usuario empezaba
 * a exportar, iba a ver la landing y volvía a un botón que no recordaba nada, con
 * la mitad del trabajo tirada.
 *
 * Aquí el trabajo sobrevive a que el visitante recorra la página, y el indicador
 * que lo enseña es fijo, en la esquina, así que siempre se ve.
 *
 * Un solo trabajo a la vez. Dos a la vez multiplican el consumo de CPU y de
 * batería por dos, y en un Android eso se nota; además dos descargas a la vez no
 * las pide nadie.
 */

/** Fases por las que pasa un trabajo. */
export const FASE = {
  renderizando: 'renderizando',
  listo: 'listo',
  error: 'error',
  cancelado: 'cancelado'
};

/** Segundos que hay que esperar antes de enseñar una estimación de tiempo. */
const ESPERA_ETA = 2;

let estado = null;
const oyentes = new Set();
let reloj = null;

/**
 * Suscribe a los cambios de estado. Devuelve la función para darse de baja.
 * Se llama inmediatamente con el estado actual, para que quien monte tarde lo
 * mismo que quien ya estaba mirando.
 *
 * Esa primera llamada va dentro de un try: un suscriptor que lance al suscribirse
 * no puede impedir que los demás reciban el estado.
 */
export function observarTrabajo(fn) {
  oyentes.add(fn);
  try {
    fn(estado);
  } catch (e) {
    console.error('[render] suscriptor falló:', e);
  }
  return () => oyentes.delete(fn);
}

function emitir() {
  for (const fn of oyentes) {
    try {
      fn(estado);
    } catch (e) {
      // Un suscriptor roto no puede dejar de avisar a los demás.
      console.error('[render] suscriptor falló:', e);
    }
  }
}

/**
 * El trabajo en curso, o null. Lo expone el editor para pintar su propio aviso.
 */
export const trabajoActual = () => estado;

/**
 * Estimación de lo que queda, en segundos.
 *
 * Sale del tiempo que lleva y la fracción hecha, no de un promedio histórico:
 * con pocos datos cualquier promedio miente más que no decir nada.
 */
function calcularEta(progreso, transcurridoSeg) {
  if (progreso <= 0.02) return null;
  if (transcurridoSeg < ESPERA_ETA) return null;
  const restante = (transcurridoSeg / progreso) - transcurridoSeg;
  return restante > 0.5 ? Math.round(restante) : null;
}

function pararReloj() {
  if (reloj !== null) clearInterval(reloj);
  reloj = null;
}

/**
 * Arranca un trabajo. Si hay otro en marcha, lo cancela antes.
 *
 * @param {Function} ejecutar  recibe (informe) y devuelve una promesa. Se llama
 *   con `informe({ progreso })` para que avance la barra.
 * @returns {{ cancelar: Function }}
 */
export function lanzarTrabajo({ ejecutar, alTerminar }) {
  cancelarTrabajo({ silencioso: true });

  const inicio = Date.now();
  estado = {
    id: inicio,
    fase: FASE.renderizando,
    progreso: 0,
    etaSeg: null,
    nombreArchivo: null,
    blobUrl: null,
    tamanoBytes: 0,
    error: null
  };
  emitir();

  // La estimación necesita que el tiempo avance aunque no llegue progreso: si el
  // render va en un bloque largo, sin este reloj la barra se quedaría congelada y
  // parecería colgado.
  reloj = setInterval(() => {
    if (!estado || estado.fase !== FASE.renderizando) return;
    const transcurrido = (Date.now() - inicio) / 1000;
    const eta = calcularEta(estado.progreso, transcurrido);
    if (eta !== estado.etaSeg) {
      estado.etaSeg = eta;
      emitir();
    }
  }, 500);

  let progreso = 0;
  const informe = ({ progreso: p }) => {
    const valor = Math.max(0, Math.min(1, Number(p) || 0));
    if (valor <= progreso) return;
    progreso = valor;
    if (!estado || estado.fase !== FASE.renderizando) return;
    estado.progreso = valor;
    estado.etaSeg = calcularEta(valor, (Date.now() - inicio) / 1000);
    emitir();
  };

  Promise.resolve()
    .then(() => ejecutar(informe))
    .then((resultado) => {
      pararReloj();
      if (!estado || estado.fase !== FASE.renderizando) return; // se canceló
      if (!resultado?.blob) throw new Error('El render no devolvió ningún fichero.');
      estado = {
        ...estado,
        fase: FASE.listo,
        progreso: 1,
        etaSeg: 0,
        blobUrl: URL.createObjectURL(resultado.blob),
        nombreArchivo: resultado.nombre ?? 'ritmo-nama.mp4',
        tamanoBytes: resultado.blob.size ?? 0
      };
      emitir();
      alTerminar?.(resultado);
    })
    .catch((err) => {
      pararReloj();
      if (!estado || estado.fase !== FASE.renderizando) return;
      console.error('[render] falló:', err);
      estado = {
        ...estado,
        fase: FASE.error,
        etaSeg: null,
        error: err?.message ?? 'No se pudo exportar el vídeo en este navegador.'
      };
      emitir();
    });

  return { cancelar: () => cancelarTrabajo() };
}

/**
 * Cancela el trabajo en curso.
 *
 * Se marca `cancelado` para que la promesa pendiente no lo reanime: sin eso, un
 * render que termina tarde pondría "listo" encima de un trabajo que el usuario ya
 * había cancelado.
 */
export function cancelarTrabajo({ silencioso = false } = {}) {
  pararReloj();
  if (!estado || estado.fase !== FASE.renderizando) return false;
  estado = { ...estado, fase: FASE.cancelado, etaSeg: null };
  if (!silencioso) emitir();
  return true;
}

/** Cierra el trabajo y libera la URL del blob. */
export function cerrarTrabajo() {
  pararReloj();
  if (estado?.blobUrl) URL.revokeObjectURL(estado.blobUrl);
  estado = null;
  emitir();
}

/** Texto de una fase, para el indicador. */
export function textoFase(f) {
  switch (f) {
    case FASE.renderizando:
      return 'Renderizando tu vídeo';
    case FASE.listo:
      return 'Tu vídeo está listo';
    case FASE.error:
      return 'No se pudo exportar';
    case FASE.cancelado:
      return 'Exportación cancelada';
    default:
      return '';
  }
}

/** Tamaño en un formato que se lea: 1,4 MB en vez de 1468006. */
export function formatearPeso(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}