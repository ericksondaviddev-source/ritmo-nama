/**
 * Transporte exclusivo: sólo una cosa puede sonar a la vez.
 *
 * El minicurso, el estudio rítmico y el exportador de vídeo usan el mismo motor
 * de audio. Si el visitante deja sonando un loop del curso y pulsa «Tocar» en el
 * Midipad, antes se escuchaban dos ritmos superpuestos: dos rejillas a la vez es
 * ruido, no música.
 *
 * Aquí cada reproductor toma el token al arrancar y lo suelta al parar. Quien
 * tenga el token entrega el suyo. Es un módulo sin estado propio por instancia,
 * pensado para quecomponents lo usen igual:
 *
 *   const mi = reclamar('midipad');
 *   mi.start();          // para lo que estuviera sonando
 *   mi.stop();
 *   mi.release();        // en destroy
 */
const estado = { owner: null, token: null };

export function reclamar(owner) {
  const token = Symbol(String(owner));
  return {
    start() {
      if (estado.token === token) return;
      if (estado.owner && estado.owner !== owner && typeof estado.owner.stop === 'function') {
        estado.owner.stop();
      }
      estado.owner = owner;
      estado.token = token;
    },
    /** Devuelve el transporte sólo si sigue siendo el dueño. */
    owns() {
      return estado.token === token;
    },
    stop() {
      if (estado.owner === owner) release(owner);
    },
    release() {
      release(owner);
    }
  };
}

function release(owner) {
  if (estado.owner !== owner) return;
  estado.owner = null;
  estado.token = null;
}

/** Quién está sonando ahora mismo, o null. Pensado para depurar y para tests. */
export function transporteActual() {
  return estado.owner;
}

/**
 * Variante para un reproductor que además avisa del estado (el botón Play/Pause
 * del Midipad necesita saber si le quitaron el transporte).
 */
export function reclamarConAviso(owner, alPerder) {
  const t = reclamar(owner);
  const start = t.start;
  t.start = () => {
    const anterior = estado.owner;
    start();
    if (anterior && anterior !== owner && typeof alPerder === 'function') alPerder();
  };
  return t;
}
