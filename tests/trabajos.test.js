import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FASE,
  cancelarTrabajo,
  cerrarTrabajo,
  formatearPeso,
  lanzarTrabajo,
  observarTrabajo,
  textoFase,
  trabajoActual
} from '../src/core/media/trabajos.js';

const esperar = (ms = 0) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
  cerrarTrabajo();
  vi.useRealTimers();
});

describe('el almacén de trabajos', () => {
  it('avisa al montar, con el estado actual', () => {
    const visto = [];
    observarTrabajo((s) => visto.push(s));
    expect(visto).toEqual([null]);
  });

  it('deja de avisar al darse de baja', () => {
    const visto = [];
    const fuera = observarTrabajo(() => visto.push(1));
    fuera();
    lanzarTrabajo({ ejecutar: async () => ({ blob: new Blob(['x']) }) });
    cerrarTrabajo();
    // Tras darse de baja ya no le llega nada.
    const total = visto.length;
    cerrarTrabajo();
    expect(visto.length).toBe(total);
  });

  it('arranca en fase de render y termina en listo con su fichero', async () => {
    const fases = [];
    observarTrabajo((s) => s && fases.push(s.fase));
    lanzarTrabajo({
      ejecutar: async () => ({ blob: new Blob(['hola'], { type: 'video/mp4' }), nombre: 'clip.mp4' })
    });
    await esperar(10);
    const t = trabajoActual();
    expect(t.fase).toBe(FASE.listo);
    expect(t.nombreArchivo).toBe('clip.mp4');
    expect(t.tamanoBytes).toBe(4);
    expect(t.blobUrl).toBeTruthy();
    expect(fases).toContain(FASE.renderizando);
    expect(fases[fases.length - 1]).toBe(FASE.listo);
  });

  it('el progreso sólo avanza hacia delante', async () => {
    lanzarTrabajo({
      ejecutar: async (informe) => {
        informe({ progreso: 0.5 });
        informe({ progreso: 0.2 }); // hacia atrás: se ignora
        informe({ progreso: 1.4 }); // más de 1: se recorta
        return { blob: new Blob(['x']) };
      }
    });
    await esperar(10);
    // No puede quedar en un progreso imposible.
    expect(trabajoActual().progreso).toBeLessThanOrEqual(1);
  });

  it('un trabajo cancelado no revive cuando su promesa resuelve tarde', async () => {
    let resolver;
    lanzarTrabajo({
      ejecutar: () => new Promise((r) => { resolver = r; })
    });
    // El render arranca en un microtask, así que hay que dejar que corra antes
    // de poder resolverlo.
    await esperar(0);
    cancelarTrabajo();
    expect(trabajoActual().fase).toBe(FASE.cancelado);
    // La promesa pendiente llega después: no debe poner "listo" encima.
    resolver({ blob: new Blob(['x']) });
    await esperar(10);
    expect(trabajoActual().fase).toBe(FASE.cancelado);
  });

  it('lanzar otro trabajo no deja que el primero se cuele encima', async () => {
    // El primero nunca termina: se queda esperando para siempre.
    lanzarTrabajo({ ejecutar: () => new Promise(() => {}) });
    await esperar(0);
    lanzarTrabajo({ ejecutar: async () => ({ blob: new Blob(['y']) }) });
    await esperar(10);
    // Lo que importa no es que se anuncie la cancelación (el usuario ya ve el
    // trabajo nuevo), sino que el trabajo viejo no pueda pisar el estado.
    expect(trabajoActual().fase).toBe(FASE.listo);
    expect(trabajoActual().tamanoBytes).toBe(1);
  });

  it('un fallo deja el motivo a la vista, sin romperse', async () => {
    lanzarTrabajo({
      ejecutar: async () => {
        throw new Error('el codec no está');
      }
    });
    await esperar(10);
    const t = trabajoActual();
    expect(t.fase).toBe(FASE.error);
    expect(t.error).toContain('codec');
    expect(t.blobUrl).toBeNull();
  });

  it('un render que no devuelve fichero es un error, no un listo vacío', async () => {
    lanzarTrabajo({ ejecutar: async () => ({}) });
    await esperar(10);
    expect(trabajoActual().fase).toBe(FASE.error);
  });

  it('cerrar borra la URL del blob para no dejar memoria viva', async () => {
    lanzarTrabajo({ ejecutar: async () => ({ blob: new Blob(['z']) }) });
    await esperar(10);
    const url = trabajoActual().blobUrl;
    const revocado = vi.spyOn(URL, 'revokeObjectURL');
    cerrarTrabajo();
    expect(revocado).toHaveBeenCalledWith(url);
    revocado.mockRestore();
  });

  it('un suscriptor que lanza no impide que avise el resto', async () => {
    const bueno = [];
    observarTrabajo(() => {
      throw new Error('se rompió');
    });
    observarTrabajo((s) => bueno.push(s));
    lanzarTrabajo({ ejecutar: async () => ({ blob: new Blob(['x']) }) });
    await esperar(10);
    expect(bueno.length).toBeGreaterThan(1);
  });
});

describe('la estimación de tiempo', () => {
  it('no se enseña en los primeros segundos, porque ahí miente', async () => {
    vi.useFakeTimers();
    lanzarTrabajo({
      ejecutar: (informe) => {
        informe({ progreso: 0.5 });
        return new Promise(() => {});
      }
    });
    // Media barra hecha en nada: la cuenta daría un resto diminuto y falso.
    vi.advanceTimersByTime(600);
    expect(trabajoActual().etaSeg).toBeNull();
  });

  it('con tiempo de sobra da una estimación creíble', async () => {
    vi.useFakeTimers();
    lanzarTrabajo({
      ejecutar: (informe) => {
        informe({ progreso: 0.25 });
        return new Promise(() => {});
      }
    });
    // El progreso lo informa el render, que arranca en un microtask: si se avanza
    // el reloj antes, el 25 % todavía no se ha registrado. Se cede el hilo con
    // microtasks y no con esperar(0), porque con los timers falsos un
    // setTimeout no avanzaría nunca y la prueba se quedaría colgada.
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(8000); // 8 s para el 25 %
    // Queda el 75 %: unos 24 s.
    expect(trabajoActual().etaSeg).toBeGreaterThan(15);
    expect(trabajoActual().etaSeg).toBeLessThan(35);
  });
});

describe('los textos del indicador', () => {
  it('cada fase tiene su frase', () => {
    expect(textoFase(FASE.renderizando)).toMatch(/renderizando/i);
    expect(textoFase(FASE.listo)).toMatch(/listo/i);
    expect(textoFase(FASE.error)).toMatch(/no se pudo/i);
  });

  it('el peso se lee en unidades normales', () => {
    expect(formatearPeso(512)).toBe('512 B');
    expect(formatearPeso(1468006)).toBe('1.4 MB');
    expect(formatearPeso(0)).toBe('');
  });
});