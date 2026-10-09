// WebGPU-майнер: обвязка вокруг vanity.wgsl.
// Перед майнингом прогоняет самопроверку: GPU и CPU считают одни и те же фразы,
// любое расхождение — GPU не используется.

import { ed25519 } from '@noble/curves/ed25519.js';
import shaderSource from './vanity.wgsl?raw';
import { sha512M64Wgsl } from './sha512-unrolled.js';

const shaderCode = (wg) => `const WG: u32 = ${wg}u;\n${shaderSource}\n${sha512M64Wgsl()}`;
import {
  NETWORKS,
  WORDLIST,
  bytesToHex,
  entropyToIndices,
  indicesToWords,
  wordsToWallet,
  makeMatcher,
  patternPositions,
} from '../core/fast.js';

const K512 = [
  '428a2f98d728ae22', '7137449123ef65cd', 'b5c0fbcfec4d3b2f', 'e9b5dba58189dbbc', '3956c25bf348b538',
  '59f111f1b605d019', '923f82a4af194f9b', 'ab1c5ed5da6d8118', 'd807aa98a3030242', '12835b0145706fbe',
  '243185be4ee4b28c', '550c7dc3d5ffb4e2', '72be5d74f27b896f', '80deb1fe3b1696b1', '9bdc06a725c71235',
  'c19bf174cf692694', 'e49b69c19ef14ad2', 'efbe4786384f25e3', '0fc19dc68b8cd5b5', '240ca1cc77ac9c65',
  '2de92c6f592b0275', '4a7484aa6ea6e483', '5cb0a9dcbd41fbd4', '76f988da831153b5', '983e5152ee66dfab',
  'a831c66d2db43210', 'b00327c898fb213f', 'bf597fc7beef0ee4', 'c6e00bf33da88fc2', 'd5a79147930aa725',
  '06ca6351e003826f', '142929670a0e6e70', '27b70a8546d22ffc', '2e1b21385c26c926', '4d2c6dfc5ac42aed',
  '53380d139d95b3df', '650a73548baf63de', '766a0abb3c77b2a8', '81c2c92e47edaee6', '92722c851482353b',
  'a2bfe8a14cf10364', 'a81a664bbc423001', 'c24b8b70d0f89791', 'c76c51a30654be30', 'd192e819d6ef5218',
  'd69906245565a910', 'f40e35855771202a', '106aa07032bbd1b8', '19a4c116b8d2d0c8', '1e376c085141ab53',
  '2748774cdf8eeb99', '34b0bcb5e19b48a8', '391c0cb3c5c95a63', '4ed8aa4ae3418acb', '5b9cca4f7763e373',
  '682e6ff3d6b2b8a3', '748f82ee5defb2fc', '78a5636f43172f60', '84c87814a1f0ab72', '8cc702081a6439ec',
  '90befffa23631e28', 'a4506cebde82bde9', 'bef9a3f7b2c67915', 'c67178f2e372532b', 'ca273eceea26619c',
  'd186b8c721c0c207', 'eada7dd6cde0eb1e', 'f57d4f7fee6ed178', '06f067aa72176fba', '0a637dc5a2c898a6',
  '113f9804bef90dae', '1b710b35131c471b', '28db77f523047d84', '32caab7b40c72493', '3c9ebe0a15c9bebc',
  '431d67c49c100d4c', '4cc5d4becb3e42b6', '597f299cfc657e2a', '5fcb6fab3ad6faec', '6c44198c4a475817',
];
const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const MAX_RESULTS = 64;

// Таймеры свёрнутой вкладки Chrome растягивает до секунды и больше, а таймеры воркера — нет.
let timerWorker;
function sleep(ms) {
  try {
    if (!timerWorker) {
      const src = 'onmessage = (e) => setTimeout(() => postMessage(e.data[0]), e.data[1]);';
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      const pending = new Map();
      let id = 0;
      w.onmessage = (e) => {
        pending.get(e.data)?.();
        pending.delete(e.data);
      };
      timerWorker = (t) =>
        new Promise((r) => {
          pending.set(++id, r);
          w.postMessage([id, t]);
        });
    }
    // страховка: если воркер не ответит (например, его запретил CSP), не зависаем
    return Promise.race([timerWorker(ms), new Promise((r) => setTimeout(r, ms + 1500))]);
  } catch {
    return new Promise((r) => setTimeout(r, ms));
  }
}
const TARGET_MS = 220;

function k512Buffer() {
  const u = new Uint32Array(80 * 4);
  K512.forEach((h, i) => {
    u[i * 4] = parseInt(h.slice(0, 8), 16);
    u[i * 4 + 1] = parseInt(h.slice(8), 16);
  });
  return u;
}

function wordsBuffer() {
  const u = new Uint32Array(2048 * 3);
  const enc = new TextEncoder();
  WORDLIST.forEach((w, i) => {
    const b = new Uint8Array(8);
    b.set(enc.encode(w));
    u[i * 3] = w.length;
    u[i * 3 + 1] = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    u[i * 3 + 2] = ((b[4] << 24) | (b[5] << 16) | (b[6] << 8) | b[7]) >>> 0;
  });
  return u;
}

/** Таблица j·16^i·B, i = 0..63, j = 0..15, в виде (y+x, y−x, 2dxy) по 16 лимбов × 16 бит. */
function tableBuffer() {
  const p = 2n ** 255n - 19n;
  const mod = (a) => ((a % p) + p) % p;
  const pow = (b, e) => {
    let r = 1n;
    b = mod(b);
    while (e > 0n) {
      if (e & 1n) r = (r * b) % p;
      b = (b * b) % p;
      e >>= 1n;
    }
    return r;
  };
  const d = mod(-121665n * pow(121666n, p - 2n));
  const d2 = mod(2n * d);
  const u = new Uint32Array(64 * 16 * 3 * 8);
  const putFe = (off, v) => {
    for (let m = 0; m < 8; m++) {
      const lo = Number((v >> BigInt(32 * m)) & 0xffffn);
      const hi = Number((v >> BigInt(32 * m + 16)) & 0xffffn);
      u[off + m] = (lo | (hi << 16)) >>> 0;
    }
  };
  const Point = ed25519.Point;
  let base = Point.BASE;
  for (let i = 0; i < 64; i++) {
    let acc = Point.ZERO;
    for (let j = 0; j < 16; j++) {
      const off = (i * 16 + j) * 3 * 8;
      if (j === 0) {
        putFe(off, 1n);
        putFe(off + 8, 1n);
        putFe(off + 16, 0n);
      } else {
        acc = acc.add(base);
        const { x, y } = acc.toAffine();
        putFe(off, mod(y + x));
        putFe(off + 8, mod(y - x));
        putFe(off + 16, mod(d2 * x * y));
      }
    }
    base = base.double().double().double().double();
  }
  return u;
}

/** Позиции и 6-битные значения символов шаблона для шейдера (до 16 позиций). */
function patternUniform(job) {
  const pos = patternPositions(job);
  const out = { len: pos.length, pos: new Uint32Array(16), a: new Uint32Array(16), b: new Uint32Array(16) };
  pos.forEach(({ index, alts }, i) => {
    out.pos[i] = index;
    out.a[i] = B64URL.indexOf(alts[0]);
    out.b[i] = B64URL.indexOf(alts[alts.length - 1]);
  });
  return out;
}

function toBase64Url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    s += B64URL[n >>> 18] + B64URL[(n >>> 12) & 63] + B64URL[(n >>> 6) & 63] + B64URL[n & 63];
  }
  return s;
}

function entropyBytes(w0, w1, w2, w3) {
  const b = new Uint8Array(16);
  const v = new DataView(b.buffer);
  v.setUint32(0, w0);
  v.setUint32(4, w1);
  v.setUint32(8, w2);
  v.setUint32(12, w3);
  return b;
}

export class GpuMiner {
  static async create({ workgroupSize = 64 } = {}) {
    if (!navigator.gpu) throw new Error('Браузер не поддерживает WebGPU');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('Видеокарта недоступна для WebGPU');
    const device = await adapter.requestDevice();
    const m = new GpuMiner();
    m.wg = workgroupSize;
    m.adapterName = [adapter.info?.vendor, adapter.info?.architecture, adapter.info?.description]
      .filter(Boolean)
      .join(' ');
    await m.#init(device);
    return m;
  }

  async #init(device) {
    this.device = device;
    device.lost.then((info) => {
      this.lost = info.message || 'GPU device lost';
      this.running = false;
    });
    const mk = (data, usage) => {
      const buf = device.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(buf, 0, data);
      return buf;
    };
    this.k512 = mk(k512Buffer(), GPUBufferUsage.UNIFORM);
    this.k256 = mk(new Uint32Array(K256), GPUBufferUsage.UNIFORM);
    this.words = mk(wordsBuffer(), GPUBufferUsage.STORAGE);
    this.table = mk(tableBuffer(), GPUBufferUsage.STORAGE);

    const module = device.createShaderModule({ code: shaderCode(this.wg) });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((x) => x.type === 'error');
    if (errors.length) throw new Error('WGSL: ' + errors.map((e) => `${e.lineNum}:${e.linePos} ${e.message}`).join('; '));
    this.pipeline = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });
    this.slots = [this.#makeSlot(), this.#makeSlot()];
  }

  #makeSlot(debugBytes = 256) {
    const d = this.device;
    const params = d.createBuffer({ size: 240, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    // счётчик + находки + 9 слов «последнего кандидата»
    const outSize = 16 + MAX_RESULTS * 16 + 9 * 4;
    const out = d.createBuffer({
      size: outSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    const read = d.createBuffer({ size: outSize, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const dbg = d.createBuffer({ size: debugBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const bind = d.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: params } },
        { binding: 1, resource: { buffer: this.k512 } },
        { binding: 2, resource: { buffer: this.k256 } },
        { binding: 3, resource: { buffer: this.words } },
        { binding: 4, resource: { buffer: this.table } },
        { binding: 5, resource: { buffer: out } },
        { binding: 6, resource: { buffer: dbg } },
      ],
    });
    return { params, out, read, dbg, bind, outSize };
  }

  #encode(slot, { base, count, net, pattern, mode = 0, dbgRead = null }) {
    const d = this.device;
    const u = new Uint32Array(60);
    u.set(base, 0);
    u[4] = net.subwalletId;
    u[5] = net.testOnly ? 0xd1 : 0x51;
    u[6] = pattern.len;
    u[7] = mode;
    u[8] = count;
    u.set(pattern.pos, 12);
    u.set(pattern.a, 28);
    u.set(pattern.b, 44);
    d.queue.writeBuffer(slot.params, 0, u);
    d.queue.writeBuffer(slot.out, 0, new Uint32Array(4));
    const enc = d.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, slot.bind);
    const wg = Math.ceil(count / this.wg);
    const x = Math.min(wg, 32768);
    pass.dispatchWorkgroups(x, Math.ceil(wg / x));
    pass.end();
    enc.copyBufferToBuffer(slot.out, 0, slot.read, 0, slot.outSize);
    if (dbgRead) enc.copyBufferToBuffer(slot.dbg, 0, dbgRead, 0, dbgRead.size);
    d.queue.submit([enc.finish()]);
  }

  /** Сверяет GPU с CPU на n случайных фразах. Бросает исключение при любом расхождении. */
  async selfTest(n = 16) {
    const slot = this.#makeSlot(n * 40 * 4);
    const dbgRead = this.device.createBuffer({
      size: n * 40 * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const base = crypto.getRandomValues(new Uint32Array(4));
    const net = NETWORKS.mainnet;
    // шаблон длины 0 совпадает всегда — заодно проверяем возврат находок
    const pattern = { len: 0, pos: new Uint32Array(16), a: new Uint32Array(16), b: new Uint32Array(16) };
    this.#encode(slot, { base, count: n, net, pattern, mode: 1, dbgRead });
    await Promise.all([slot.read.mapAsync(GPUMapMode.READ), dbgRead.mapAsync(GPUMapMode.READ)]);
    const dbg = new Uint32Array(dbgRead.getMappedRange().slice(0));
    const found = new Uint32Array(slot.read.getMappedRange().slice(0))[0];
    slot.read.unmap();
    dbgRead.unmap();
    if (found !== n) throw new Error(`самопроверка: ожидалось ${n} находок, получено ${found}`);

    for (let g = 0; g < n; g++) {
      const ent = entropyBytes(base[0], base[1], base[2], (base[3] ^ g) >>> 0);
      const words = indicesToWords(entropyToIndices(ent));
      const ref = await wordsToWallet(words, 'mainnet');
      const o = g * 40;
      const be = (from, cnt) => {
        let s = '';
        for (let i = 0; i < cnt; i++) s += dbg[o + from + i].toString(16).padStart(8, '0');
        return s;
      };
      const le = (from, cnt) => {
        let s = '';
        for (let i = 0; i < cnt; i++) {
          const v = dbg[o + from + i];
          for (let k = 0; k < 4; k++) s += ((v >>> (8 * k)) & 0xff).toString(16).padStart(2, '0');
        }
        return s;
      };
      const checks = [
        ['приватный ключ', be(16, 8), bytesToHex(ref.privateKey)],
        ['публичный ключ', le(24, 8), bytesToHex(ref.publicKey)],
        ['хеш адреса', be(32, 8), bytesToHex(ref.hash)],
      ];
      for (const [name, got, want] of checks) {
        if (got !== want) throw new Error(`самопроверка GPU: не совпал ${name} (поток ${g})`);
      }
    }
    for (const b of [slot.params, slot.out, slot.read, slot.dbg, dbgRead]) b.destroy();
    return true;
  }

  /**
   * Майнинг до первой находки или stop(). onProgress(checked, rate, sampleAddress), onFound({words, address}).
   * this.power (0..1] можно менять на ходу: GPU простаивает долю времени, чтобы не грузить систему.
   */
  async run(job, onProgress, onFound) {
    this.running = true;
    const { network } = job;
    const net = NETWORKS[network];
    const pattern = patternUniform(job);
    const match = makeMatcher(job);
    let count = 8192;
    let checked = 0;
    let lastDone = performance.now();
    let i = 0;
    let prev = null;
    const maxCount = this.wg * 32768 * 4;

    const collect = async (slot, n) => {
      await slot.read.mapAsync(GPUMapMode.READ);
      const r = new Uint32Array(slot.read.getMappedRange().slice(0));
      slot.read.unmap();
      const now = performance.now();
      const dt = now - lastDone;
      lastDone = now;
      checked += n;
      const sb = new Uint8Array(36);
      const sv = new DataView(sb.buffer);
      for (let j = 0; j < 9; j++) sv.setUint32(4 * j, r[4 + MAX_RESULTS * 4 + j]);
      const sample = toBase64Url(sb);
      const hits = Math.min(r[0], MAX_RESULTS);
      for (let h = 0; h < hits; h++) {
        const ent = entropyBytes(r[4 + h * 4], r[5 + h * 4], r[6 + h * 4], r[7 + h * 4]);
        const words = indicesToWords(entropyToIndices(ent));
        const w = await wordsToWallet(words, network);
        // доверяем только тому, что подтвердил CPU
        if (match(w.address)) onFound({ words, address: w.address });
      }
      return { dt, n, sample };
    };

    // один запуск забран: прогресс, подстройка размера и пауза при сниженной нагрузке
    const step = async ({ slot, n }, power) => {
      const { dt, sample } = await collect(slot, n);
      const idle = power < 1 ? (dt * (1 - power)) / power : 0;
      onProgress(checked, (n / (dt + idle)) * 1000, sample);
      // подгоняем размер запуска под ~220 мс, чтобы не ловить таймаут драйвера
      const k = Math.max(0.5, Math.min(2, TARGET_MS / Math.max(dt, 1)));
      count = Math.max(1024, Math.min(maxCount, Math.round((count * k) / 1024) * 1024));
      if (idle) await sleep(idle);
    };

    try {
      while (this.running) {
        const power = Math.min(1, Math.max(0.1, this.power ?? 1));
        const slot = this.slots[i++ & 1];
        const n = count;
        if (power >= 1) {
          // конвейер: пока GPU считает этот запуск, забираем предыдущий
          this.#encode(slot, { base: crypto.getRandomValues(new Uint32Array(4)), count: n, net, pattern });
          if (prev) await step(prev, 1);
          prev = { slot, n };
        } else {
          // со сниженной нагрузкой — строго по очереди, иначе в паузе GPU досчитывает следующий запуск
          if (prev) {
            await step(prev, 1);
            prev = null;
          }
          lastDone = performance.now();
          this.#encode(slot, { base: crypto.getRandomValues(new Uint32Array(4)), count: n, net, pattern });
          await step({ slot, n }, power);
        }
        if (this.lost) throw new Error(this.lost);
      }
      if (prev) await collect(prev.slot, prev.n);
    } finally {
      this.running = false;
    }
    if (this.lost) throw new Error(this.lost);
  }

  stop() {
    this.running = false;
  }
}
