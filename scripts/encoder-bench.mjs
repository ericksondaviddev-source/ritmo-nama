/** Bench del VideoEncoder de Chrome: hardware vs software a 720×1280. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const PERFIL = path.join(os.tmpdir(), 'ritmo-encoder-bench');

const bench = `(async () => {
  const res = {};
  for (const codec of ['avc1.42001f', 'avc1.64001f']) {
    for (const modo of ['flood', 'cola4']) {
      const cfg = { codec, width: 720, height: 1280, framerate: 30, bitrate: 4500000, hardwareAcceleration: 'prefer-hardware' };
      try {
        const sup = await VideoEncoder.isConfigSupported(cfg);
        if (!sup.supported) { res[codec + '/' + modo] = 'NO SOPORTADO'; continue; }
        let error = null;
        const enc = new VideoEncoder({ output: () => {}, error: (e) => { error = e.message; } });
        enc.configure(cfg);
        const canvas = new OffscreenCanvas(720, 1280);
        const ctx = canvas.getContext('2d');
        const N = 60;
        const t0 = performance.now();
        for (let i = 0; i < N; i++) {
          ctx.fillStyle = 'hsl(' + (i * 12) + ',60%,45%)';
          ctx.fillRect(0, 0, 720, 1280);
          const vf = new VideoFrame(canvas, { timestamp: (i / 30) * 1e6, duration: 1e6 / 30 });
          enc.encode(vf, { keyFrame: i % 60 === 0 });
          vf.close();
          if (error) break;
          if (modo === 'cola4' && enc.encodeQueueSize >= 4) {
            await new Promise((r) => enc.addEventListener('dequeue', r, { once: true }));
          }
        }
        while (enc.encodeQueueSize > 0) await new Promise((r) => setTimeout(r, 10));
        await enc.flush();
        const ms = (performance.now() - t0) / N;
        enc.close();
        res[codec + '/' + modo] = error ? 'error: ' + error : ms.toFixed(1) + ' ms/frame (' + (1000 / ms).toFixed(0) + ' fps)';
      } catch (e) { res[codec + '/' + modo] = 'ex: ' + e.message; }
    }
  }
  return JSON.stringify(res, null, 2);
})()`;

let servidor = null;
try {
  fs.rmSync(PERFIL, { recursive: true, force: true });
  // WebCodecs necesita contexto seguro: http://localhost cuenta como tal.
  const http = await import('node:http');
  servidor = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>bench</title>');
  });
  await new Promise((res) => servidor.listen(5198, '127.0.0.1', res));
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=9344', `--user-data-dir=${PERFIL}`,
    '--remote-allow-origins=*', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-first-run', '--no-default-browser-check', 'http://localhost:5198/'
  ], { stdio: 'ignore' });

  let page = null;
  for (let i = 0; i < 60 && !page; i++) {
    try {
      const lista = await (await fetch('http://localhost:9344/json/list')).json();
      page = lista.find((t) => t.type === 'page');
    } catch { /* aún no */ }
    if (!page) await sleep(500);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pend = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  };
  const evaluar = (expression) => new Promise((res, rej) => {
    const i = ++id;
    pend.set(i, (m) => {
      if (m.error) rej(new Error(m.error.message));
      else if (m.result?.exceptionDetails) rej(new Error(m.result.exceptionDetails.exception?.description ?? m.result.exceptionDetails.text));
      else res(m.result?.result?.value);
    });
    ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });
  // Esperar a que la pestaña apunte al origen seguro (localhost).
  for (let i = 0; i < 40; i++) {
    const href = await evaluar('location.href').catch(() => '');
    if (String(href).includes('5198')) break;
    await sleep(300);
  }
  try {
    const r = await evaluar(bench);
    console.log(r);
  } catch (e) {
    console.error('eval error:', e.message);
  }
  ws.close();} finally {
  spawn('powershell', ['-Command', `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -match 'ritmo-encoder-bench' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`], { stdio: 'ignore' });
  await sleep(500);
  try { servidor?.close(); } catch { /* ya cerrado */ }
}
