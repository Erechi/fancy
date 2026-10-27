// Скриншоты для README: главная, поиск, находка — на русском (docs/) и английском (docs/en/).
// 1. npm run build
// 2. chrome --headless=new --remote-debugging-port=9353 --hide-scrollbars --user-data-dir=<tmp> file:///<путь>/dist/index.html
// 3. node scripts/screenshots.mjs 9353
import { mkdirSync, writeFileSync } from 'node:fs';

const port = process.argv[2] || '9353';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    if (targets.some((t) => t.type === 'page')) break;
  } catch {}
  await sleep(500);
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const call = (method, params = {}) =>
  new Promise((res, rej) => {
    const my = ++id;
    ws.addEventListener('message', function h(ev) {
      const m = JSON.parse(ev.data);
      if (m.id === my) {
        ws.removeEventListener('message', h);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
    });
    ws.send(JSON.stringify({ id: my, method, params }));
  });
const js = async (expr) => {
  const r = await call('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const until = async (expr, ms = 120000) => {
  for (let t = 0; t < ms; t += 300) {
    if (await js(`return !!(${expr})`)) return;
    await sleep(300);
  }
  throw new Error('не дождались: ' + expr);
};
const shot = async (path, height = 1092) => {
  const r = await call('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1400, height, scale: 1 } });
  writeFileSync(path, Buffer.from(r.data, 'base64'));
  console.log('shot', path);
};

await call('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1092, deviceScaleFactor: 1, mobile: false });
const cells = Array(48).fill('');
[...'DOOM'].forEach((c, i) => (cells[20 + i] = c));
[...'KING'].forEach((c, i) => (cells[44 + i] = c));

for (const lang of ['ru', 'en']) {
  const dir = lang === 'ru' ? 'docs' : 'docs/en';
  mkdirSync(dir, { recursive: true });
  // чистое состояние: «любые позиции», DOOM + KING, любой регистр, без сохранённых находок
  await js(`localStorage.clear(); localStorage.setItem('fancy.lang', '${lang}');
    localStorage.setItem('fancy.prefs.v1', ${JSON.stringify(JSON.stringify({ mode: 'cells', cells, caseInsensitive: true, power: 0.75, engine: 'gpu' }))}); return 1`);
  await call('Page.reload');
  await until(`document.querySelector('.live.idle')`);
  await js(`const st = document.createElement('style'); st.textContent = '.wcard-wrap{animation:none} *{caret-color:transparent}'; document.head.appendChild(st); return 1`);

  // главная: скорость уже замерена при открытии
  await js(`window.scrollTo(0, 0); return 1`);
  await sleep(600);
  await shot(`${dir}/home.png`);

  // поиск: длинный шаблон, чтобы не нашёлся за время съёмки
  await js(`document.getElementById('go').click(); return 1`);
  await until(`document.querySelector('.live.run') && document.getElementById('lv-checked')?.textContent.match(/\\d/)`);
  await sleep(3500);
  await js(`window.scrollTo(0, 0); return 1`);
  await shot(`${dir}/search.png`);
  await js(`document.getElementById('stop').click(); return 1`);
  await until(`document.getElementById('go')`);

  // находка: два символа в конце — находится за доли секунды
  await js(`document.querySelector('[data-seg="mode"] [data-v="suffix"]').click(); return 1`);
  await js(`const f = document.querySelector('[data-field="suffix"]'); f.value = 'Ok'; f.dispatchEvent(new Event('input')); return 1`);
  await sleep(300);
  await js(`document.getElementById('go').click(); return 1`);
  await until(`document.querySelector('.found-view')`);
  await sleep(600);
  const h = await js(`return Math.ceil(document.querySelector('.found-view').getBoundingClientRect().bottom + 40)`);
  await shot(`${dir}/found.png`, Math.min(1092, h));
}
ws.close();
