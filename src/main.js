import './polyfill.js';
import './style.css';
import { generateMnemonic } from '@scure/bip39';
import {
  WORDLIST,
  NETWORKS,
  MAX_PART,
  bytesToHex,
  makeMatcher,
  matchProbability,
  validateJob,
  wordsToWallet,
} from './core/fast.js';
import { Toncenter, buildDeployAndRotate, formatGram } from './core/wallet.js';
import { GpuMiner } from './miner/gpu.js';
import { t, lang, setLang, locale } from './ui/i18n.js';

/** Ссылка на репозиторий и версия — из package.json (см. vite.config.js). */
const REPO_URL = __REPO_URL__;
const APP_VERSION = __APP_VERSION__;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const POWER_LEVELS = [0.25, 0.5, 0.75, 1];
const RECOMMENDED_POWER = 0.75;
/** Сколько просим отправить на активацию. Реальная комиссия деплоя и смены ключа ≈ 0.0007 GRAM. */
const ACTIVATION_GRAM = '0.1';
const ACTIVATION_NANO = 100_000_000;
const CHIPS = {
  suffix: ['GRAM', 'TON', 'FANCY', 'LUCKY', '777', '1337'],
  prefix: ['Dog', 'Cat', 'Ace', 'Boss', 'Bro', 'D1'],
};

// ---------------- хранилище ----------------

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
      /* приватный режим — работаем без сохранения */
    }
  },
};

const K_FOUND = 'fancy.found.v1';
const K_PREFS = 'fancy.prefs.v1';

function loadFound() {
  const list = store.get(K_FOUND, null);
  if (list) return list;
  // перенос находок из первой версии
  const old = store.get('vanity.found.v1', []);
  return old.map((f) => ({
    ...f,
    prefix: f.type === 'prefix' ? f.pattern : '',
    suffix: f.type === 'prefix' ? '' : f.pattern,
    caseInsensitive: true,
  }));
}

const prefs = Object.assign(
  { mode: 'suffix', prefix: 'Dog', suffix: 'GRAM', caseInsensitive: true, network: 'mainnet', apiKey: '', power: RECOMMENDED_POWER },
  store.get(K_PREFS, {}),
);

const state = {
  view: 'home', // home | found | claim
  device: { status: 'checking', name: '', error: null, rate: 0 },
  hunt: null,
  found: loadFound(),
  claim: null,
  claimUi: null,
};

const saveFound = () => store.set(K_FOUND, state.found);
const savePrefs = () => store.set(K_PREFS, prefs);

let miner = null;

// ---------------- утилиты ----------------

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function currentJob() {
  return {
    prefix: prefs.mode === 'suffix' ? '' : prefs.prefix,
    suffix: prefs.mode === 'prefix' ? '' : prefs.suffix,
    caseInsensitive: prefs.caseInsensitive,
    network: prefs.network,
  };
}

function patternLabel(job) {
  return `${job.prefix ? 'UQ' + job.prefix : ''}…${job.suffix || ''}`;
}

function fmtCompact(n) {
  return new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
function fmtInt(n) {
  return Math.round(n).toLocaleString(locale());
}
function fmtRate(r) {
  return r ? fmtCompact(r) : '—';
}

function fmtDur(sec) {
  const ru = lang === 'ru';
  const u = ru ? { s: 'с', m: 'мин', h: 'ч', d: 'дн', y: 'лет' } : { s: 's', m: 'min', h: 'h', d: 'd', y: 'years' };
  if (!isFinite(sec)) return '∞';
  if (sec < 1) return ru ? '< 1 с' : '< 1 s';
  if (sec < 60) return `${Math.round(sec)} ${u.s}`;
  if (sec < 3600) return `${Math.round(sec / 60)} ${u.m}`;
  if (sec < 172800) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return m ? `${h} ${u.h} ${m} ${u.m}` : `${h} ${u.h}`;
  }
  if (sec < 86400 * 365) return `${Math.round(sec / 86400)} ${u.d}`;
  const y = sec / 86400 / 365;
  return y > 1e6 ? (ru ? 'миллионы лет' : 'millions of years') : `${fmtCompact(y)} ${u.y}`;
}

function fmtClock(sec) {
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function tier(sec) {
  if (!isFinite(sec)) return 'insane';
  if (sec < 60) return 'fast';
  if (sec < 3600) return 'mid';
  if (sec < 86400) return 'slow';
  return sec < 86400 * 30 ? 'long' : 'insane';
}

/** Скорость с учётом выбранной нагрузки. */
function effectiveRate() {
  return state.device.rate * prefs.power;
}

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const old = btn.textContent;
      btn.textContent = t('copied');
      setTimeout(() => (btn.textContent = old), 1400);
    }
  } catch {
    /* нет доступа к буферу — пользователь скопирует руками */
  }
}

/** Адрес с подсвеченными символами шаблона. */
function addrHtml(address, job, cls = '') {
  const pre = job.prefix ? job.prefix.length : 0;
  const suf = job.suffix ? job.suffix.length : 0;
  const head = address.slice(0, 2);
  const p = address.slice(2, 2 + pre);
  const mid = address.slice(2 + pre, 48 - suf);
  const s = address.slice(48 - suf);
  return `<span class="addr ${cls}"><span class="dim">${esc(head)}</span>${p ? `<b>${esc(p)}</b>` : ''}<span class="dim">${esc(mid)}</span>${s ? `<b>${esc(s)}</b>` : ''}</span>`;
}

// ---------------- звук и уведомление о находке ----------------

let audio = null;
function primeAlerts() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    audio = null;
  }
  try {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  } catch {
    /* браузер без уведомлений */
  }
}

function alertFound(address) {
  try {
    if (audio) {
      const now = audio.currentTime;
      [880, 1175, 1568].forEach((f, i) => {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.frequency.value = f;
        o.type = 'sine';
        g.gain.setValueAtTime(0.0001, now + i * 0.14);
        g.gain.exponentialRampToValueAtTime(0.2, now + i * 0.14 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.35);
        o.connect(g).connect(audio.destination);
        o.start(now + i * 0.14);
        o.stop(now + i * 0.14 + 0.4);
      });
    }
  } catch {
    /* без звука */
  }
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(t('notifTitle'), { body: address });
  } catch {
    /* без уведомления */
  }
}

// ---------------- устройство ----------------

/** Точная модель видеокарты из WebGL (WebGPU в Chrome отдаёт только вендора и архитектуру). */
function gpuModelName(fallback) {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    const m = /ANGLE \([^,]+,\s*([^,(]+?)\s*(\(0x|Direct3D|,)/.exec(r);
    if (m) return m[1].trim();
    if (r && !/ANGLE/.test(r)) return r;
  } catch {
    /* нет WebGL */
  }
  const vendors = { nvidia: 'NVIDIA', amd: 'AMD', intel: 'Intel', apple: 'Apple' };
  return (fallback || 'WebGPU')
    .split(' ')
    .map((w) => vendors[w.toLowerCase()] || w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function detectDevice() {
  const d = state.device;
  try {
    miner = await GpuMiner.create();
    d.name = gpuModelName(miner.adapterName);
    d.status = 'selftest';
    renderDevice();
    await miner.selfTest(16);
    d.status = 'bench';
    renderDevice();
    d.rate = await benchmark();
    d.status = 'ready';
  } catch (e) {
    console.warn('GPU недоступен:', e);
    d.status = 'nogpu';
    d.error = e.message || String(e);
    miner = null;
  }
  renderDevice();
  renderSettings();
  renderWaitTable();
}

// Короткий прогон на недостижимом шаблоне при полной нагрузке; разгон отбрасываем, берём медиану.
async function benchmark(ms = 3500) {
  const job = { suffix: 'zZ9_-zZ9', caseInsensitive: false, network: 'mainnet' };
  const samples = [];
  miner.power = 1;
  const done = miner.run(job, (_, r) => r && samples.push(r), () => {});
  await new Promise((r) => setTimeout(r, ms));
  miner.stop();
  await done;
  const tail = samples.slice(Math.floor(samples.length / 2)).sort((a, b) => a - b);
  return tail[Math.floor(tail.length / 2)] || samples.at(-1) || 0;
}

// ---------------- поиск (идёт прямо на главной) ----------------

function startHunt() {
  const job = currentJob();
  if (!validateJob(job).ok || state.device.status !== 'ready' || state.hunt) return;
  primeAlerts();
  state.hunt = {
    job,
    p: matchProbability(job),
    checkedBefore: 0,
    checked: 0,
    rate: 0,
    sample: '',
    activeMs: 0,
    runStarted: performance.now(),
    paused: false,
    found: null,
    error: null,
  };
  renderSettings();
  renderLive();
  runHunt();
}

async function runHunt() {
  const h = state.hunt;
  const match = makeMatcher(h.job);
  h.runStarted = performance.now();
  miner.power = prefs.power;
  const ticker = setInterval(renderLive, 250);
  try {
    await miner.run(
      h.job,
      (checked, rate, sample) => {
        h.checked = h.checkedBefore + checked;
        if (rate) h.rate = rate;
        if (sample) h.sample = sample;
      },
      async ({ words, address }) => {
        if (h.found) return;
        // независимая перепроверка перед сохранением
        const w = await wordsToWallet(words, h.job.network);
        if (w.address !== address || !match(address)) return;
        h.found = address;
        miner.stop();
        state.found.unshift({
          address,
          anchor: words,
          prefix: h.job.prefix,
          suffix: h.job.suffix,
          caseInsensitive: h.job.caseInsensitive,
          network: h.job.network,
          createdAt: Date.now(),
          status: 'found',
        });
        saveFound();
      },
    );
  } catch (e) {
    h.error = e.message || String(e);
  }
  clearInterval(ticker);
  h.activeMs += performance.now() - h.runStarted;
  h.checkedBefore = h.checked;
  if (h.paused && !h.found && !h.error) {
    renderSettings();
    return renderLive();
  }
  finishHunt();
}

function finishHunt() {
  const h = state.hunt;
  if (h.found) {
    alertFound(h.found);
    document.title = '✦ ' + t('foundTitle') + ' — Fancy';
    state.view = 'found';
    render();
    window.scrollTo({ top: 0 });
    return;
  }
  if (h.error) alert(t('stopError', h.error));
  state.hunt = null;
  document.title = 'Fancy';
  renderSettings();
  renderLive();
}

function togglePause() {
  const h = state.hunt;
  if (!h || h.found) return;
  if (!h.paused) {
    h.paused = true;
    miner.stop(); // runHunt дождётся остановки и обновит экран
  } else {
    h.paused = false;
    renderSettings();
    runHunt();
  }
}

function stopHunt() {
  const h = state.hunt;
  if (!h) return;
  if (h.paused) {
    h.paused = false;
    finishHunt();
  } else {
    miner.stop();
  }
}

// ---------------- разметка: каркас ----------------

function render() {
  document.documentElement.lang = lang;
  $('#app').innerHTML = `
    <header class="top">
      <a class="brand" href="#" data-home><span class="spark">✦</span>fancy</a>
      <div class="top-actions">
        <div class="lang">${['ru', 'en'].map((l) => `<button data-lang="${l}" class="${lang === l ? 'on' : ''}">${l.toUpperCase()}</button>`).join('')}</div>
        ${REPO_URL ? `<a class="pill-link" href="${esc(REPO_URL)}" target="_blank" rel="noopener">${t('source')}</a>` : ''}
      </div>
    </header>
    <main id="view"></main>
    <footer class="foot"><span>Fancy v${APP_VERSION}${REPO_URL ? ` · <a href="${esc(REPO_URL)}" target="_blank" rel="noopener">GitHub</a>` : ''}</span><span>${t('footer')}</span></footer>
  `;
  $('[data-home]').onclick = (e) => {
    e.preventDefault();
    if (state.view === 'claim' || state.view === 'found') {
      state.view = 'home';
      state.hunt = null;
      document.title = 'Fancy';
      render();
    }
  };
  document.querySelectorAll('[data-lang]').forEach(
    (b) =>
      (b.onclick = () => {
        setLang(b.dataset.lang);
        render();
      }),
  );
  if (state.view === 'home') renderHome();
  else if (state.view === 'found') renderFoundView();
  else if (state.view === 'claim') renderClaim();
}

// ---------------- главная ----------------

function renderHome() {
  liveShown = {};
  $('#view').innerHTML = `
    <section class="home">
      <div class="hero">
        <span class="badge"><i></i>${t('badgeLocal')}</span>
        <h1>${t('heroTitle')[0]}<br><span class="grad">${t('heroTitle')[1]}</span></h1>
        <p class="lead">${t('heroLead')}</p>
        <div class="price">${t('price')
          .map(([k, v], i) => `<div class="${i === 1 ? 'hl' : ''}"><span>${k}</span><b>${v}</b></div>`)
          .join('')}</div>
        <p class="price-note">${t('priceNote')}</p>
        <ul class="points">${t('heroPoints').map((p) => `<li>${p}</li>`).join('')}</ul>
        <div class="showcase mono" id="showcase"></div>
        <div class="live" id="live"></div>
      </div>
      <div class="panel" id="settings"></div>
    </section>
    <section class="block" id="wait"></section>
    <section class="block" id="mine"></section>
    <section class="block">
      <h2>${t('howTitle')}</h2>
      <p class="sub">${t('howSub')}</p>
      <ol class="flow">${t('how')
        .map(([a, b], i) => `<li><span class="num">${String(i + 1).padStart(2, '0')}</span><div><b>${a}</b><p>${b}</p></div></li>`)
        .join('')}</ol>
    </section>
    <section class="block">
      <h2>${t('factsTitle')}</h2>
      <div class="facts">${t('facts').map(([a, b]) => `<div><h3>${a}</h3><p>${b}</p></div>`).join('')}</div>
    </section>
    <section class="block">
      <h2>${t('faqTitle')}</h2>
      <div class="faq">${t('faq').map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
    </section>
  `;
  renderLive();
  renderSettings();
  renderWaitTable();
  renderMine();
  startShowcase();
}

let showcaseTimer = null;
let filler = '';
function startShowcase() {
  clearInterval(showcaseTimer);
  const rnd = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => B64[x & 63]).join('');
  if (!filler) filler = 'ABCD'[crypto.getRandomValues(new Uint8Array(1))[0] & 3] + rnd(45);
  const draw = () => {
    const el = $('#showcase');
    if (!el) return clearInterval(showcaseTimer);
    // во время поиска витрина показывает настоящий последний кандидат
    if (state.hunt?.sample) {
      el.innerHTML = addrHtml(state.hunt.sample, state.hunt.job, 'ghost-hl');
      return;
    }
    const job = currentJob();
    const pre = job.prefix || '';
    const suf = job.suffix || '';
    const head = NETWORKS[prefs.network].testOnly ? '0Q' : 'UQ';
    const addr = (head + pre + filler).slice(0, 48 - suf.length) + suf;
    el.innerHTML = addrHtml(addr, job);
  };
  draw();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  showcaseTimer = setInterval(() => {
    const arr = filler.split('');
    const r = crypto.getRandomValues(new Uint8Array(6));
    for (let i = 0; i < 3; i++) arr[1 + (r[i] % 44)] = B64[r[i + 3] & 63];
    filler = arr.join('');
    draw();
  }, 140);
}

// ---------------- живая карточка: скорость, ориентир, время с запуска ----------------

let liveShown = {};

/** Плавно «докручивает» число до цели. log: анимировать в логарифмической шкале (для времени). */
function tweenTo(id, target, format, { log = false, ms = 520 } = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!isFinite(target)) {
    liveShown[id] = target;
    el.textContent = format(target);
    return;
  }
  const from = liveShown[id];
  liveShown[id] = target;
  // в фоновой вкладке requestAnimationFrame не вызывается — ставим значение сразу
  if (from === undefined || !isFinite(from) || from === target || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = format(target);
    return;
  }
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
  const a = log ? Math.log(Math.max(from, 1e-3)) : from;
  const b = log ? Math.log(Math.max(target, 1e-3)) : target;
  const t0 = performance.now();
  const stepFn = (now) => {
    if (liveShown[id] !== target) return; // пришло новое значение — эту анимацию бросаем
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    const v = a + (b - a) * e;
    el.textContent = format(log ? Math.exp(v) : v);
    if (k < 1) requestAnimationFrame(stepFn);
  };
  requestAnimationFrame(stepFn);
}

function renderLive() {
  const el = $('#live');
  if (!el) return;
  const d = state.device;
  const h = state.hunt;
  const st = h ? (h.paused ? 'paused' : 'run') : d.status === 'ready' ? 'idle' : d.status === 'nogpu' ? 'bad' : 'wait';
  if (el.dataset.st !== st || el.dataset.lang !== lang) {
    el.dataset.st = st;
    el.dataset.lang = lang;
    liveShown = {};
    const label = {
      run: t('running'),
      paused: t('paused'),
      idle: t('liveReady'),
      bad: t('liveNoGpu'),
      wait: d.status === 'checking' ? t('devChecking') : d.status === 'selftest' ? t('devSelftest', esc(d.name)) : t('devBench'),
    }[st];
    el.className = `live ${st}`;
    el.innerHTML = `
      <div class="live-head">
        <span class="state"><i></i>${label}</span>
        ${d.name ? `<span class="gpu">${esc(d.name)}</span>` : ''}
      </div>
      ${
        st === 'bad'
          ? `<p class="live-err">${esc(t('gpuUnavailable', d.error))}</p>`
          : `<div class="metrics">
        <div><span class="k">${t('speed')}</span><b class="mono" id="lv-speed">—</b><small>${t('perSec')}</small></div>
        <div><span class="k">${t('liveEta')}</span><b id="lv-eta">—</b><small id="lv-eta-sub">${t('median')}</small></div>
        <div><span class="k">${t('liveElapsed')}</span><b class="mono" id="lv-time">00:00</b><small id="lv-checked">${t('liveNotStarted')}</small></div>
      </div>
      <div class="bar"><i id="lv-bar"></i></div>
      <div class="live-foot"><span id="lv-chance">${t('chance')}: 0%</span><span id="lv-power">${t('gpuLoad')}: ${Math.round(prefs.power * 100)}%</span></div>`
      }`;
  }
  if (st === 'bad') return;

  const job = h ? h.job : currentJob();
  const v = validateJob(job);
  const p = h ? h.p : v.ok ? matchProbability(job) : NaN;
  const rate = h && h.rate ? h.rate : effectiveRate();
  const median = rate && isFinite(p) ? Math.LN2 / p / rate : NaN;

  tweenTo('lv-speed', rate || NaN, (x) => (isFinite(x) && x > 0 ? fmtCompact(x) : '—'));
  tweenTo('lv-eta', median, (x) => (isFinite(x) ? fmtDur(x) : '—'), { log: true });
  const etaEl = $('#lv-eta');
  if (etaEl) etaEl.className = isFinite(median) ? tier(median) : '';
  const sub = $('#lv-eta-sub');
  if (sub) {
    const p95 = (median / Math.LN2) * Math.log(20);
    sub.textContent = !isFinite(median) ? t('median') : p95 < 1 ? t('etaInstant') : t('etaSub', fmtDur(p95));
  }

  const elapsed = h ? (h.activeMs + (h.paused ? 0 : performance.now() - h.runStarted)) / 1000 : 0;
  const timeEl = $('#lv-time');
  if (timeEl) timeEl.textContent = fmtClock(elapsed);
  const checkedEl = $('#lv-checked');
  if (checkedEl) checkedEl.textContent = h ? `${fmtInt(h.checked)} ${t('checked')}` : t('liveNotStarted');
  const chance = h ? 1 - Math.exp(-h.checked * h.p) : 0;
  const bar = $('#lv-bar');
  if (bar) bar.style.width = `${(chance * 100).toFixed(1)}%`;
  const ch = $('#lv-chance');
  if (ch) ch.textContent = `${t('chance')}: ${Math.min(99, Math.floor(chance * 100))}%`;
  const pw = $('#lv-power');
  if (pw) pw.textContent = `${t('gpuLoad')}: ${Math.round(prefs.power * 100)}%`;
  if (h) document.title = `${fmtCompact(h.checked)} · ${patternLabel(h.job)} — Fancy`;
}

const renderDevice = renderLive;

// ---------------- карточка настроек ----------------

function seg(name, options, value, disabled) {
  return `<div class="seg" data-seg="${name}">${options
    .map(([v, label]) => `<button data-v="${v}" class="${String(value) === String(v) ? 'on' : ''}" ${disabled ? 'disabled' : ''}>${label}</button>`)
    .join('')}</div>`;
}

function field(kind, disabled) {
  const v = kind === 'prefix' ? prefs.prefix : prefs.suffix;
  const head = NETWORKS[prefs.network].testOnly ? '0Q' : 'UQ';
  const affixL = kind === 'prefix' ? head : '…';
  const affixR = kind === 'prefix' ? '…' : '';
  return `
    <label class="label">${kind === 'prefix' ? t('atStart') : t('atEnd')}</label>
    <div class="input-row">
      <span class="affix">${affixL}</span>
      <input data-field="${kind}" maxlength="${MAX_PART}" spellcheck="false" autocomplete="off" value="${esc(v)}" ${disabled ? 'disabled' : ''} />
      ${affixR ? `<span class="affix">${affixR}</span>` : ''}
      <span class="count">${v.length}/${MAX_PART}</span>
    </div>
    <div class="err" data-err="${kind}"></div>`;
}

function powerName(p) {
  return t('powerNames')[p];
}

function renderSettings() {
  const el = $('#settings');
  if (!el) return;
  const h = state.hunt;
  const busy = !!h;
  const showPre = prefs.mode !== 'suffix';
  const showSuf = prefs.mode !== 'prefix';
  const chipKind = showSuf ? 'suffix' : 'prefix';
  const ready = state.device.status === 'ready';
  const advOpen = el.querySelector('details.adv')?.open ?? false;
  el.innerHTML = `
    <div class="panel-title">${t('settings')}</div>
    ${seg('mode', [['suffix', t('atEnd')], ['prefix', t('atStart')], ['both', t('both')]], prefs.mode, busy)}
    ${showPre ? field('prefix', busy) : ''}
    ${showSuf ? field('suffix', busy) : ''}
    ${busy ? '' : `<div class="chips"><span class="chips-label">${t('popular')}</span>${CHIPS[chipKind].map((c) => `<button class="chip" data-chip="${c}">${c}</button>`).join('')}</div>`}
    <label class="label">${t('caseLabel')}</label>
    ${seg('case', [[true, t('caseAny')], [false, t('caseExact')]], prefs.caseInsensitive, busy)}
    ${busy ? '' : `<p class="note">${prefs.caseInsensitive ? t('hintAny') : t('hintExact')} ${t('allowed')}</p>`}
    <div id="estimate"></div>
    <label class="label">${t('gpuLoad')}</label>
    <div class="power" data-power>${POWER_LEVELS.map(
      (p) => `<button data-p="${p}" class="${prefs.power === p ? 'on' : ''}"><b>${Math.round(p * 100)}%</b><span>${powerName(p)}</span></button>`,
    ).join('')}</div>
    ${
      busy
        ? `<div class="hunt-controls">
            <button class="btn ghost" id="pause">${h.paused ? '▶ ' + t('resume') : '❚❚ ' + t('pause')}</button>
            <button class="btn ghost danger" id="stop">■ ${t('stop')}</button>
          </div>
          <p class="note center">${t('randomNote')} ${t('notifyHint')}</p>`
        : `<details class="adv" ${advOpen ? 'open' : ''}>
            <summary>${t('advanced')}</summary>
            <p class="note">${t('powerNote')}</p>
            <label class="label">${t('network')}</label>
            ${seg('net', [['mainnet', 'Mainnet'], ['testnet', 'Testnet']], prefs.network)}
            <label class="label">${t('apiKey')}</label>
            <input id="apikey" class="plain" placeholder="${esc(t('apiKeyPh'))}" value="${esc(prefs.apiKey)}" />
          </details>
          <button id="go" class="cta" ${ready ? '' : 'disabled'}>${ready ? t('start') : state.device.status === 'nogpu' ? '—' : t('waitBench')}</button>
          <div class="lock">🔒 ${t('localNote')}</div>`
    }
  `;

  el.querySelectorAll('[data-field]').forEach((inp) => {
    inp.oninput = () => {
      const kind = inp.dataset.field;
      const clean = inp.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, MAX_PART);
      if (clean !== inp.value) inp.value = clean;
      prefs[kind] = clean;
      savePrefs();
      inp.parentElement.querySelector('.count').textContent = `${clean.length}/${MAX_PART}`;
      updateLive();
    };
  });
  el.querySelectorAll('[data-seg] button').forEach((b) => {
    b.onclick = () => {
      if (state.hunt) return;
      const k = b.parentElement.dataset.seg;
      if (k === 'mode') prefs.mode = b.dataset.v;
      if (k === 'case') prefs.caseInsensitive = b.dataset.v === 'true';
      if (k === 'net') prefs.network = b.dataset.v;
      savePrefs();
      renderSettings();
      startShowcase();
      renderWaitTable();
    };
  });
  el.querySelectorAll('[data-chip]').forEach((b) => {
    b.onclick = () => {
      prefs[chipKind] = b.dataset.chip;
      savePrefs();
      renderSettings();
      startShowcase();
    };
  });
  el.querySelectorAll('[data-p]').forEach((b) => {
    b.onclick = () => {
      prefs.power = Number(b.dataset.p);
      savePrefs();
      if (state.hunt && miner) miner.power = prefs.power;
      el.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('on', x === b));
      updateLive();
      renderWaitTable();
    };
  });
  $('#apikey') &&
    ($('#apikey').onchange = (e) => {
      prefs.apiKey = e.target.value.trim();
      savePrefs();
    });
  $('#go') && ($('#go').onclick = startHunt);
  $('#pause') && ($('#pause').onclick = togglePause);
  $('#stop') && ($('#stop').onclick = stopHunt);
  updateLive();
}

/** Ошибки полей, оценка в карточке и живая карточка — без перерисовки полей (не сбивает фокус). */
function updateLive() {
  const job = state.hunt ? state.hunt.job : currentJob();
  const v = validateJob(job);
  for (const kind of ['prefix', 'suffix']) {
    const e = document.querySelector(`[data-err="${kind}"]`);
    if (e) e.textContent = v[kind] ? t('err.' + v[kind]) : '';
  }
  const go = $('#go');
  if (go) go.disabled = !v.ok || state.device.status !== 'ready';
  const el = $('#estimate');
  if (el) {
    if (!v.ok) {
      el.innerHTML = v.empty ? `<div class="err">${t('err.empty')}</div>` : '';
    } else {
      const p = matchProbability(job);
      const median = effectiveRate() ? Math.LN2 / p / effectiveRate() : NaN;
      const tr = isFinite(median) ? tier(median) : '';
      el.innerHTML = `
        <div class="attempts"><span>${t('attempts')}</span><b class="mono">${fmtCompact(1 / p)}</b><span class="tier ${tr}">${tr ? t('feasibility.' + tr) : ''}</span></div>
        ${tr === 'long' ? `<div class="warn">${t('longNote')}</div>` : tr === 'insane' ? `<div class="warn bad">${t('tooLong')}</div>` : ''}`;
    }
  }
  startShowcase();
  renderLive();
}

function renderWaitTable() {
  const el = $('#wait');
  if (!el) return;
  const rate = effectiveRate();
  if (!rate) {
    el.innerHTML = '';
    return;
  }
  const rows = [];
  for (let n = 3; n <= MAX_PART; n++) {
    const any = Math.LN2 / Math.pow(2 / 64, n) / rate;
    const exact = Math.LN2 / Math.pow(1 / 64, n) / rate;
    rows.push(`<tr><td class="mono">${n}</td><td class="${tier(any)}">${fmtDur(any)}</td><td class="${tier(exact)}">${fmtDur(exact)}</td></tr>`);
  }
  el.innerHTML = `
    <h2>${t('waitTitle')}</h2>
    <p class="sub">${t('waitSub', fmtRate(rate))} ${t('waitBoth')}</p>
    <div class="table-wrap"><table class="wait">
      <thead><tr><th>${t('chars')}</th><th>${t('anyCase')}</th><th>${t('exactCase')}</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
}

function renderMine() {
  const el = $('#mine');
  if (!el) return;
  el.innerHTML = `
    <h2>${t('myTitle')}</h2>
    <p class="sub">${t('mySub')}</p>
    ${
      state.found.length
        ? `<div class="cards">${state.found
            .map(
              (f) => `
      <div class="card found-card">
        <div class="row-between">
          <span class="pill ${esc(f.status)}">${esc(t('status.' + f.status) || f.status)}</span>
          <span class="muted small">${f.network === 'testnet' ? 'testnet · ' : ''}${new Date(f.createdAt).toLocaleString(locale())}</span>
        </div>
        <div class="mono found-addr">${addrHtml(f.address, f)}</div>
        <div class="row-actions">
          <button class="btn" data-open="${esc(f.address)}">${f.status === 'switched' ? t('open') : t('toClaim')}</button>
          <button class="btn ghost" data-copy="${esc(f.address)}">${t('copyAddr')}</button>
          <button class="btn ghost danger" data-del="${esc(f.address)}">${t('del')}</button>
        </div>
      </div>`,
            )
            .join('')}</div>`
        : `<div class="empty">${t('myEmpty')}</div>`
    }`;
  el.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => openClaim(b.dataset.open)));
  el.querySelectorAll('[data-copy]').forEach((b) => (b.onclick = () => copy(b.dataset.copy, b)));
  el.querySelectorAll('[data-del]').forEach(
    (b) =>
      (b.onclick = () => {
        const f = state.found.find((x) => x.address === b.dataset.del);
        if (!confirm(f?.status === 'found' ? t('delFound') : t('delDone'))) return;
        state.found = state.found.filter((x) => x.address !== b.dataset.del);
        saveFound();
        renderMine();
      }),
  );
}

// ---------------- находка ----------------

function renderFoundView() {
  const h = state.hunt;
  const f = state.found.find((x) => x.address === h.found);
  $('#view').innerHTML = `
    <section class="hunt found-view">
      <span class="badge"><i></i>${t('badgeLocal')}</span>
      <h1 class="hunt-title grad">${t('foundTitle')}</h1>
      <p class="lead center">${t('foundSub', esc(patternLabel(h.job)), fmtInt(h.checked))}</p>
      <div class="found-big mono">${addrHtml(h.found, h.job)}</div>
      <div class="controls">
        <button class="cta" id="claim">${t('toClaim')}</button>
      </div>
      <div class="controls">
        <button class="btn ghost" id="copyf">${t('copyAddr')}</button>
        <button class="btn ghost" id="again">${t('searchAgain')}</button>
      </div>
    </section>`;
  $('#claim').onclick = () => openClaim(f.address);
  $('#copyf').onclick = (e) => copy(h.found, e.target);
  $('#again').onclick = () => {
    state.hunt = null;
    state.view = 'home';
    document.title = 'Fancy';
    render();
  };
}

// ---------------- оформление: 24 слова → пополнение → смена ключа → импорт ----------------

let claimTimer = null;

function openClaim(address) {
  const f = state.found.find((x) => x.address === address);
  if (!f) return;
  if (!f.signing) {
    // вторая половина фразы — тоже только в этом браузере
    f.signing = generateMnemonic(WORDLIST, 128).split(' ');
    saveFound();
  }
  state.claim = address;
  state.claimUi = { address, revealed: false, wrote: f.status !== 'found', busy: false, msg: '' };
  state.hunt = null;
  state.view = 'claim';
  document.title = 'Fancy';
  render();
  window.scrollTo({ top: 0 });
}

function wordsGrid(words, offset, hidden) {
  return `<ol class="words ${hidden ? 'hidden' : ''}">${words
    .map((w, i) => `<li><span class="n">${offset + i + 1}</span><span class="w mono">${esc(w)}</span></li>`)
    .join('')}</ol>`;
}

function renderClaim() {
  clearInterval(claimTimer);
  const f = state.found.find((x) => x.address === state.claim);
  if (!f) {
    state.view = 'home';
    return render();
  }
  const ui = state.claimUi;
  const step = f.status === 'switched' ? 3 : ui.wrote ? 2 : 1;
  const link = `ton://transfer/${f.address}?amount=${ACTIVATION_NANO}`;
  const end = f.suffix ? f.address.slice(-Math.max(4, f.suffix.length)) : f.address.slice(-4);

  $('#view').innerHTML = `
    <section class="claim">
      <button class="back" id="back">← ${t('back')}</button>
      <h1 class="hunt-title">${t('claimTitle')}</h1>
      <div class="found-big mono">${addrHtml(f.address, f)}</div>

      <div class="step ${step === 1 ? 'active' : 'done'}">
        <h3><span class="sn">1</span>${t('s1')}</h3>
        <p class="muted">${t('s1text')}</p>
        <div class="words-wrap">
          <div><div class="label">${t('anchorLabel')}</div>${wordsGrid(f.anchor, 0, !ui.revealed)}</div>
          <div><div class="label">${t('signingLabel')}</div>${wordsGrid(f.signing, 12, !ui.revealed)}</div>
        </div>
        <div class="row-actions">
          ${ui.revealed ? `<button class="btn ghost" id="copy24">${t('copy24')}</button>` : `<button class="btn" id="reveal">${t('reveal')}</button>`}
          ${step === 1 && ui.revealed ? `<label class="check"><input type="checkbox" id="wrote"> ${t('wrote')}</label>` : ''}
        </div>
      </div>

      <div class="step ${step === 2 ? 'active' : step > 2 ? 'done' : 'locked'}">
        <h3><span class="sn">2</span>${t('s2')}</h3>
        <p class="muted">${t('s2text', ACTIVATION_GRAM)}</p>
        <div class="fund">
          <code class="mono">${esc(f.address)}</code>
          <button class="btn ghost" id="copy-addr">${t('copyAddr')}</button>
          ${f.network === 'mainnet' ? `<a class="btn ghost" href="${esc(link)}">${t('openWallet')}</a>` : ''}
        </div>
        <div id="chain" class="muted small">${step === 2 ? t('checkingChain') : ''}</div>
        <div class="row-actions"><button class="cta inline" id="switch" disabled>${t('switchKey')}</button></div>
        <div class="msg" id="msg">${esc(ui.msg || '')}</div>
      </div>

      <div class="step ${step === 3 ? 'active' : 'locked'}">
        <h3><span class="sn">3</span>${t('s3')}</h3>
        <ol class="import"><li>${t('import1')}</li><li>${t('import2')}</li><li>${t('import3', esc(end))}</li></ol>
        ${
          f.status === 'switched'
            ? `<p class="ok">${t('switchedOk')}</p>
          <div class="row-actions"><a class="btn ghost" target="_blank" rel="noopener" href="https://${f.network === 'testnet' ? 'testnet.' : ''}tonviewer.com/${esc(f.address)}">${t('explorer')}</a></div>
          <p class="muted small">${t('afterImport')}</p>`
            : ''
        }
      </div>
    </section>`;

  $('#back').onclick = () => {
    clearInterval(claimTimer);
    state.view = 'home';
    render();
  };
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
  if (ui.busy || state.view !== 'claim') return;
  const api = new Toncenter(f.network, prefs.apiKey);
  try {
    const st = await api.getState(f.address);
    const signing = await wordsToWallet(f.signing, f.network);
    let onchainKey = null;
    if (st.state === 'active') onchainKey = await api.getPublicKeyHex(f.address).catch(() => null);
    if (onchainKey && onchainKey === bytesToHex(signing.publicKey)) {
      f.status = 'switched';
      saveFound();
      return renderClaim();
    }
    if (st.balance > 0n && f.status === 'found') {
      f.status = 'funded';
      saveFound();
    }
    const enough = st.balance >= 10_000_000n;
    const el = $('#chain');
    if (el)
      el.innerHTML = `${t('balance')}: <b class="mono">${formatGram(st.balance)} GRAM</b> · ${t('contract')}: ${
        st.state === 'active' ? t('deployed') : t('notDeployed')
      }${enough ? '' : ' · ' + t('waitingFunds')}`;
    const btn = $('#switch');
    if (btn) btn.disabled = !enough || st.state === 'frozen';
  } catch (e) {
    const el = $('#chain');
    if (el) el.textContent = t('netError', e.message || e);
  }
}

async function switchKey(f) {
  const ui = state.claimUi;
  if (ui.busy) return;
  ui.busy = true;
  const btn = $('#switch');
  btn.disabled = true;
  btn.textContent = t('sending');
  const setMsg = (m) => {
    ui.msg = m;
    const el = $('#msg');
    if (el) el.textContent = m;
  };
  try {
    const api = new Toncenter(f.network, prefs.apiKey);
    const anchor = await wordsToWallet(f.anchor, f.network);
    const signing = await wordsToWallet(f.signing, f.network);
    if (anchor.address !== f.address) throw new Error(t('errAnchor'));

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
        return renderClaim();
      }
      if (key !== bytesToHex(anchor.publicKey)) throw new Error(t('errForeignKey'));
      seqno = Number(await api.getNumber(f.address, 'seqno'));
    } else if (st.state !== 'uninitialized') {
      throw new Error(t('errState', st.state));
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
    setMsg(t('sent'));

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
          return renderClaim();
        }
      } catch {
        /* контракт ещё не появился — ждём */
      }
    }
    throw new Error(t('errTimeout'));
  } catch (e) {
    setMsg(t('errPrefix') + (e.message || e));
    btn.textContent = t('switchKey');
    btn.disabled = false;
  } finally {
    ui.busy = false;
  }
}

// ---------------- старт ----------------

if (import.meta.env.DEV) window.__fancy = { state, prefs, get miner() { return miner; } };

render();
detectDevice();
