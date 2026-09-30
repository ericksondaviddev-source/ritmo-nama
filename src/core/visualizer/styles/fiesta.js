/**
 * Estilo "Fiesta": el visual de Festival.
 *
 * Un halo del color de cada tambor detrás de su columna, chispas al golpear y
 * confeti cuando hay acento. Es el que más se parece a un show en vivo y el
 * que mejor funciona con niños: cada golpe hace algo visible.
 */
const CHISPAS_MAX = 220;

/** Las chispas se mueven con gravedad y mueren; se quitan de la lista al morir. */
function dibujarChispas({ ctx, chispas, dt }) {
  for (let i = chispas.length - 1; i >= 0; i--) {
    const c = chispas[i];
    c.vida -= dt * 1.5;
    if (c.vida <= 0) {
      chispas.splice(i, 1);
      continue;
    }
    c.vy += 6 * dt;
    c.x += c.vx * 60 * dt;
    c.y += c.vy * 60 * dt;
    ctx.globalAlpha = Math.max(0, c.vida);
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createFiestaVisualizer({ ctx, canvas, drums = [], composicion }) {
  const colorDe = new Map(drums.map((d) => [d.id, d.color]));
  let chispas = [];
  let halos = new Map(drums.map((d) => [d.id, 0]));
  const PASOS = 12;

  function lanzar(id, acento, x, y) {
    const color = colorDe.get(id) ?? '#fbbf24';
    const n = acento ? 16 : 8;
    for (let i = 0; i < n && chispas.length < CHISPAS_MAX; i++) {
      const ang = Math.random() * Math.PI * 2;
      const v = (acento ? 2.6 : 1.6) * (0.4 + Math.random());
      chispas.push({
        x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 1.2,
        vida: 1, color, r: acento ? 2.6 + Math.random() * 2 : 1.4 + Math.random() * 1.6
      });
    }
  }

  return {
    estilo: 'fiesta',

    marcar(_step, golpeados) {
      for (const g of golpeados ?? []) halos.set(g.id, 1);
    },

    dibujar({ paso, progreso, dt }) {
      const w = canvas.width;
      const h = canvas.height;
      const centro = h * 0.55;

      // Fondo con un degradado suave, siempre oscuro para que el texto del
      // Midipad siga leyéndose encima.
      const g = ctx.createRadialGradient(w / 2, centro, 10, w / 2, centro, Math.max(w, h) * 0.7);
      g.addColorStop(0, '#141419');
      g.addColorStop(1, '#07070a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const steps = composicion?.state?.steps ?? {};

      // Columnas por tambor, cada una con su halo.
      const activos = drums.filter((d) => (steps[d.id] ?? []).some((c) => c > 0));
      // Con la rejilla vacía no hay columnas: se pinta sólo el fondo.
      const n = activos.length;
      if (!n) {
        dibujarChispas({ ctx, chispas, dt });
        return;
      }
      const ancho = w / (n + 1);
      const altoMax = h * 0.36;

      for (let i = 0; i < n; i++) {
        const d = activos[i];
        const x = ancho * (i + 1);
        const luz = halos.get(d.id) ?? 0;
        halos.set(d.id, luz * 0.9);
        const color = colorDe.get(d.id) ?? '#fbbf24';

        // Halo: crece con el brillo del golpe.
        if (luz > 0.02) {
          const r = 40 + luz * 90;
          const hg = ctx.createRadialGradient(x, centro, 0, x, centro, r);
          hg.addColorStop(0, `${color}55`);
          hg.addColorStop(1, `${color}00`);
          ctx.fillStyle = hg;
          ctx.fillRect(x - r, centro - r, r * 2, r * 2);
        }

        // 12 barras redondas del tambor, encendidas donde hay golpe.
        const anchoBarra = Math.max(3, (ancho * 0.62) / PASOS);
        for (let s = 0; s < PASOS; s++) {
          const celda = steps[d.id]?.[s] ?? 0;
          if (!celda) continue;
          const bx = x - (anchoBarra * PASOS) / 2 + s * anchoBarra;
          const esAhora = s === paso;
          const alto = 10 + (celda === 2 ? altoMax : altoMax * 0.55) * (esAhora ? 0.5 + progreso * 0.5 : 0.34);
          ctx.fillStyle = color;
          ctx.globalAlpha = esAhora ? 0.95 : 0.35;
          ctx.beginPath();
          ctx.roundRect(bx, centro - alto / 2, Math.max(2, anchoBarra - 2), alto, anchoBarra / 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Confeti en los acentos del paso en curso.
        if (paso >= 0 && (steps[d.id]?.[paso] ?? 0) === 2) {
          if (luz > 0.9) lanzar(d.id, true, x, centro);
        }
      }

      dibujarChispas({ ctx, chispas, dt });
      ctx.globalAlpha = 1;
    },

    limpiar() {
      chispas = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
}
