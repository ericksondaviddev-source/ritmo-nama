/**
 * Grabación de lo que se ve y se oye en el estudio.
 *
 * El audio sale del master del motor por un MediaStreamDestination, igual que
 * el grabador de voz; el vídeo, del canvas del visualizador. Los dos se mezclan
 * en un MediaStream y MediaRecorder lo escribe.
 *
 * MP4: Android y Safari lo graban de origen (H.264 + AAC), así que en móvil es
 * lo natural. Si el navegador no lo soporta se cae a WebM y se avisa: es mejor
 * un fichero que se puede abrir que un botón que no hace nada.
 *
 * El límite es de tiempo real, no de render: grabar 5 minutos tarda 5 minutos.
 */
const CANDIDATOS = [
  { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4', etiqueta: 'MP4' },
  { mime: 'video/mp4', ext: 'mp4', etiqueta: 'MP4' },
  { mime: 'video/webm;codecs=vp9,opus', ext: 'webm', etiqueta: 'WebM' },
  { mime: 'video/webm;codecs=vp8,opus', ext: 'webm', etiqueta: 'WebM' },
  { mime: 'video/webm', ext: 'webm', etiqueta: 'WebM' }
];

export const MAX_SIN_LIMITE = Infinity;

export function formatoSoportado() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const c of CANDIDATOS) {
    if (MediaRecorder.isTypeSupported?.(c.mime)) return c;
  }
  return null;
}

export const puedeGrabar = () =>
  Boolean(formatoSoportado()) && typeof HTMLCanvasElement.prototype.captureStream === 'function';

/**
 * @param {object} opciones
 * @param {HTMLCanvasElement} opciones.canvas  lienzo del visualizador
 * @param {object}  opciones.engine   motor de audio, para sacar el master
 * @param {Function} opciones.getContext
 * @param {number}  opciones.limiteSeg  300 para 5 min, MAX_SIN_LIMITE
 */
export function createGrabador({ canvas, engine, getContext, limiteSeg: limiteInicial = 300, alCambiarEstado = null } = {}) {
  let grabador = null;
  let destinoAudio = null;
  let flujoVideo = null;
  let trozos = [];
  let cronometro = null;
  let limite = null;
  let limiteSeg = limiteInicial;
  let grabando = false;
  let inicioMs = 0;
  let lienzo = canvas;
  const formato = formatoSoportado();

  function estado(txt) {
    alCambiarEstado?.(txt);
  }

  function limpiar() {
    destinoAudio?.stream.getTracks().forEach((t) => t.stop());
    destinoAudio = null;
    flujoVideo?.getTracks().forEach((t) => t.stop());
    flujoVideo = null;
  }

  function parar() {
    if (cronometro !== null) clearInterval(cronometro);
    cronometro = null;
    if (limite !== null) clearTimeout(limite);
    limite = null;
  }

  async function grabar() {
    if (grabando || !puedeGrabar() || !formato) return { ok: false, motivo: 'Este navegador no puede grabar vídeo.' };
    const ctx = getContext?.();
    if (!ctx) return { ok: false, motivo: 'No se pudo iniciar el audio.' };

    engine.connectOutput((destinoAudio = ctx.createMediaStreamDestination()));
    flujoVideo = lienzo.captureStream(30);
    const mezclado = new MediaStream([
      ...flujoVideo.getVideoTracks(),
      ...destinoAudio.stream.getAudioTracks()
    ]);

    try {
      grabador = new MediaRecorder(mezclado, {
        mimeType: formato.mime,
        videoBitsPerSecond: 4_500_000
      });
    } catch {
      limpiar();
      return { ok: false, motivo: 'No se pudo iniciar la grabación.' };
    }

    trozos = [];
    grabador.ondataavailable = (e) => {
      if (e.data?.size) trozos.push(e.data);
    };
    grabador.start(1000);
    grabando = true;
    inicioMs = performance.now();
    estado('Grabando…');

    cronometro = setInterval(() => {
      const s = Math.floor((performance.now() - inicioMs) / 1000);
      estado(`Grabando… ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    }, 250);

    programarLimite();

    return { ok: true, formato: formato.etiqueta };
  }

  /**
   * Rearma el corte automático. Se recalcula desde el tiempo ya grabado, para
   * que cambiar el selector a mitad de una toma no le regale ni le quite
   * segundos: el plazo siempre se mide sobre el inicio real.
   */
  function programarLimite() {
    if (limite !== null) clearTimeout(limite);
    limite = null;
    if (!Number.isFinite(limiteSeg)) return;
    const transcurrido = grabando ? (performance.now() - inicioMs) / 1000 : 0;
    const restante = limiteSeg - transcurrido;
    // Si ya se pasó el límite, se corta de inmediato en vez de esperar en balde.
    limite = setTimeout(() => detener(), Math.max(0, restante) * 1000);
  }

  function detener() {
    parar();
    if (!grabador || grabador.state === 'inactive') return null;
    return new Promise((resolve) => {
      grabador.onstop = () => {
        const blob = new Blob(trozos, { type: formato.mime.split(';')[0] });
        const segundos = Math.round((performance.now() - inicioMs) / 1000);
        trozos = [];
        grabador = null;
        grabando = false;
        limpiar();
        estado('');
        resolve({ blob, segundos, formato: formato.etiqueta, ext: formato.ext });
      };
      grabador.stop();
    });
  }

  return {
    formato: formato?.etiqueta ?? null,
    /**
     * El visualizador cambia de elemento al pasar al estilo 3D (un canvas no
     * puede tener 2D y WebGL a la vez). Sin esto, se grabaría un lienzo viejo
     * en negro.
     */
    setLienzo(nuevo) {
      lienzo = nuevo;
    },
    /**
     * El límite se mide en tiempo real, no de render. Antes este valor era un
     * parámetro de cierre: asignarlo desde fuera creaba una propiedad nueva en
     * el objeto devuelto y el `setTimeout` seguía con el valor viejo, así que
     * elegir "sin límite" no alargaba nada. Aquí sí reprograma el corte, incluso
     * con la grabación ya en curso.
     */
    set limiteSeg(valor) {
      limiteSeg = valor;
      if (grabando) programarLimite();
    },
    get limiteSeg() {
      return limiteSeg;
    },
    get grabando() {
      return grabando;
    },
    get segundos() {
      return grabando ? Math.floor((performance.now() - inicioMs) / 1000) : 0;
    },
    grabar,
    detener,
    destroy() {
      parar();
      if (grabador && grabador.state !== 'inactive') grabador.stop();
      limpiar();
    }
  };
}

/** Descarga un blob con el nombre que toque. */
export function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // El revoke se difiere: hacerlo al instante puede cancelar la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
