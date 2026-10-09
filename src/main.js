import './polyfill.js';
import './style.css';
import { generateMnemonic } from '@scure/bip39';
import {
  WORDLIST,
  NETWORKS,
  bytesToHex,
  makeMatcher,
  matchProbability,
  validatePattern,
  wordsToWallet,
} from './core/fast.js';
import { Toncenter, buildDeployAndRotate, formatGram } from './core/wallet.js';
import { GpuMiner } from './miner/gpu.js';
import { CpuMiner } from './miner/cpu.js';

// ---------------- состояние ----------------

const LS_FOUND = 'vanity.found.v1';
const LS_PREFS = 'vanity.prefs.v1';

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* приватный режим — живём без сохранения */
    }
  },
};

const prefs = Object.assign(
  { text: 'GRAM', type: 'suffix', caseInsensitive: true, network: 'mainnet', apiKey: '' },
  store.get(LS_PREFS, {}),
);

const state = {
  device: { status: 'checking', gpu: null, gpuError: null, cpuThreads: navigator.hardwareConcurrency || 4, rate: { gpu: 0, cpu: 0 } },
  engine: null, // 'gpu' | 'cpu'
  mining: null, // { started, checked, rate, job, found }
  found: store.get(LS_FOUND, []),
  claim: null, // address открытого оформления
};

const gpuMiner = { instance: null };
const cpuMiner = new CpuMiner();

function saveFound() {
  store.set(LS_FOUND, state.found);
}
function savePrefs() {
  store.set(LS_PREFS, prefs);
}

// ---------------- утилиты ----------------

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function fmtRate(r) {
  if (!r) return '—';
  if (r >= 1e6) return (r / 1e6).toFixed(2) + ' M';
  if (r >= 1e3) return (r / 1e3).toFixed(1) + ' K';
  return Math.round(r).toString();
}

function fmtNum(n) {
  return Math.round(n).toLocaleString('ru-RU');
}

function fmtDur(sec) {
  if (!isFinite(sec)) return '∞';
  if (sec < 1) return '< 1 с';
  if (sec < 60) return `${Math.round(sec)} с`;
  if (sec < 3600) return `${Math.round(sec / 60)} мин`;
  if (sec < 86400 * 2) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return m ? `${h} ч ${m} мин` : `${h} ч`;
  }
  if (sec < 86400 * 365) return `${Math.round(sec / 86400)} дн`;
  return `${(sec / 86400 / 365).toFixed(1)} лет`;
}

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const old = btn.textContent;
      btn.textContent = 'Скопировано';
      setTimeout(() => (btn.textContent = old), 1400);
    }
  } catch {
    /* нет доступа к буферу — пользователь скопирует руками */
  }
}

function currentRate() {
  return state.engine ? state.device.rate[state.engine] : 0;
}

function highlight(address, text, type) {
  const L = text.length;
  if (type === 'suffix') {
    return `<span class="dim">${esc(address.slice(0, 48 - L))}</span><b>${esc(address.slice(48 - L))}</b>`;
  }
  return `<span class="dim">${esc(address.slice(0, 2))}</span><b>${esc(address.slice(2, 2 + L))}</b><span class="dim">${esc(address.slice(2 + L))}</span>`;
}

// ---------------- оценка устройства ----------------

function prettyGpu(name) {
  if (!name) return 'WebGPU';
  const vendors = { nvidia: 'NVIDIA', amd: 'AMD', intel: 'Intel', apple: 'Apple', qualcomm: 'Qualcomm', arm: 'ARM' };
  return name
    .split(' ')
    .map((w) => vendors[w.toLowerCase()] || w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Короткий прогон на заведомо недостижимом шаблоне. Первую половину отсчётов
// (разгон размера пачки и прогрев) отбрасываем, берём медиану остальных.
async function benchmark(engine, ms = engine === 'gpu' ? 3500 : 4000) {
  const job = { text: 'zZ9_-zZ9', type: 'suffix', caseInsensitive: false, network: 'mainnet' };
  const samples = [];
  const miner = engine === 'gpu' ? gpuMiner.instance : cpuMiner;
  const done = miner.run(job, (_, r) => r && samples.push(r), () => {});
  await new Promise((r) => setTimeout(r, ms));
  miner.stop();
  await done;
  const tail = samples.slice(Math.floor(samples.length / 2)).sort((a, b) => a - b);
  return tail[Math.floor(tail.length / 2)] || samples.at(-1) || 0;
}

async function detectDevice() {
  const d = state.device;
  d.status = 'checking';
  renderDevice();
  try {
    gpuMiner.instance = await GpuMiner.create();
    d.gpu = prettyGpu(gpuMiner.instance.adapterName);
    d.status = 'selftest';
    renderDevice();
    await gpuMiner.instance.selfTest(16);
    d.status = 'bench';
    renderDevice();
    d.rate.gpu = await benchmark('gpu');
    state.engine = 'gpu';
  } catch (e) {
    console.warn('GPU недоступен:', e);
    d.gpuError = e.message || String(e);
    gpuMiner.instance = null;
    d.status = 'bench';
    renderDevice();
    d.rate.cpu = await benchmark('cpu');
    state.engine = 'cpu';
  }
  d.status = 'ready';
  renderDevice();
  renderBuilder();
}

async function switchEngine(engine) {
  if (state.mining || state.engine === engine) return;
  state.engine = engine;
  if (!state.device.rate[engine]) {
    state.device.status = 'bench';
    renderDevice();
    state.device.rate[engine] = await benchmark(engine);
    state.device.status = 'ready';
  }
  renderDevice();
  renderBuilder();
}

// ---------------- майнинг ----------------

async function startMining() {
  const err = validatePattern(prefs.text, prefs.type);
  if (err || !state.engine || state.mining) return;
  const job = { text: prefs.text, type: prefs.type, caseInsensitive: prefs.caseInsensitive, network: prefs.network };
  const match = makeMatcher(job.text, job.type, job.caseInsensitive);
  const m = { started: performance.now(), checked: 0, rate: 0, job, found: null, error: null };
  state.mining = m;
  renderBuilder();
  const miner = state.engine === 'gpu' ? gpuMiner.instance : cpuMiner;
  const ticker = setInterval(renderProgress, 250);

  const onFound = async ({ words, address }) => {
    if (m.found) return;
    // независимая перепроверка перед сохранением
    const w = await wordsToWallet(words, job.network);
    if (w.address !== address || !match(address)) return;
    m.found = address;
    miner.stop();
    state.found.unshift({
      address,
      anchor: words,
      pattern: job.text,
      type: job.type,
      network: job.network,
      createdAt: Date.now(),
      status: 'found',
    });
    saveFound();
  };

  try {
    await miner.run(
      job,
      (checked, rate) => {
        m.checked = checked;
        if (rate) {
          m.rate = rate;
          state.device.rate[state.engine] = rate;
        }
      },
      onFound,
    );
  } catch (e) {
    m.error = e.message || String(e);
  }
  clearInterval(ticker);
  state.mining = null;
  renderBuilder();
  renderFound();
  if (m.found) {
    document.getElementById(`f-${m.found}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (m.error) {
    alert('Майнинг остановлен: ' + m.error);
  }
}

function stopMining() {
  if (!state.mining) return;
  (state.engine === 'gpu' ? gpuMiner.instance : cpuMiner).stop();
}

// ---------------- разметка ----------------

function renderShell() {
  $('#app').innerHTML = `
    <header class="top">
      <div class="brand"><span class="logo">◆</span> Vanity <span class="tag">free</span></div>
      <a class="ghost-link" href="#how">Как это работает</a>
    </header>

    <section class="hero">
      <h1>Красивые адреса для <em>Telegram Wallet</em></h1>
      <p class="lead">Адрес с вашим словом в конце или в начале. Поиск идёт прямо в этом браузере — на видеокарте или процессоре.
      Все 24 слова создаются у вас и никуда не отправляются. Бесплатно.</p>
      <div id="device" class="device"></div>
    </section>

    <section class="grid">
      <div id="builder" class="card builder"></div>
      <div id="preview" class="card preview"></div>
    </section>

    <section id="found-wrap"></section>
    <section id="claim-wrap"></section>

    <section id="how" class="how">
      <h2>Как это работает</h2>
      <ol class="flow">
        <li><b>Поиск</b><span>Браузер перебирает случайные фразы из 12 слов, пока адрес не совпадёт с шаблоном.</span></li>
        <li><b>Вторая половина</b><span>Браузер создаёт ещё 12 слов — подписывающие. Вместе получается 24.</span></li>
        <li><b>Пополнение</b><span>Вы отправляете ~0.05 GRAM на найденный адрес, чтобы оплатить развёртывание.</span></li>
        <li><b>Смена ключа</b><span>Одна транзакция разворачивает кошелёк и переключает его ключ на 24 слова.</span></li>
        <li><b>Импорт</b><span>Telegram → Wallet → Импорт, вводите 24 слова. Готово.</span></li>
      </ol>
      <div class="facts">
        <div><h3>Без сервера</h3><p>У сайта нет бэкенда. Фразы существуют только в этой вкладке и в хранилище вашего браузера. В сеть уходит лишь подписанная транзакция смены ключа — через публичный toncenter.</p></div>
        <div><h3>Проверяемо</h3><p>Контракт WalletTg открыт: <a href="https://github.com/ton-blockchain/tg-wallet-contract" target="_blank" rel="noopener">ton-blockchain/tg-wallet-contract</a>. После смены ключа его публичный ключ равен ключу ваших 24 слов — видно в любом эксплорере.</p></div>
        <div><h3>Время случайное</h3><p>Оценка — это медиана: половина поисков заканчивается раньше, 1 из 20 занимает примерно в 4 раза дольше. Каждый символ в точном регистре умножает время на 64, в любом — примерно на 32.</p></div>
      </div>
      <p class="disclaimer">Не аффилированы с Telegram. Telegram Wallet — продукт его правообладателя. Используйте на свой риск; для начала попробуйте короткий шаблон и небольшую сумму.</p>
    </section>
  `;
}

function renderDevice() {
  const d = state.device;
  const el = $('#device');
  if (!el) return;
  const steps = {
    checking: 'Готовим видеокарту — при первом запуске это до 30 секунд…',
    selftest: `Видеокарта найдена: ${esc(d.gpu)}. Сверяем расчёты GPU с процессором…`,
    bench: 'Замеряем скорость вашего устройства…',
  };
  if (d.status !== 'ready') {
    el.innerHTML = `<span class="pulse"></span>${steps[d.status]}`;
    return;
  }
  const gpuOk = !!gpuMiner.instance;
  el.innerHTML = `
    <span class="dot ${state.engine}"></span>
    <span>${state.engine === 'gpu' ? `Видеокарта · ${esc(d.gpu)}` : `Процессор · ${d.cpuThreads} потоков`}</span>
    <span class="sep">·</span>
    <b class="mono">${fmtRate(currentRate())}</b><span class="muted">фраз/с</span>
    <span class="engine-switch">
      <button data-engine="gpu" class="${state.engine === 'gpu' ? 'on' : ''}" ${gpuOk ? '' : 'disabled title="' + esc(d.gpuError || 'WebGPU недоступен') + '"'}>GPU</button>
      <button data-engine="cpu" class="${state.engine === 'cpu' ? 'on' : ''}">CPU</button>
    </span>
    ${!gpuOk && d.gpuError ? `<div class="hint">Видеокарта недоступна (${esc(d.gpuError)}). Для скорости откройте сайт в свежем Chrome или Edge.</div>` : ''}
  `;
  el.querySelectorAll('[data-engine]').forEach((b) => (b.onclick = () => switchEngine(b.dataset.engine)));
}

function seg(name, options, value) {
  return `<div class="seg" data-seg="${name}">${options
    .map(([v, label]) => `<button data-v="${v}" class="${String(value) === String(v) ? 'on' : ''}">${label}</button>`)
    .join('')}</div>`;
}

function renderBuilder() {
  const el = $('#builder');
  const m = state.mining;
  const err = validatePattern(prefs.text, prefs.type);
  const prefix = NETWORKS[prefs.network].testOnly ? '0Q' : 'UQ';
  el.innerHTML = `
    <label class="label">Ваш текст</label>
    <div class="input-row">
      ${prefs.type === 'prefix' ? `<span class="affix">${prefix}</span>` : `<span class="affix">${prefix}…</span>`}
      <input id="pat" maxlength="8" spellcheck="false" autocomplete="off" value="${esc(prefs.text)}" ${m ? 'disabled' : ''} />
      <span class="count">${prefs.text.length} / 8</span>
    </div>
    ${err ? `<div class="err">${esc(err)}</div>` : ''}
    <div class="row2">
      <div><label class="label">Где</label>${seg('type', [['suffix', 'В конце'], ['prefix', 'В начале']], prefs.type)}</div>
      <div><label class="label">Регистр</label>${seg('case', [[true, 'Любой'], [false, 'Точный']], prefs.caseInsensitive)}</div>
    </div>
    <p class="note">${prefs.caseInsensitive ? 'lucky, Lucky и LUCKY подойдут — в разы быстрее.' : 'Буквы именно в таком регистре — каждая буква дольше примерно вдвое.'} Латиница, цифры, «-» и «_».</p>
    <details class="adv" ${prefs.network !== 'mainnet' ? 'open' : ''}>
      <summary>Дополнительно</summary>
      <label class="label">Сеть</label>${seg('net', [['mainnet', 'Mainnet'], ['testnet', 'Testnet']], prefs.network)}
      <label class="label">Ключ toncenter API (необязательно)</label>
      <input id="apikey" class="plain" placeholder="без ключа — 1 запрос в секунду" value="${esc(prefs.apiKey)}" />
    </details>
    <div id="estimate"></div>
    ${
      m
        ? `<button id="stop" class="btn danger">Остановить</button>`
        : `<button id="go" class="btn" ${err || !state.engine ? 'disabled' : ''}>${state.engine ? 'Начать поиск' : 'Ждём замер скорости…'}</button>`
    }
  `;

  const inp = $('#pat');
  inp.oninput = () => {
    const pos = inp.selectionStart;
    prefs.text = inp.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 8);
    savePrefs();
    renderBuilder();
    const n = $('#pat');
    n.focus();
    n.setSelectionRange(pos, pos);
  };
  el.querySelectorAll('[data-seg] button').forEach((b) => {
    b.onclick = () => {
      if (state.mining) return;
      const k = b.parentElement.dataset.seg;
      if (k === 'type') prefs.type = b.dataset.v;
      if (k === 'case') prefs.caseInsensitive = b.dataset.v === 'true';
      if (k === 'net') prefs.network = b.dataset.v;
      savePrefs();
      renderBuilder();
    };
  });
  const ak = $('#apikey');
  ak.onchange = () => {
    prefs.apiKey = ak.value.trim();
    savePrefs();
  };
  $('#go') && ($('#go').onclick = startMining);
  $('#stop') && ($('#stop').onclick = stopMining);
  renderEstimate();
  renderPreview();
}

function renderEstimate() {
  const el = $('#estimate');
  if (!el) return;
  if (validatePattern(prefs.text, prefs.type)) {
    el.innerHTML = '';
    return;
  }
  const p = matchProbability(prefs.text, prefs.type, prefs.caseInsensitive);
  const rate = currentRate();
  const median = rate ? Math.LN2 / p / rate : NaN;
  const p95 = rate ? Math.log(20) / p / rate : NaN;
  const tier = !rate ? '' : median < 60 ? 'fast' : median < 3600 ? 'mid' : median < 86400 ? 'slow' : 'insane';
  el.innerHTML = `
    <div class="est ${tier}">
      <div><span class="k">В среднем перебрать</span><span class="v mono">${fmtNum(1 / p)}</span></div>
      <div><span class="k">Медиана на этом устройстве</span><span class="v">${rate ? fmtDur(median) : 'замеряем…'}</span></div>
      <div><span class="k">1 из 20 дольше</span><span class="v">${rate ? fmtDur(p95) : '—'}</span></div>
    </div>
    ${tier === 'insane' ? '<div class="warn">Слишком долго для этого устройства. Сократите текст или выберите любой регистр.</div>' : ''}
    ${state.mining ? '<div id="progress"></div>' : ''}
  `;
  renderProgress();
}

function renderProgress() {
  const el = $('#progress');
  const m = state.mining;
  if (!el || !m) return;
  const p = matchProbability(m.job.text, m.job.type, m.job.caseInsensitive);
  const chance = 1 - Math.exp(-m.checked * p);
  const elapsed = (performance.now() - m.started) / 1000;
  el.innerHTML = `
    <div class="bar"><i style="width:${(chance * 100).toFixed(1)}%"></i></div>
    <div class="prog">
      <span>Проверено <b class="mono">${fmtNum(m.checked)}</b></span>
      <span><b class="mono">${fmtRate(m.rate)}</b> фраз/с</span>
      <span>${fmtDur(elapsed)}</span>
      <span>шанс уже найти: ${(chance * 100).toFixed(0)}%</span>
    </div>`;
  const dev = $('#device .mono');
  if (dev && m.rate) dev.textContent = fmtRate(m.rate);
}

let previewFiller = '';
function renderPreview() {
  const el = $('#preview');
  const B = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  if (!previewFiller) {
    const r = crypto.getRandomValues(new Uint8Array(46));
    previewFiller = Array.from(r, (x) => B[x & 63]).join('');
  }
  const net = NETWORKS[prefs.network];
  const head = net.testOnly ? '0Q' : 'UQ';
  const t = prefs.text || '…';
  const L = t.length;
  let addr;
  if (prefs.type === 'suffix') addr = head + previewFiller.slice(0, 46 - L) + t;
  else addr = head + t + previewFiller.slice(0, 46 - L);
  el.innerHTML = `
    <div class="pv-head"><span>TELEGRAM WALLET · ${prefs.network.toUpperCase()}</span><span class="pill">${state.mining ? 'ПОИСК' : 'ПРИМЕР'}</span></div>
    <div class="pv-addr mono">${prefs.type === 'suffix' ? highlight(addr, t, 'suffix') : highlight(addr, t, 'prefix')}</div>
    <div class="pv-big mono">${prefs.type === 'suffix' ? '…' + esc(t) : esc(head + t) + '…'}</div>
    <div class="pv-meta">
      <div><span>Цена</span><b>Бесплатно</b></div>
      <div><span>Регистр</span><b>${prefs.caseInsensitive ? 'любой' : 'точный'}</b></div>
      <div><span>Считает</span><b>${state.engine === 'gpu' ? 'GPU' : state.engine === 'cpu' ? 'CPU' : '…'}</b></div>
    </div>`;
}

function renderFound() {
  const el = $('#found-wrap');
  if (!state.found.length) {
    el.innerHTML = '';
    return;
  }
  const status = {
    found: 'найден',
    funded: 'пополнен',
    switched: 'готов к импорту',
  };
  el.innerHTML = `
    <h2>Найденные адреса</h2>
    <p class="muted small">Хранятся только в этом браузере. Пока ключ не сменён, первые 12 слов — единственный доступ к адресу.</p>
    <div class="found-list">
      ${state.found
        .map(
          (f) => `
        <div class="found card" id="f-${esc(f.address)}">
          <div class="found-top">
            <span class="pill ${f.status}">${status[f.status] || f.status}</span>
            <span class="muted small">${f.network === 'testnet' ? 'testnet · ' : ''}${new Date(f.createdAt).toLocaleString('ru-RU')}</span>
          </div>
          <div class="mono addr">${highlight(f.address, f.pattern, f.type)}</div>
          <div class="found-actions">
            <button class="btn small" data-claim="${esc(f.address)}">${f.status === 'switched' ? 'Открыть' : 'Оформить кошелёк'}</button>
            <button class="btn small ghost" data-copy="${esc(f.address)}">Копировать адрес</button>
            <button class="btn small ghost danger-text" data-del="${esc(f.address)}">Удалить</button>
          </div>
        </div>`,
        )
        .join('')}
    </div>`;
  el.querySelectorAll('[data-claim]').forEach((b) => (b.onclick = () => openClaim(b.dataset.claim)));
  el.querySelectorAll('[data-copy]').forEach((b) => (b.onclick = () => copy(b.dataset.copy, b)));
  el.querySelectorAll('[data-del]').forEach(
    (b) =>
      (b.onclick = () => {
        const f = state.found.find((x) => x.address === b.dataset.del);
        const msg =
          f?.status === 'found'
            ? 'Удалить адрес? Если вы не записали 12 слов, адрес будет потерян навсегда.'
            : 'Удалить запись с этого устройства? Убедитесь, что все 24 слова записаны — восстановить их будет нельзя.';
        if (!confirm(msg)) return;
        state.found = state.found.filter((x) => x.address !== b.dataset.del);
        saveFound();
        if (state.claim === b.dataset.del) closeClaim();
        renderFound();
      }),
  );
}

// ---------------- оформление: 24 слова → пополнение → смена ключа → импорт ----------------

let claimTimer = null;

function openClaim(address) {
  state.claim = address;
  const f = state.found.find((x) => x.address === address);
  if (!f.signing) {
    // вторая половина фразы — тоже только в этом браузере
    f.signing = generateMnemonic(WORDLIST, 128).split(' ');
    saveFound();
  }
  renderClaim();
  $('#claim-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeClaim() {
  state.claim = null;
  clearInterval(claimTimer);
  $('#claim-wrap').innerHTML = '';
}

function wordsGrid(words, offset, hidden) {
  return `<ol class="words ${hidden ? 'hidden' : ''}" start="${offset + 1}">${words
    .map((w, i) => `<li><span class="n">${offset + i + 1}</span><span class="w mono">${esc(w)}</span></li>`)
    .join('')}</ol>`;
}

async function renderClaim() {
  clearInterval(claimTimer);
  const f = state.found.find((x) => x.address === state.claim);
  const el = $('#claim-wrap');
  if (!f) return closeClaim();
  const ui = (state.claimUi ??= {});
  if (ui.address !== f.address) Object.assign(ui, { address: f.address, revealed: false, wrote: f.status !== 'found' ? true : false, info: null, busy: false, msg: '' });

  const step = f.status === 'switched' ? 4 : ui.wrote ? 2 : 1;
  const amount = '0.05';
  const nano = 50_000_000;
  const link = `ton://transfer/${f.address}?amount=${nano}`;
  const net = f.network;

  el.innerHTML = `
    <div class="card claim">
      <div class="claim-head">
        <h2>Оформление <span class="mono">${highlight(f.address, f.pattern, f.type)}</span></h2>
        <button class="btn small ghost" id="claim-close">Свернуть</button>
      </div>

      <div class="step ${step === 1 ? 'active' : 'done'}">
        <h3><span class="sn">1</span> Запишите 24 слова</h3>
        <p class="muted">Слова 1–12 нашёл поиск — они задают адрес. Слова 13–24 только что создал ваш браузер — на них переключится ключ кошелька. Запишите все 24 по порядку, на бумаге, без скриншотов.</p>
        <div class="words-wrap">
          <div><div class="label">Слова 1–12 · anchor</div>${wordsGrid(f.anchor, 0, !ui.revealed)}</div>
          <div><div class="label">Слова 13–24 · signing</div>${wordsGrid(f.signing, 12, !ui.revealed)}</div>
        </div>
        <div class="actions">
          ${ui.revealed ? `<button class="btn small ghost" id="copy24">Скопировать 24 слова</button>` : `<button class="btn small" id="reveal">Показать — убедитесь, что никто не смотрит</button>`}
          ${step === 1 && ui.revealed ? `<label class="check"><input type="checkbox" id="wrote"> Я записал все 24 слова по порядку</label>` : ''}
        </div>
      </div>

      <div class="step ${step === 2 ? 'active' : step > 2 ? 'done' : 'locked'}">
        <h3><span class="sn">2</span> Пополните адрес и смените ключ</h3>
        <p class="muted">Отправьте около <b>${amount} GRAM</b> на найденный адрес из любого кошелька — этим оплачивается развёртывание контракта. Остаток останется на кошельке.</p>
        <div class="fund">
          <code class="mono">${esc(f.address)}</code>
          <button class="btn small ghost" id="copy-addr">Копировать</button>
          ${net === 'mainnet' ? `<a class="btn small ghost" href="${esc(link)}">Открыть в кошельке</a>` : ''}
        </div>
        <div id="chain" class="chain muted">${step >= 2 ? 'Проверяем баланс…' : ''}</div>
        <div class="actions">
          <button class="btn" id="switch" disabled>Сменить ключ на мои 24 слова</button>
        </div>
        <div class="msg">${esc(ui.msg || '')}</div>
      </div>

      <div class="step ${step === 4 ? 'active' : 'locked'}">
        <h3><span class="sn">3</span> Импорт в Telegram Wallet</h3>
        <ol class="import">
          <li>Telegram → Wallet → <b>Импортировать кошелёк</b>, 24 слова.</li>
          <li>Введите слова <b>в показанном порядке</b> — с 1 по 24.</li>
          <li>Проверьте, что адрес в Wallet заканчивается на <b class="mono">${esc(f.address.slice(-Math.max(4, f.pattern.length)))}</b>.</li>
        </ol>
        ${f.status === 'switched' ? `<p class="ok">Ключ сменён: публичный ключ кошелька совпадает с вашими 24 словами. С этого момента слова 1–12 сами по себе ничего не могут.</p>
        <p class="muted small">После импорта в Wallet удалите запись кнопкой «Удалить» в списке — так фраза не останется в этом браузере.</p>
        <a class="btn small ghost" target="_blank" rel="noopener" href="https://${net === 'testnet' ? 'testnet.' : ''}tonviewer.com/${esc(f.address)}">Посмотреть в эксплорере</a>` : ''}
      </div>
    </div>`;

  $('#claim-close').onclick = closeClaim;
  $('#reveal') && ($('#reveal').onclick = () => ((ui.revealed = true), renderClaim()));
  $('#copy24') && ($('#copy24').onclick = (e) => copy([...f.anchor, ...f.signing].join(' '), e.target));
  $('#wrote') &&
    ($('#wrote').onchange = (e) => {
      if (!e.target.checked) return;
      ui.wrote = true;
      renderClaim();
    });
  $('#copy-addr').onclick = (e) => copy(f.address, e.target);
  if (step === 2) {
    $('#switch').onclick = () => switchKey(f);
    pollChain(f);
    claimTimer = setInterval(() => pollChain(f), 6000);
  }
}

async function pollChain(f) {
  const ui = state.claimUi;
  if (ui.busy) return;
  const api = new Toncenter(f.network, prefs.apiKey);
  const el = $('#chain');
  const btn = $('#switch');
  try {
    const st = await api.getState(f.address);
    const signing = await wordsToWallet(f.signing, f.network);
    let onchainKey = null;
    if (st.state === 'active') onchainKey = await api.getPublicKeyHex(f.address).catch(() => null);
    if (onchainKey && onchainKey === bytesToHex(signing.publicKey)) {
      f.status = 'switched';
      saveFound();
      renderFound();
      return renderClaim();
    }
    ui.info = st;
    if (st.balance > 0n && f.status === 'found') {
      f.status = 'funded';
      saveFound();
      renderFound();
    }
    const enough = st.balance >= 10_000_000n;
    if (el)
      el.innerHTML = `Баланс: <b class="mono">${formatGram(st.balance)} GRAM</b> · контракт: ${
        st.state === 'active' ? 'развёрнут' : 'ещё не развёрнут'
      }${enough ? '' : ' · ждём пополнения…'}`;
    if (btn) btn.disabled = !enough || st.state === 'frozen';
  } catch (e) {
    if (el) el.textContent = 'Не удалось связаться с toncenter: ' + (e.message || e) + '. Повторим через несколько секунд.';
  }
}

async function switchKey(f) {
  const ui = state.claimUi;
  if (ui.busy) return;
  ui.busy = true;
  const btn = $('#switch');
  btn.disabled = true;
  btn.textContent = 'Отправляем…';
  const setMsg = (m) => {
    ui.msg = m;
    const el = $('.step.active .msg') || $('.msg');
    if (el) el.textContent = m;
  };
  try {
    const api = new Toncenter(f.network, prefs.apiKey);
    const anchor = await wordsToWallet(f.anchor, f.network);
    const signing = await wordsToWallet(f.signing, f.network);
    if (anchor.address !== f.address) throw new Error('слова 1–12 не дают этот адрес — запись повреждена');

    const st = await api.getState(f.address);
    let seqno = 0;
    let deploy = true;
    if (st.state === 'active') {
      deploy = false;
      const key = await api.getPublicKeyHex(f.address);
      if (key === bytesToHex(signing.publicKey)) {
        f.status = 'switched';
        saveFound();
        ui.busy = false;
        renderFound();
        return renderClaim();
      }
      if (key !== bytesToHex(anchor.publicKey)) throw new Error('в контракте чужой ключ — продолжать нельзя');
      seqno = Number(await api.getNumber(f.address, 'seqno'));
    } else if (st.state !== 'uninitialized') {
      throw new Error(`состояние аккаунта: ${st.state}`);
    }

    const { boc } = buildDeployAndRotate({
      anchorPrivateKey: anchor.privateKey,
      anchorPublicKey: anchor.publicKey,
      newPrivateKey: signing.privateKey,
      newPublicKey: signing.publicKey,
      network: f.network,
      seqno,
      deploy,
    });
    await api.sendBoc(boc);
    setMsg('Транзакция отправлена. Ждём подтверждения в сети (обычно 5–20 секунд)…');

    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const key = await api.getPublicKeyHex(f.address);
        if (key === bytesToHex(signing.publicKey)) {
          f.status = 'switched';
          saveFound();
          ui.busy = false;
          ui.msg = '';
          renderFound();
          return renderClaim();
        }
      } catch {
        /* контракт ещё не появился — ждём */
      }
    }
    throw new Error('подтверждение не пришло за 2 минуты. Проверьте адрес в эксплорере и нажмите кнопку ещё раз');
  } catch (e) {
    setMsg('Ошибка: ' + (e.message || e));
    btn.textContent = 'Сменить ключ на мои 24 слова';
    btn.disabled = false;
  } finally {
    ui.busy = false;
  }
}

// ---------------- старт ----------------

if (import.meta.env.DEV) window.__vanity = { GpuMiner, gpuMiner, cpuMiner, state };

renderShell();
renderDevice();
renderBuilder();
renderFound();
detectDevice();
