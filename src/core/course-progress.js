/**
 * Progreso del minicurso en localStorage.
 *
 * Todo es plano y serializable para que guardarlo sea un JSON de tres líneas:
 * `vistas` (lecciones escuchadas), `patrones` (práctica completada) y
 * `quiz` (mejor puntuación). Cualquier dato corrupto o de otra versión se
 * descarta y se empieza de cero: el progreso es un extra, no puede romper la
 * sección.
 */

export const CLAVE_PROGRESO = 'ritmonama-curso';
export const VERSION_PROGRESO = 1;
export const TOTAL_LECCIONES = 4;

const VACIO = () => ({
  version: VERSION_PROGRESO,
  vistas: [],
  patrones: [],
  quiz: { mejor: 0, rondas: 0 }
});

function storageReal(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function cargarProgreso(storage) {
  const s = storageReal(storage);
  if (!s) return VACIO();
  try {
    const bruto = s.getItem(CLAVE_PROGRESO);
    if (!bruto) return VACIO();
    const dato = JSON.parse(bruto);
    if (!dato || typeof dato !== 'object' || dato.version !== VERSION_PROGRESO) return VACIO();
    return {
      version: VERSION_PROGRESO,
      vistas: Array.isArray(dato.vistas) ? dato.vistas.filter((x) => typeof x === 'string') : [],
      patrones: Array.isArray(dato.patrones) ? dato.patrones.filter((x) => typeof x === 'string') : [],
      quiz:
        dato.quiz && typeof dato.quiz === 'object'
          ? {
              mejor: Number.isFinite(dato.quiz.mejor) ? dato.quiz.mejor : 0,
              rondas: Number.isFinite(dato.quiz.rondas) ? dato.quiz.rondas : 0
            }
          : { mejor: 0, rondas: 0 }
    };
  } catch {
    return VACIO();
  }
}

export function guardarProgreso(progreso, storage) {
  const s = storageReal(storage);
  if (!s) return false;
  try {
    s.setItem(CLAVE_PROGRESO, JSON.stringify(progreso));
    return true;
  } catch {
    return false;
  }
}

function agregar(lista, valor) {
  return lista.includes(valor) ? lista : [...lista, valor];
}

/** Marca una lección como vista. Devuelve el progreso nuevo (el viejo no se muta). */
export function marcarVista(progreso, instrument) {
  return { ...progreso, vistas: agregar(progreso.vistas ?? [], instrument) };
}

/** Marca la práctica de patrón de una lección como completada. */
export function marcarPatron(progreso, instrument) {
  return { ...progreso, patrones: agregar(progreso.patrones ?? [], instrument) };
}

/**
 * Registra una ronda de quiz. `aciertos` va de 0 a `total`.
 * `mejor` conserva la mayor puntuación porcentual alcanzada.
 */
export function registrarQuiz(progreso, aciertos, total) {
  const n = Number.isFinite(total) && total > 0 ? total : 1;
  const pct = Math.round((Math.max(0, Math.min(aciertos, n)) / n) * 100);
  const quiz = progreso.quiz ?? { mejor: 0, rondas: 0 };
  return {
    ...progreso,
    quiz: { mejor: Math.max(quiz.mejor ?? 0, pct), rondas: (quiz.rondas ?? 0) + 1 }
  };
}

export function reiniciarProgreso(storage) {
  const s = storageReal(storage);
  const vacio = VACIO();
  if (s) {
    try {
      s.removeItem(CLAVE_PROGRESO);
    } catch {
      /* almacenamiento no disponible */
    }
  }
  return vacio;
}

/** Resumen para la barra de progreso: 4 lecciones + quiz + 4 prácticas. */
export function resumenProgreso(progreso) {
  const vistas = (progreso.vistas ?? []).length;
  const patrones = (progreso.patrones ?? []).length;
  const quizHecho = (progreso.quiz?.rondas ?? 0) > 0;
  const pasos = [
    ...Array.from({ length: TOTAL_LECCIONES }, (_, i) => i < vistas),
    quizHecho,
    ...Array.from({ length: TOTAL_LECCIONES }, (_, i) => i < patrones)
  ];
  const completados = pasos.filter(Boolean).length;
  return {
    vistas,
    patrones,
    quizHecho,
    quizMejor: progreso.quiz?.mejor ?? 0,
    completados,
    total: pasos.length,
    pct: Math.round((completados / pasos.length) * 100)
  };
}
