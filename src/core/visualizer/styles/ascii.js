/**
 * Estilo "ASCII": los tambores dibujados con caracteres.
 *
 * Cada tambor es una columna de símbolos que se enciende cuando suena. Es el
 * estilo más divertido para un niño y el más ligero de pintar: sólo texto, sin
 * GPU, así que va bien incluso en un móvil viejo.
 */
const GLIFOS = {
  paila: ['|', '|', '=', '=', '=', '='],
  prima: ['.', '·', 'o', 'O', '@', '#'],
  cruzao: ['.', ':', '+', '*', '%', '&'],
  pujao: ['_', '-', '=', '#', '%', '@']
};

/** De la paila (el aro) a la prima (la más aguda). */
const ORDEN = ['paila', 'pujao', 'cruzao', 'prima'];

export function createAsciiVisualizer({ ctx, canvas, drums = [], composicion }) {
  const info = new Map(drums.map((d) => [d.id, d]));
  const brillo = new Map(drums.map((d) => [d.id, 0]));
  const filas = 14;

  const colorDe = (id) => info.get(id)?.color ?? '#f43f5e';

  return {
    estilo: 'ascii',

    marcar(_step, golpeados) {
      for (const g of golpeados ?? []) brillo.set(g.id, 1);
    },

    dibujar() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const orden = ORDEN.filter((id) => brillo.has(id));
      if (!orden.length) return;

      const anchoCol = w / (orden.length + 1);
      const celda = Math.max(10, Math.floor(h / (filas + 3)));
      const glifoSize = Math.min(24, Math.max(12, Math.floor(anchoCol / 1.4)));
      ctx.font = `${glifoSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

      // La rejilla real del tambor: 12 posiciones.
      const steps = composicion?.state?.steps;
      const arriba = Math.floor((h - filas * celda) / 2);

      for (let c = 0; c < orden.length; c++) {
        const id = orden[c];
        const x = anchoCol * (c + 1);
        const glifos = GLIFOS[id] ?? GLIFOS.prima;
        const fila = steps?.[id] ?? [];
        const luz = brillo.get(id) ?? 0;
        brillo.set(id, luz * 0.88);

        for (let i = 0; i < filas; i++) {
          const y = arriba + i * celda;
          const pos = Math.floor((i / filas) * 12);
          const golpe = fila[pos];
          const glifo = golpe ? glifos[2 + (pos % 4)] : '·';

          if (golpe) {
            ctx.fillStyle = colorDe(id);
            ctx.globalAlpha = 0.45 + luz * 0.55;
          } else {
            ctx.fillStyle = colorDe(id);
            ctx.globalAlpha = 0.16;
          }
          ctx.fillText(glifo, x, y);
        }

        ctx.globalAlpha = luz > 0.04 ? 1 : 0.45;
        ctx.fillStyle = luz > 0.04 ? '#fbbf24' : colorDe(id);
        ctx.font = `bold ${Math.max(10, Math.floor(celda * 0.82))}px ui-monospace, monospace`;
        ctx.fillText((info.get(id)?.name ?? id).slice(0, 7).toUpperCase(), x, arriba + filas * celda + 4);
        ctx.font = `${glifoSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      }
      ctx.globalAlpha = 1;
    },

    limpiar() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
}
