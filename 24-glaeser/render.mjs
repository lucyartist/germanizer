// Rendert film.html Bild fuer Bild zu MP4 (headless Chromium + ffmpeg).
//   node render.mjs --stills 1,5.5,12      einzelne Frames + Kontaktbogen nach out/stills
//   node render.mjs --video [--workers 4]  kompletter Film nach out/24-glaeser.mp4
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as T from './timeline.js';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const FFMPEG = process.env.FFMPEG || findFfmpeg();

function findFfmpeg() {
  try {
    return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
  } catch { return 'ffmpeg'; }
}
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: T.W, height: T.H }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/film.html?render=1`);
  await page.evaluate(() => window.ready);
  return page;
}
async function grab(page, t) {
  const b64 = await page.evaluate((tt) => {
    window.renderAt(tt);
    return document.getElementById('c').toDataURL('image/png').split(',')[1];
  }, t);
  return Buffer.from(b64, 'base64');
}

async function stills(times) {
  const srv = await serve();
  const browser = await playwright.chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  const page = await openPage(browser, srv.address().port);
  const dir = path.join(OUT, 'stills');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (const t of times) {
    const t0 = Date.now();
    const png = await grab(page, t);
    const f = path.join(dir, `t_${t.toFixed(3).padStart(8, '0')}.png`);
    fs.writeFileSync(f, png);
    files.push(f);
    console.log(`t=${t.toFixed(3)}  ${Date.now() - t0} ms`);
  }
  await browser.close();
  srv.close();
  // Kontaktbogen: je 4 Bilder pro Zeile, verkleinert, mit Zeitstempel im Dateinamen-Reihenfolge
  const cols = 4;
  const sheet = path.join(dir, 'sheet.png');
  const inputs = files.flatMap((f) => ['-i', f]);
  const n = files.length;
  const rows = Math.ceil(n / cols);
  const pads = cols * rows - n;
  let filter = files.map((_, i) => `[${i}:v]scale=360:640[v${i}]`).join(';');
  const labels = files.map((_, i) => `[v${i}]`);
  for (let i = 0; i < pads; i++) { filter += `;color=c=black:s=360x640:d=1[p${i}]`; labels.push(`[p${i}]`); }
  filter += `;${labels.join('')}xstack=inputs=${cols * rows}:layout=${xstackLayout(cols, rows)}[out]`;
  try {
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-map', '[out]', '-frames:v', '1', sheet]);
    console.log('Kontaktbogen:', sheet);
  } catch (e) { console.error('Kontaktbogen fehlgeschlagen', e.message); }
}
function xstackLayout(cols, rows) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(`${c * 360}_${r * 640}`);
  return out.join('|');
}

async function video() {
  const workers = parseInt(opt('--workers', '4'), 10);
  const total = Math.round(T.DURATION * T.FPS);
  const from = parseInt(opt('--from', '0'), 10);
  const to = parseInt(opt('--to', String(total)), 10);
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const port = srv.address().port;
  const chunk = Math.ceil((to - from) / workers);
  const t0 = Date.now();
  let done = 0;
  const segs = [];
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const a = from + w * chunk, b = Math.min(to, a + chunk);
    if (a >= b) return;
    const segFile = path.join(OUT, `seg_${String(w).padStart(2, '0')}.mp4`);
    segs[w] = segFile;
    const browser = await playwright.chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
    const page = await openPage(browser, port);
    const ff = spawn(FFMPEG, [
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(T.FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      segFile,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) {
      const png = await grab(page, f / T.FPS);
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      done++;
      if (done % 60 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`${done}/${to - from} Frames, ${el.toFixed(0)} s, noch ca. ${((el / done) * (to - from - done)).toFixed(0)} s`);
      }
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    await browser.close();
  }));
  srv.close();
  const list = path.join(OUT, 'segs.txt');
  fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join('\n'));
  const silent = path.join(OUT, 'video_silent.mp4');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
  segs.filter(Boolean).forEach((s) => fs.rmSync(s));
  fs.rmSync(list);
  console.log(`Bild fertig in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${silent}`);
  const wav = path.join(OUT, 'audio.wav');
  if (fs.existsSync(wav)) {
    const final = path.join(OUT, '24-glaeser.mp4');
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', silent, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', final]);
    console.log('Film mit Ton:', final);
  }
}

if (args.includes('--stills')) {
  const times = opt('--stills', '1').split(',').map(Number);
  await stills(times);
} else if (args.includes('--video')) {
  await video();
} else {
  console.log('node render.mjs --stills 1,2,3 | --video [--workers 4]');
}
