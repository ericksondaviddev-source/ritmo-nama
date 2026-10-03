/**
 * Estilo "Barras": el clásico, una barra por cada paso de la rejilla.
 *
 * Dibuja la rejilla que el visitante tiene programada (viene de la
 * composición), así que lo que ve es literalmente lo que suena. Los golpes del
 * paso en curso sólo aportan el brillo: la animación llega con el audio, no antes.
 */
const PASOS = 12;

export function createCanvasVisualizer({ ctx, canvas, drums = [], composicion }) {
  const colorDe = new Map(drums.map((d) => [d.id, d.color]));
  const brillo = new Float32Array(PASOS);

  /** La rejilla actual: color e intensidad de cada paso. */
  function leerRejilla() {
    const steps = composicion?.state?.steps;
    if (!steps) return Array.from({ length: PASOS }, () => ({ color: '#3f3f46', nivel: 0, acento: false }));
    const out = [];
    for (let i = 0; i < PASOS; i++) {
      let color = '#3f3f46';
      let nivel = 0;
      let acento = false;
      for (const d of drums) {
        const celda = steps[d.id]?.[i] ?? 0;
        if (celda > 0) {
          color = colorDe.get(d.id) ?? color;
          nivel = Math.max(nivel, celda === 2 ? 1 : 0.6);
          acento = acento || celda === 2;
        }
      }
      out.push({ color, nivel, acento });
    }
    return out;
  }

  /** Dibuja una mano palmada usando arcos y líneas para compatibilidad universal. */
  function dibujarPalma(ctx, x, y, w, activo) {
    ctx.fillStyle = activo ? '#f87171' : '#6b7280';
    ctx.globalAlpha = 1;
    ctx.beginPath();
    // Palma: óvalo ancho
    ctx.arc(x, y, w / 2, 0, Math.PI * 2);
    ctx.fill();
    // Pulgar
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.arc(x + w / 3, y - 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Dibuja una mano con laurel usando arcos y líneas. */
  function dibujarLaurel(ctx, x, y, w, activo) {
    ctx.fillStyle = activo ? '#fcd34d' : '#a3a4a7';
    ctx.globalAlpha = activo ? 1 : 0.3;
    ctx.beginPath();
    // Laurel hoja
    ctx.arc(x, y - 5, 6, 0, Math.PI * 2);
    ctx.fill();
    // Laurel tallos
    ctx.strokeStyle = '#fcd34d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x - 10, y + 20);
    ctx.lineTo(x + 10, y + 20);
    ctx.stroke();
  }

  return {
    estilo: 'barras',

    marcar(step, golpeados) {
      if (golpeados?.length) brillo[step] = 1;
    },

    limpiar() {
      brillo.fill(0);
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },

    dibujar({ paso, progreso }) {
      const w = canvas.width;
      const h = canvas.height;
      // globalAlpha es estado del contexto, no del cuadro: si un estilo lo deja
      // bajo, el fillRect del fondo sale translúcido y el anterior se queda de
      // fantasma. Se fija al empezar y al terminar.
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, w, h);

      const rejilla = leerRejilla();
      const margen = 16;
      const pasoAncho = (w - margen * 2) / PASOS;
      const centro = h * 0.58;
      const altoMax = h * 0.42;

      for (let i = 0; i < PASOS; i++) {
        brillo[i] *= 0.9;
        const p = rejilla[i];
        const esAhora = i === paso;
        if (esAhora && p.nivel > 0) brillo[i] = 1;

        // En el paso en curso la barra crece con la posición dentro del paso:
        // da la sensación de avance sin parpadear.
        const crece = esAhora ? 0.35 + progreso * 0.65 : 0.34;
        const altura = p.nivel > 0 ? 18 + p.nivel * altoMax * crece : 5;
        const x = margen + i * pasoAncho;
        const y = centro - altura / 2;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = esAhora ? 0.95 : p.nivel > 0 ? 0.32 : 0.12;
        ctx.beginPath();
        ctx.roundRect(x + 1.5, y, pasoAncho - 4, altura, Math.min(7, pasoAncho / 3));
        ctx.fill();

        if (brillo[i] > 0.03) {
          ctx.globalAlpha = Math.min(1, brillo[i]) * (p.acento ? 0.9 : 0.55);
          ctx.fillStyle = p.acento ? '#fbbf24' : '#ffffff';
          ctx.beginPath();
          ctx.roundRect(x + 1.5, y, pasoAncho - 4, Math.min(3.5, altura), 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Las manos van al pie del lienzo, fuera de la fila de barras (antes
      // estaban a 0.75h y se solapaban con ellas). Se encienden con el golpe
      // del paso en curso: paso 0 incluido — `paso > 0` las dejaba mudas en el
      // primer compás de cada reproducción.
      const suenaAhora = (rejilla[paso]?.nivel ?? 0) > 0;
      const manoAncho = Math.min(36, pasoAncho / 2);
      const manoY = h - 24;
      dibujarPalma(ctx, margen + manoAncho / 2, manoY, manoAncho, suenaAhora);
      dibujarLaurel(ctx, w - margen - manoAncho / 2, manoY, manoAncho, suenaAhora);
      // dibujarLaurel dibuja apagado con globalAlpha 0.3: hay que devolverlo.
      ctx.globalAlpha = 1;
    },
  };
}