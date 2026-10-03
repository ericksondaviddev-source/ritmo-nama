/** Perfilador del export: parcha VideoEncoder para ver config, nº de frames y tiempo real de encode. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PUERTO = 5199;
const ORIGEN = `http://localhost:${PUERTO}`;
const PUERTO_CDP = 9335;
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const BASE = path.join(os.tmpdir(), 'ritmo-perfil');
const PERFIL = path.join(BASE, 'perfil');

function matar(proc) {
  if (!proc?.pid) return;
  try {
    spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch { /* ya no estaba */ }
}

let vite = null;
let chrome = null;
let ws = null;

try {
  fs.rmSync(BASE, { recursive: true, force: true });
  fs.mkdirSync(PERFIL, { recursive: true });

  // Limpia restos de runs anteriores (chrome/vite viejos que retienen puertos).
  spawn('powershell', ['-Command', `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'ritmo-perfil' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`], { stdio: 'ignore' });
  await sleep(800);

  const binVite = path.join('node_modules', 'vite', 'bin', 'vite.js');
  vite = fs.existsSync(binVite)
    ? spawn(process.execPath, [binVite, '--port', String(PUERTO), '--strictPort'], { stdio: 'ignore' })
    : spawn('cmd', ['/c', 'npx vite --port ' + PUERTO + ' --strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(ORIGEN)).ok) break; } catch { /* aún no */ }
    await sleep(500);
  }

  chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PUERTO_CDP}`, `--user-data-dir=${PERFIL}`,
    '--remote-allow-origins=*', '--autoplay-policy=no-user-gesture-required',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-first-run', '--no-default-browser-check', ORIGEN
  ], { stdio: 'ignore' });

  let page = null;
  for (let i = 0; i < 60 && !page; i++) {
    try {
      const lista = await (await fetch(`http://localhost:${PUERTO_CDP}/json/list`)).json();
      page = lista.find((t) => t.type === 'page' && t.url.includes(`localhost:${PUERTO}`));
    } catch { /* aún no */ }
    if (!page) await sleep(500);
  }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0; const pend = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled') {
      const txt = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      if (txt.includes('export-debug') || txt.includes('perfil')) console.log('  [página] ' + txt);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      console.log('  [excepción] ' + (m.params.exceptionDetails.exception?.description ?? ''));
    }
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  };
  const enviar = (metodo, params = {}) => new Promise((res, rej) => {
    const i = ++id; pend.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m)));
    ws.send(JSON.stringify({ id: i, method: metodo, params }));
  });
  const evaluar = async (expression) => {
    const m = await enviar('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description ?? 'exception');
    return m.result?.result?.value;
  };
  const esperar = async (fn, ms = 20000, cada = 250) => {
    const t0 = Date.now();
    for (;;) {
      const v = await fn().catch(() => null);
      if (v) return v;
      if (Date.now() - t0 > ms) throw new Error('timeout');
      await sleep(cada);
    }
  };

  await enviar('Runtime.enable');
  await enviar('Page.enable');
  // Carrera de arranque: si el tab no terminó en la app, navegamos a mano.
  for (let i = 0; i < 10; i++) {
    const d = await evaluar(`location.href + ' | VideoEncoder=' + typeof VideoEncoder`);
    if (String(d).includes(ORIGEN) && d.includes('VideoEncoder=function')) { console.log('  [diag] ' + d); break; }
    if (i === 9) throw new Error('página no segura o contexto incorrecto: ' + d);
    await enviar('Page.navigate', { url: ORIGEN });
    await sleep(1500);
  }
  await evaluar('globalThis.__RITMO_EXPORT_DEBUG = 1');
  // Etiqueta cada llamada a requestAnimationFrame con su pila de origen
  // (dev server sin minificar → file:line) para saber quién corree a 40fps.
  await evaluar(`(() => {
    const orig = window.requestAnimationFrame.bind(window);
    const conteo = {};
    window.requestAnimationFrame = function (cb) {
      try { throw new Error('raf'); } catch (e) {
        const l = (e.stack || '').split('\\n').slice(2, 6).join(' | ');
        conteo[l] = (conteo[l] || 0) + 1;
      }
      return orig(cb);
    };
    window.__rAFStacks = () => { const c = { ...conteo }; for (const k in conteo) delete conteo[k]; return c; };
    return 'parche rAF activo';
  })()`);

  // Parches de perfil: config del encoder, conteo de frames codificados y
  // tiempo agregado dentro de encode(); además cuentamos padFrameRate...
  await evaluar(`(() => {
    const cfg0 = VideoEncoder.prototype.configure;
    let yaCfg = false;
    VideoEncoder.prototype.configure = function (c) {
      if (!yaCfg) {
        yaCfg = true;
        console.log('[perfil] configure ' + JSON.stringify({
          codec: c.codec, w: c.width, h: c.height, bitrate: c.bitrate,
          hw: c.hardwareAcceleration, latency: c.latencyMode, framerate: c.framerate
        }));
      }
      return cfg0.call(this, c);
    };
    const enc0 = VideoEncoder.prototype.encode;
    let n = 0; let acum = 0; const ts = new Set(); const t0 = performance.now();
    VideoEncoder.prototype.encode = function (frame, opts) {
      const a = performance.now();
      const r = enc0.call(this, frame, opts);
      acum += performance.now() - a;
      n++; ts.add(frame.timestamp);
      if (n % 50 === 0) {
        console.log('[perfil] encode n=' + n + ' tsUnicos=' + ts.size +
          ' encodeMs=' + (acum | 0) + ' paredeMs=' + ((performance.now() - t0) | 0));
      }
      return r;
    };
    window.__perfilEncode = () => ({ n, ts: ts.size, acum: acum | 0, parede: (performance.now() - t0) | 0 });
  })()`);

  await esperar(() => evaluar(`!!document.querySelector('[data-export]')`));
  await evaluar(`document.querySelector('[data-export]').click()`);
  await esperar(() => evaluar(`!!document.querySelector('#btn-generar-mp4')`));
  await evaluar(`document.querySelector('[role="tab"][data-tab="mp4"]').click()`);
  await esperar(() => evaluar(`!document.querySelector('[data-panel="mp4"]').hidden`));
  await sleep(400);

  console.log('--- generar MP4 (se corta a los 100 s de codificación) ---');
  // Contador de rAF (la carga del visualizador) y sonda de encoder en vivo.
  await evaluar(`(() => {
    let n = 0; const orig = window.requestAnimationFrame;
    window.requestAnimationFrame = (fn) => orig.call(window, (t) => { n++; return fn(t); });
    window.__rAFCount = () => n;
    window.__carga = async () => {
      const t = performance.now();
      for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
      return ((performance.now() - t) / 20).toFixed(1) + ' ms/setTimeout(0)';
    };
    // Salida pura de mediabunny (CanvasSource + mux MP4) SIN Input ni decode:
    // mide si el lado de escritura es rápido por sí solo.
    window.__benchSalida = async (n = 30) => {
      if (!window.__mb) {
        window.__mb = await import(location.origin + '/@fs/C:/Users/USUARIO/Desktop/Ritmo-nama/node_modules/mediabunny/dist/modules/src/index.js');
      }
      const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, Quality } = window.__mb;
      const lienzo = new OffscreenCanvas(720, 1280);
      const ctx = lienzo.getContext('2d');
      const salida = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
      const src = new CanvasSource(lienzo, { codec: 'avc', quality: new Quality({ bitrate: 4500000 }), keyFrameInterval: 2, hardwareAcceleration: 'prefer-hardware' });
      salida.addVideoTrack(src, { frameRate: 30 });
      await salida.start();
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = 'hsl(' + (i * 9) + ',60%,42%)';
        ctx.fillRect(0, 0, 720, 1280);
        await src.add(i / 30, 1 / 30);
      }
      await src.close();
      await salida.finalize();
      const ms = (performance.now() - t0) / n;
      return ms.toFixed(1) + ' ms/frame (' + (1000 / ms).toFixed(0) + ' fps)';
    };
    window.__sondaEncoder = async () => {
      const cfg = { codec: 'avc1.64001f', width: 720, height: 1280, framerate: 30, bitrate: 4500000, hardwareAcceleration: 'prefer-hardware' };
      const enc = new VideoEncoder({ output: () => {}, error: () => {} });
      enc.configure(cfg);
      const c = new OffscreenCanvas(720, 1280); const g = c.getContext('2d');
      const N = 15; const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        g.fillStyle = 'hsl(' + i * 20 + ',50%,40%)'; g.fillRect(0, 0, 720, 1280);
        const vf = new VideoFrame(c, { timestamp: (i / 30) * 1e6, duration: 1e6 / 30 });
        enc.encode(vf, { keyFrame: i === 0 }); vf.close();
        if (enc.encodeQueueSize >= 4) await new Promise((r) => enc.addEventListener('dequeue', r, { once: true }));
      }
      while (enc.encodeQueueSize > 0) await new Promise((r) => setTimeout(r, 10));
      await enc.flush(); const ms = (performance.now() - t0) / N; enc.close();
      return ms.toFixed(1) + ' ms/frame (' + (1000 / ms).toFixed(0) + ' fps), rAF=' + window.__rAFCount();
    };
  })()`);
  if (process.argv.includes('--sonda')) {
    console.log('  [previa] sonda con preview:', await evaluar(`window.__sondaEncoder()`));
    const quitado = await evaluar(`(() => { const c = document.querySelector('[data-vz-canvas]'); if (!c) return 'no-canvas'; c.removeAttribute('data-vz-canvas'); return 'ok'; })()`);
    await sleep(400);
    console.log('  [previa] quitar attr data-vz-canvas:', quitado, '→ sonda SIN dibujar preview:', await evaluar(`window.__sondaEncoder()`));
    await evaluar(`(() => { window.requestAnimationFrame = () => 0; return 'rAF neutralizado'; })()`);
    await sleep(600);
    console.log('  [previa] sonda SIN preview NI rAF:', await evaluar(`window.__sondaEncoder()`));
    await evaluar(`(() => {
      const st = document.createElement('style');
      st.textContent = '*{animation:none!important;transition:none!important}';
      document.head.appendChild(st);
      return 'animaciones congeladas';
    })()`);
    await sleep(400);
    console.log('  [previa] sonda SIN animaciones:', await evaluar(`window.__sondaEncoder()`));
    await evaluar(`(() => { document.body.style.visibility = 'hidden'; return 'cuerpo oculto'; })()`);
    await sleep(400);
    console.log('  [previa] sonda con cuerpo oculto:', await evaluar(`window.__sondaEncoder()`));
    console.log('  [previa] carga:', await evaluar(`window.__carga()`));
    console.log('  (modo sonda: fin sin exportar)');
    throw new Error('__fin_sonda__');
  }
  const t0 = Date.now();
  const conTo = (p, ms = 6000) => Promise.race([p, sleep(ms).then(() => '__TIMEOUT__')]);
  ws.addEventListener('close', () => console.log('  [cdp] conexión cerrada (¿crash del renderer?)'));
  console.log('  [bench-salida previo]', await conTo(evaluar(`window.__benchSalida(30)`), 40000));
  await evaluar(`document.querySelector('#btn-generar-mp4').click()`);
  let ultimo = '';
  let ultimoCambio = Date.now();
  let ultimoDbg = Date.now();
  let sondaGrabando = false;
  let rafPrev = { n: 0, t: Date.now() };
  for (;;) {
    const estado = await conTo(evaluar(`document.querySelector('#export-estado')?.textContent ?? ''`));
    if (estado === '__TIMEOUT__') { console.log('  [watchdog] CDP no responde (¿hilo principal bloqueado?)'); break; }
    if (estado !== ultimo) { console.log(`  [estado] ${estado} (+${((Date.now() - t0) / 1000).toFixed(0)} s)`); ultimo = estado; ultimoCambio = Date.now(); }
    if (estado.includes('¡Listo') || estado.startsWith('Error')) break;
    if (estado.startsWith('Grabando') && !sondaGrabando && Date.now() - t0 > 8000) {
      sondaGrabando = true;
      const s = await conTo(evaluar(`window.__sondaEncoder()`), 12000);
      console.log(`  [sonda-grabando] ${JSON.stringify(s)} (+${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    if (estado.startsWith('Codificando') && Date.now() - ultimoDbg > 15000) {
      ultimoDbg = Date.now();
      const d = await conTo(evaluar(`window.__exportDebug ?? null`));
      const p = await conTo(evaluar(`window.__perfilEncode()`));
      const c = await conTo(evaluar(`window.__carga()`));
      const b = await conTo(evaluar(`window.__benchSalida(20)`), 20000);
      const s = await conTo(evaluar(`window.__sondaEncoder()`), 12000);
      const rafAhora = await conTo(evaluar(`window.__rAFCount()`));
      const stacks = await conTo(evaluar(`window.__rAFStacks()`), 8000);
      const ahora = Date.now();
      let rafFps = 'n/a';
      if (typeof rafAhora === 'number') {
        rafFps = ((rafAhora - rafPrev.n) / ((ahora - rafPrev.t) / 1000)).toFixed(1) + ' rAF/s';
        rafPrev = { n: rafAhora, t: ahora };
      }
      console.log(`  [dbg] export=${JSON.stringify(d)} encode=${JSON.stringify(p)} carga=${JSON.stringify(c)} ${rafFps} benchSalida=${JSON.stringify(b)} sonda=${JSON.stringify(s)} (+${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      console.log('  [raf-stacks] ' + JSON.stringify(stacks));
    }
    if (estado.startsWith('Codificando') && Date.now() - t0 > 140000) {
      console.log('  [corte] perfil:', JSON.stringify(await conTo(evaluar(`window.__perfilEncode()`))));
      break;
    }
    if (Date.now() - ultimoCambio > 30000) {
      console.log('  [watchdog] estado estancado durante 30 s');
      console.log('  [watchdog] perfil:', JSON.stringify(await conTo(evaluar(`window.__perfilEncode()`))).slice(0, 300));
      console.log('  [watchdog] clase html:', JSON.stringify(await conTo(evaluar(`document.documentElement.className`))));
      break;
    }
    await sleep(400);
  }
} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  if (ws) try { ws.close(); } catch { /* cerrado */ }
  matar(chrome);
  matar(vite);
  await sleep(700);
  spawn('powershell', ['-Command', `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'ritmo-perfil' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`], { stdio: 'ignore' });
}
