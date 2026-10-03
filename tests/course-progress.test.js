import { describe, expect, it } from 'vitest';
import {
  CLAVE_PROGRESO,
  cargarProgreso,
  guardarProgreso,
  marcarPatron,
  marcarVista,
  registrarQuiz,
  reiniciarProgreso,
  resumenProgreso
} from '../src/core/course-progress.js';

function fakeStorage() {
  const mapa = new Map();
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: (k) => mapa.delete(k),
    mapa
  };
}

describe('progreso del minicurso', () => {
  it('sin datos devuelve el estado vacío', () => {
    const p = cargarProgreso(fakeStorage());
    expect(p.vistas).toEqual([]);
    expect(p.patrones).toEqual([]);
    expect(p.quiz).toEqual({ mejor: 0, rondas: 0 });
  });

  it('guarda y recarga el progreso completo', () => {
    const s = fakeStorage();
    let p = cargarProgreso(s);
    p = marcarVista(p, 'prima');
    p = marcarPatron(p, 'cruzao');
    p = registrarQuiz(p, 3, 4);
    expect(guardarProgreso(p, s)).toBe(true);

    const otra = cargarProgreso(s);
    expect(otra.vistas).toEqual(['prima']);
    expect(otra.patrones).toEqual(['cruzao']);
    expect(otra.quiz).toEqual({ mejor: 75, rondas: 1 });
  });

  it('no duplica marcas repetidas y no muta el original', () => {
    const base = cargarProgreso(fakeStorage());
    const p1 = marcarVista(base, 'prima');
    const p2 = marcarVista(p1, 'prima');
    expect(p2.vistas).toEqual(['prima']);
    expect(base.vistas).toEqual([]);
    expect(p1).not.toBe(base);
  });

  it('resiste datos corruptos y versiones ajenas', () => {
    const s = fakeStorage();
    s.setItem(CLAVE_PROGRESO, '{no-json');
    expect(cargarProgreso(s).vistas).toEqual([]);
    s.setItem(CLAVE_PROGRESO, JSON.stringify({ version: 999, vistas: ['prima'] }));
    expect(cargarProgreso(s).vistas).toEqual([]);
  });

  it('registrarQuiz conserva la mejor puntuación y cuenta rondas', () => {
    let p = cargarProgreso(fakeStorage());
    p = registrarQuiz(p, 2, 4); // 50%
    p = registrarQuiz(p, 4, 4); // 100%
    p = registrarQuiz(p, 1, 4); // 25% → no baja el mejor
    expect(p.quiz).toEqual({ mejor: 100, rondas: 3 });
  });

  it('el resumen refleja lecciones, quiz y prácticas', () => {
    let p = cargarProgreso(fakeStorage());
    expect(resumenProgreso(p)).toMatchObject({ completados: 0, total: 9, pct: 0 });
    p = marcarVista(p, 'prima');
    p = marcarVista(p, 'paila');
    p = marcarPatron(p, 'prima');
    p = registrarQuiz(p, 4, 4);
    const r = resumenProgreso(p);
    expect(r).toMatchObject({ vistas: 2, patrones: 1, quizHecho: true, completados: 4, pct: 44 });
  });

  it('reiniciarProgreso limpia el almacenamiento', () => {
    const s = fakeStorage();
    guardarProgreso(marcarVista(cargarProgreso(s), 'prima'), s);
    const vacio = reiniciarProgreso(s);
    expect(vacio.vistas).toEqual([]);
    expect(s.getItem(CLAVE_PROGRESO)).toBe(null);
  });
});
