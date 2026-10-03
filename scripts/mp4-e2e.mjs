/**
 * Test e2e del modal de exportación MP4 (autocontenido).
 *
 * Levanta vite + Chrome (CDP por WebSocket, sin dependencias), ejecuta las
 * comprobaciones de la Fase 1 — preview WYSIWYG, formatos/calidad, cambio de
 * estilo con dimensiones estables, exportación real de un MP4 de 15 s a 720p,
 * restauración al cerrar y consola limpia — y al final mata todo.
 *
 * Uso: node scripts/mp4-e2e.mjs
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PUERTO = 5199;
const ORIGEN = `http://localhost:${PUERTO}`;
const PUERTO_CDP = 9333;
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const BASE = path.join(os.tmpdir(), 'ritmo-e2e');
const PERFIL = path.join(BASE, 'perfil');
const DESCARGAS = path.join(BASE, 'descargas');
const FOTOS = path.join(BASE, 'fotos');

const resultados = [];
function paso(ok, nombre, extra = '') {
  resultados.push({ ok, nombre });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${nombre}${extra ? ` — ${extra}` : ''}`);
}

let vite = null;
let chrome = null;
let ws = null;

function matar(proc) {
  if (!proc?.pid) return;
  try {
    spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    /* ya no estaba */
  }
}

function httpListo(url) {
  return fetch(url).then((r) => r.ok).catch(() => false);
}

async function conectarCDP() {
  for (let i = 0; i < 60; i++) {
    try {
      const lista = await (await fetch(`http://localhost:${PUERTO_CDP}/json/list`)).json();
      const page = lista.find((t) => t.type === 'page' && t.url.includes(`localhost:${PUERTO}`));
      if (page) return page;
    } catch {
      /* chrome aún no abre el puerto */
    }
    await sleep(500);
  }
  throw new Error('CDP no respondió');
}

function abrirSocket(url) {
  return new Promise((res, rej) => {
    const socket = new WebSocket(url);
    socket.onopen = () => res(socket);
    socket.onerror = (e) => rej(new Error('WebSocket: ' + e.message));
  });
}

async function principal() {
  fs.rmSync(BASE, { recursive: true, force: true });
  for (const d of [PERFIL, DESCARGAS, FOTOS]) fs.mkdirSync(d, { recursive: true });

  // ── vite ────────────────────────────────────────────────────────────────
  const binVite = path.join('node_modules', 'vite', 'bin', 'vite.js');
  vite = fs.existsSync(binVite)
    ? spawn(process.execPath, [binVite, '--port', String(PUERTO), '--strictPort'], { stdio: 'ignore' })
    : spawn('cmd', ['/c', 'npx vite --port ' + PUERTO + ' --strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 90 && !(await httpListo(ORIGEN)); i++) await sleep(500);
  if (!(await httpListo(ORIGEN))) throw new Error('vite no arrancó');

  // ── chrome ──────────────────────────────────────────────────────────────
  chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PUERTO_CDP}`,
      `--user-data-dir=${PERFIL}`,
      '--remote-allow-origins=*',
      '--autoplay-policy=no-user-gesture-required',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--no-first-run',
      '--no-default-browser-check',
      ORIGEN
    ],
    { stdio: 'ignore' }
  );

  const page = await conectarCDP();
  ws = await abrirSocket(page.webSocketDebuggerUrl);

  // ── protocolo básico ────────────────────────────────────────────────────
  let idMsg = 0;
  const pendientes = new Map();
  const erroresConsola = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pendientes.has(m.id)) {
      const { res, rej } = pendientes.get(m.id);
      pendientes.delete(m.id);
      if (m.error) rej(new Error(m.error.message));
      else res(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') {
      erroresConsola.push(m.params.exceptionDetails?.exception?.description ?? 'exceptionThrown');
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      erroresConsola.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'log') {
      const txt = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      if (txt.includes('export-debug')) console.log('  [página] ' + txt);
    }
  };
  const enviar = (metodo, params = {}) =>
    new Promise((res, rej) => {
      const i = ++idMsg;
      pendientes.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method: metodo, params }));
    });
  const evaluar = async (expr) => {
    const r = await enviar('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    }
    return r.result.value;
  };
  const esperar = async (fn, ms = 15000, cada = 250) => {
    const t0 = Date.now();
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() - t0 > ms) throw new Error('timeout esperando: ' + fn.toString().slice(0, 80));
      await sleep(cada);
    }
  };
  const sleepPagina = (ms) => sleep(ms);

  await enviar('Runtime.enable');
  await enviar('Page.enable');
  await enviar('Runtime.evaluate', { expression: 'globalThis.__RITMO_EXPORT_DEBUG = 1' });
  await enviar('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DESCARGAS, eventsEnabled: true }).catch(
    () => enviar('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DESCARGAS })
  );

  await esperar(() => evaluar(`!!document.querySelector('[data-export]')`), 20000, 300);

  // ── abrir modal y pestaña MP4 ───────────────────────────────────────────
  await evaluar(`document.querySelector('[data-export]').click()`);
  await esperar(() => evaluar(`!!document.querySelector('#btn-generar-mp4')`));
  await evaluar(`document.querySelector('[role="tab"][data-tab="mp4"]').click()`);
  await esperar(() => evaluar(`!document.querySelector('[data-panel="mp4"]').hidden`));
  await sleepPagina(500);

  const estadoVista = () =>
    evaluar(`(() => {
      const c = document.querySelector('[data-vz-canvas]');
      const p = document.querySelector('#preview-canvas');
      const b = document.querySelector('#preview-box');
      const r = b.getBoundingClientRect();
      return { viz: [c.width, c.height], prev: [p.width, p.height],
               box: [Math.round(r.width), Math.round(r.height)] };
    })()`);
  const cambiar = (sel, valor) =>
    evaluar(`(() => { const s = document.querySelector('${sel}');
      s.value = '${valor}'; s.dispatchEvent(new Event('change')); return s.value; })()`);

  // ── 1. vertical 720 por defecto: viz + preview coinciden ────────────────
  let v = await estadoVista();
  paso(
    v.viz[0] === 720 && v.viz[1] === 1280,
    'viz = formato vertical 720p (720×1280)',
    JSON.stringify(v.viz)
  );
  paso(
    v.prev[0] === 304 && v.prev[1] === 540,
    'preview con el mismo encuadre 9:16 (304×540)',
    JSON.stringify(v.prev)
  );
  paso(
    Math.abs(v.box[0] / v.box[1] - 720 / 1280) < 0.03,
    'caja de preview con aspecto 9:16',
    `${v.box[0]}×${v.box[1]}`
  );
  await enviar('Page.captureScreenshot', { format: 'png' })
    .then((b64) => fs.writeFileSync(path.join(FOTOS, '1-preview-vertical.png'), Buffer.from(b64.data, 'base64')));

  // ── 2. cambio de formato re-enquadra viz + preview (el bug del change) ──
  await cambiar('#export-formato', 'horizontal');
  await sleepPagina(400);
  v = await estadoVista();
  paso(v.viz[0] === 1280 && v.viz[1] === 720, 'change de formato → viz 1280×720', JSON.stringify(v.viz));
  paso(v.prev[0] === 540 && v.prev[1] === 304, 'change de formato → preview 16:9', JSON.stringify(v.prev));

  // ── 3. calidad 1080 / volver a 720 ─────────────────────────────────────
  await cambiar('#export-calidad', '1080');
  await sleepPagina(300);
  v = await estadoVista();
  paso(v.viz[0] === 1920 && v.viz[1] === 1080, 'calidad 1080 → viz 1920×1080', JSON.stringify(v.viz));
  await cambiar('#export-calidad', '720');
  await cambiar('#export-formato', 'vertical');
  await sleepPagina(400);
  v = await estadoVista();
  paso(v.viz[0] === 720 && v.viz[1] === 1280, 'volver a 720 vertical', JSON.stringify(v.viz));

  // ── 4. cambio de estilo mantiene el encuadre y sincroniza el select ─────
  await cambiar('#export-estilo', 'ascii');
  await esperar(() => evaluar(`document.querySelector('[data-viz-estilo]').value === 'ascii'`), 8000, 200);
  await sleepPagina(600);
  v = await estadoVista();
  paso(v.viz[0] === 720 && v.viz[1] === 1280, 'cambio de estilo conserva 720×1280', JSON.stringify(v.viz));

  // ── 5. estilo 3D (WebGL) con el encuadre forzado ───────────────────────
  await cambiar('#export-estilo', '3d');
  await esperar(() => evaluar(`document.querySelector('[data-viz-estilo]').value === '3d'`), 8000, 200);
  await sleepPagina(3500); // deja cargar modelos
  v = await estadoVista();
  paso(v.viz[0] === 720 && v.viz[1] === 1280, 'estilo 3D respeta 720×1280', JSON.stringify(v.viz));
  await enviar('Page.captureScreenshot', { format: 'png' })
    .then((b64) => fs.writeFileSync(path.join(FOTOS, '2-preview-3d.png'), Buffer.from(b64.data, 'base64')));

  // ── 6. exportación real: 15 s, 720p vertical, estilo barras ─────────────
  await cambiar('#export-estilo', 'barras');
  await esperar(() => evaluar(`document.querySelector('[data-viz-estilo]').value === 'barras'`), 8000, 200);
  await cambiar('#export-formato', 'vertical');
  await cambiar('#export-calidad', '720');
  await sleepPagina(600);

  const leerEstado = () => evaluar(`document.querySelector('#export-estado')?.textContent ?? ''`);
  const t0 = Date.now();
  await evaluar(`document.querySelector('#btn-generar-mp4').click()`);
  let estado = '';
  await esperar(async () => {
    estado = await leerEstado();
    return estado.startsWith('Codificando') || estado.startsWith('Error') || estado.includes('¡Listo');
  }, 90000, 300);
  const tGrabacion = ((Date.now() - t0) / 1000).toFixed(1);
  paso(!estado.startsWith('Error'), 'grabación de 15 s completada', `estado="${estado}" (${tGrabacion} s)`);

  let tCod = 0;
  if (estado.startsWith('Codificando')) {
    const tC0 = Date.now();
    let ultimo = estado;
    await esperar(async () => {
      estado = await leerEstado();
      if (estado !== ultimo) {
        console.log(`  [estado] ${estado} (+${((Date.now() - tC0) / 1000).toFixed(0)} s)`);
        ultimo = estado;
      }
      return estado.includes('¡Listo') || estado.startsWith('Error');
    }, 300000, 500);
    tCod = ((Date.now() - tC0) / 1000).toFixed(1);
  }
  paso(estado.includes('¡Listo'), 'MP4 exportado y descarga iniciada', `codificación ${tCod} s — "${estado}"`);

  await sleepPagina(2500);
  const archivos = fs.readdirSync(DESCARGAS).filter((f) => f.toLowerCase().endsWith('.mp4'));
  const bytes = archivos.length ? fs.statSync(path.join(DESCARGAS, archivos[0])).size : 0;
  paso(bytes > 50000, 'archivo .mp4 descargado', `${archivos[0] ?? 'ninguno'} — ${bytes} bytes`);

  // ── 7. botones restaurados tras exportar ────────────────────────────────
  const tras = await evaluar(`(() => ({
    btn: document.querySelector('#btn-generar-mp4').textContent.trim(),
    off: document.querySelector('#btn-generar-mp4').disabled,
    estiloOff: document.querySelector('#export-estilo').disabled,
    fmtOff: document.querySelector('#export-formato').disabled
  }))()`);
  paso(
    tras.btn.includes('Generar MP4') && !tras.off && !tras.estiloOff && !tras.fmtOff,
    'controles restaurados',
    JSON.stringify(tras)
  );

  // ── 8. cerrar con Escape: lienzo y estilo originales ────────────────────
  await cambiar('#export-estilo', 'fiesta'); // el original al abrir era 'barras'
  await esperar(() => evaluar(`document.querySelector('[data-viz-estilo]').value === 'fiesta'`), 8000, 200);
  await evaluar(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await esperar(() => evaluar(`!document.querySelector('#btn-generar-mp4')`), 8000, 200);
  await sleepPagina(500);
  const fin = await evaluar(`(() => {
    const c = document.querySelector('[data-vz-canvas]');
    return { viz: [c.width, c.height], estilo: document.querySelector('[data-viz-estilo]').value,
             inline: c.getAttribute('style') ?? '' };
  })()`);
  paso(fin.viz[0] === 960 && fin.viz[1] === 360, 'Escape restaura el viz 960×360', JSON.stringify(fin.viz));
  paso(fin.estilo === 'barras', 'Escape restaura el estilo original', fin.estilo);
  paso(fin.inline.trim() === '', 'sin estilos inline residuales en el canvas', `"${fin.inline}"`);

  // ── 9. consola limpia ───────────────────────────────────────────────────
  paso(erroresConsola.length === 0, 'sin errores de consola', erroresConsola.join(' | ').slice(0, 300));
}

// ── arranque + limpieza garantizada ───────────────────────────────────────
const watchdog = setTimeout(() => {
  console.error('WATCHDOG: el test pasó de 9 minutos.');
  process.exit(2);
}, 9 * 60 * 1000);

try {
  await principal();
} catch (err) {
  console.error('ERROR:', err.message);
  resultados.push({ ok: false, nombre: 'excepción: ' + err.message });
} finally {
  clearTimeout(watchdog);
  if (ws) try { ws.close(); } catch { /* cerrado */ }
  matar(chrome);
  matar(vite);
  await sleep(800);
  const fallidos = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones OK`);
  if (fallidos.length) console.log('FALLAN: ' + fallidos.map((f) => f.nombre).join(' · '));
  process.exit(fallidos.length ? 1 : 0);
}
