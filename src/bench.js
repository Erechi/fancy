// Замер скорости майнера: node-сервер не нужен, открыть /bench.html в dev-режиме.
import { GpuMiner } from './miner/gpu.js';

const log = (s) => {
  document.getElementById('log').textContent += s + '\n';
  console.log(s);
};
const params = new URLSearchParams(location.search);
const sizes = (params.get('wg') || '64').split(',').map(Number);
const secs = Number(params.get('t') || 8);
const opts = Object.fromEntries([...params].filter(([k]) => !['wg', 't', 'cfg', 'rounds'].includes(k)));

async function bench(wg, extra = {}) {
  const m = await GpuMiner.create({ workgroupSize: wg, ...opts, ...extra });
  await m.selfTest(16);
  const job = { prefix: '', suffix: '-_-_-_-_', caseInsensitive: false, network: 'mainnet' };
  let t0 = 0;
  let c0 = 0;
  let last = 0;
  let lastT = 0;
  const start = performance.now();
  const p = m.run(job, (checked) => {
    const now = performance.now();
    if (!t0 && now - start > 2000) {
      t0 = now;
      c0 = checked;
    }
    last = checked;
    lastT = now;
    if (now - start > secs * 1000) m.stop();
  }, () => {});
  await p;
  const rate = ((last - c0) / (lastT - t0)) * 1000;
  m.device.destroy();
  return rate;
}

window.results = {};
(async () => {
  log(`opts ${JSON.stringify(opts)}`);
  // cfg=base;maj=1;kw=1,maj=1 — набор вариантов шейдера, каждый замеряется по очереди (по кругу rounds раз)
  const cfgs = (params.get('cfg') || 'base').split(';').map((c) =>
    c === 'base' ? {} : Object.fromEntries(c.split(',').map((kv) => kv.split('='))),
  );
  const rounds = Number(params.get('rounds') || 1);
  for (let r = 0; r < rounds; r++)
    for (const wg of sizes)
      for (const extra of cfgs) {
        const name = `wg=${wg} ${JSON.stringify(extra)}`;
        try {
          const v = await bench(wg, extra);
          (window.results[name] ||= []).push(v);
          log(`${name}: ${Math.round(v).toLocaleString('ru')} фраз/с`);
        } catch (e) {
          log(`${name}: ошибка ${e.message}`);
        }
      }
  window.done = true;
  log('done');
})();
