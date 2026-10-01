import { describe, expect, it } from 'vitest';
import {
  FORMATOS,
  MAX_NOMBRE,
  NOMBRE_POR_DEFECTO,
  PLANTILLAS,
  plantillaPorId,
  repartirNombre
} from '../src/core/media/plantillas.js';

/**
 * Medidor falso: cada carácter mide `px * (porCaracter / 10)`, así la aritmética
 * es previsible. El tamaño base por defecto está calculado para que el texto por
 * defecto quepa en una línea con ancho 1000, que es el caso de partida.
 */
function medidorFalso({ ancho = 1000, porCaracter = 10, tamanoBase = 34 } = {}) {
  return {
    ancho,
    tamano: tamanoBase,
    texto: (t, px) => t.length * px * (porCaracter / 10)
  };
}

describe('formatos', () => {
  it('son 9:16 y 16:9, con las medidas esperadas', () => {
    expect(FORMATOS.vertical).toMatchObject({ ancho: 1080, alto: 1920 });
    expect(FORMATOS.horizontal).toMatchObject({ ancho: 1920, alto: 1080 });
    // El formato de cada uno tiene que ser el que dice su nombre.
    expect(FORMATOS.vertical.alto / FORMATOS.vertical.ancho).toBeCloseTo(16 / 9, 2);
    expect(FORMATOS.horizontal.ancho / FORMATOS.horizontal.alto).toBeCloseTo(16 / 9, 2);
  });
});

describe('plantillas', () => {
  it('hay seis, con id único y datos para dibujar', () => {
    expect(PLANTILLAS).toHaveLength(6);
    expect(new Set(PLANTILLAS.map((p) => p.id)).size).toBe(6);
    for (const p of PLANTILLAS) {
      expect(p.nombre, p.id).toBeTruthy();
      expect(p.descripcion, p.id).toBeTruthy();
      expect(['arriba', 'abajo'], p.id).toContain(p.texto);
      expect(['izquierda', 'centro'], p.id).toContain(p.alineacion);
      expect(['transparente', 'ambar', 'oscuro'], p.id).toContain(p.fondo);
      expect(p.tamano, p.id).toBeGreaterThan(0.04);
      expect(p.tamano, p.id).toBeLessThan(0.15);
    }
  });

  it('ninguna plantilla deja el nombre encima del vídeo si dice que no', () => {
    // videoEncogido tiene que mover el vídeo, si no el texto lo tapa.
    for (const p of PLANTILLAS.filter((x) => x.videoEncogido)) {
      expect(p.texto, p.id).toBe('abajo');
    }
  });

  it('la búsqueda por id cae en la primera si no existe', () => {
    expect(plantillaPorId('baile').id).toBe('baile');
    expect(plantillaPorId('no-existe').id).toBe(PLANTILLAS[0].id);
  });
});

describe('el campo del nombre', () => {
  it('usa el texto por defecto si viene vacío', () => {
    const r = repartirNombre('', medidorFalso());
    expect(r.lineas).toEqual([NOMBRE_POR_DEFECTO]);
  });

  it('colapsa los espacios que se cuelan al copiar y pegar', () => {
    const r = repartirNombre('  Ana   María  ', medidorFalso({ porCaracter: 4 }));
    expect(r.lineas).toEqual(['Ana María']);
  });

  it('deja un nombre corto en una sola línea', () => {
    const r = repartirNombre('Ana', medidorFalso({ porCaracter: 4 }));
    expect(r.lineas).toHaveLength(1);
  });

  it('parte en dos líneas y las deja lo más parejas posible', () => {
    const r = repartirNombre('María José上面的敲击', medidorFalso({ porCaracter: 10, ancho: 400 }));
    expect(r.lineas.length).toBeGreaterThan(1);
    expect(r.lineas.length).toBeLessThanOrEqual(2);
    for (const l of r.lineas) expect(l.length).toBeGreaterThan(0);
  });

  it('nunca devuelve más de dos líneas', () => {
    // Aunque el texto sea enorme, el recorte tiene que dejarlo en dos.
    const r = repartirNombre(
      'un nombre wirklich larguísimo que no cabe de ninguna manera en dos líneas',
      medidorFalso({ porCaracter: 40, ancho: 300 })
    );
    expect(r.lineas.length).toBeLessThanOrEqual(2);
  });

  it('encoge la letra antes que dejar el texto fuera', () => {
    const ancho = 700;
    const corto = repartirNombre('Ana María', medidorFalso({ ancho, porCaracter: 20 }));
    const largo = repartirNombre(
      'María José Rodríguez',
      medidorFalso({ ancho, porCaracter: 20 })
    );
    // El nombre largo no puede acabar con letra más grande que el corto.
    expect(largo.tamanoPx).toBeLessThanOrEqual(corto.tamanoPx);
  });

  it('no parte palabras por la mitad al partir en dos líneas', () => {
    const r = repartirNombre('Ana María José', medidorFalso({ porCaracter: 12, ancho: 320 }));
    const unido = r.lineas.join(' ');
    expect(unido).toContain('Ana');
    // Si una palabra se hubiera cortado, no se podría reconstituir el original.
    expect(unido.replace(/\s+/g, ' ')).toBe('Ana María José');
  });

  it('marca con puntos suspensivos lo que no cabe ni encogido', () => {
    const r = repartirNombre('Supercalifragilisticoespialidoso', medidorFalso({ porCaracter: 60, ancho: 200 }));
    expect(r.lineas.length).toBeLessThanOrEqual(2);
    expect(r.lineas.join('')).toContain('…');
  });

  it('el límite de caracteres cabe en el lienzo sin recortarse', () => {
    // Lo que se garantiza es que 40 caracteres SEAN ESCRIBIBLES: un nombre
    // realista de ese largo tiene que salir entero, aunque sea en dos líneas.
    // Si no, el `maxlength` del campo estaría mintiendo y nadie podría escribir
    // ni su nombre. Se mide con el tamaño de letra más grande de las plantillas.
    const nombre = 'María José Rodríguez de la Guaira Santos';
    expect(nombre).toHaveLength(MAX_NOMBRE);
    // 0.085 del ancho, como la plantilla más grande, y ancho de 1080.
    const r = repartirNombre(nombre, medidorFalso({ ancho: 1080, porCaracter: 5, tamanoBase: 92 }));
    expect(r.lineas.join(' ')).not.toContain('…');
    expect(r.lineas.join(' ')).toBe(nombre);
  });
});