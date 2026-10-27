// BIP39 seed (PBKDF2-HMAC-SHA512, 2048 итераций) на WebAssembly для режима «процессор».
// Модуль не лежит готовым файлом: его байты собирает генератор ниже — так же, как шейдер для видеокарты.
// В WebAssembly есть настоящие 64-битные числа, поэтому SHA-512 здесь в разы быстрее, чем на JavaScript.
//
// Память (смещения в байтах, все числа — i64):
//   KEY 0..127   — фраза-ключ HMAC, 16 слов (JS кладёт их парами u32: младшее, старшее)
//   IST, OST     — состояния SHA-512 после блока ключа ^ ipad / ^ opad
//   U, TMP, T    — текущее звено PBKDF2, промежуточный хеш, накопленный XOR (результат)
import { K512 } from '../miner/sha512-unrolled.js';

const KEY = 0;
const IST = 128;
const OST = 192;
const U = 256;
const TMP = 320;
const T = 384;
const BLK = 448; // 16 слов: блок ключа ^ pad или первый блок соли
const IV = 576;

const SHA512_IV = [
  '6a09e667f3bcc908', 'bb67ae8584caa73b', '3c6ef372fe94f82b', 'a54ff53a5f1d36f1',
  '510e527fade682d1', '9b05688c2b3e6c1f', '1f83d9abfb41bd6b', '5be0cd19137e2179',
];

// ---------------- кодирование WebAssembly ----------------

const u32 = (n) => {
  const out = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return out;
};
const s64 = (v) => {
  v = BigInt.asIntN(64, BigInt(v));
  const out = [];
  for (;;) {
    const b = Number(v & 0x7fn);
    v >>= 7n;
    const done = (v === 0n && !(b & 0x40)) || (v === -1n && b & 0x40);
    out.push(done ? b : b | 0x80);
    if (done) return out;
  }
};
const vec = (items) => [...u32(items.length), ...items.flat()];
const section = (id, body) => [id, ...u32(body.length), ...body];

const I32 = 0x7f;
const I64 = 0x7e;
const get = (i) => [0x20, ...u32(i)];
const set = (i) => [0x21, ...u32(i)];
const c64 = (v) => [0x42, ...s64(v)];
const c32 = (v) => [0x41, ...s64(v)];
const op = (code) => (x, y) => [...x, ...y, code];
const add = op(0x7c);
const and = op(0x83);
const or = op(0x84);
const xor = op(0x85);
const rotr = (x, n) => [...x, ...c64(n), 0x8a];
const shr = (x, n) => [...x, ...c64(n), 0x88];
const hex = (h) => BigInt('0x' + h);
// загрузка/запись i64 по адресу из параметра + смещение и по абсолютному адресу
const load = (base, off) => [...get(base), 0x29, 3, ...u32(off)];
const store = (base, off, val) => [...get(base), ...val, 0x37, 3, ...u32(off)];
const loadAt = (addr) => [...c32(addr), 0x29, 3, 0];
const storeAt = (addr, val) => [...c32(addr), ...val, 0x37, 3, 0];
const call = (fn, ...args) => [...args.flatMap((a) => c32(a)), 0x10, ...u32(fn)];

/**
 * Сжатие SHA-512, полностью развёрнутое: compress(st, msg, out) — out = st + раунды(st, msg).
 * short: сообщение — 8 слов из msg, слова 8..15 — постоянное дополнение для 192-байтного HMAC-сообщения.
 * Всё читается в локальные переменные до первой записи, поэтому out может совпадать с msg.
 */
function compressBody(short) {
  const ST = 0;
  const MSG = 1;
  const OUT = 2;
  let n = 3;
  const S = Array.from({ length: 8 }, () => n++);
  const V = Array.from({ length: 8 }, () => n++);
  const W = Array.from({ length: 16 }, () => n++);
  const T1 = n++;
  const T2 = n++;
  const code = [];
  for (let i = 0; i < 8; i++) code.push(...load(ST, 8 * i), 0x22, ...u32(S[i]), ...set(V[i]));
  const pad = ['8000000000000000', '0', '0', '0', '0', '0', '0', '600'];
  for (let i = 0; i < 16; i++) code.push(...(short && i >= 8 ? c64(hex(pad[i - 8])) : load(MSG, 8 * i)), ...set(W[i]));
  const v = (k, i) => V[(((k - i) % 8) + 8) % 8];
  for (let i = 0; i < 80; i++) {
    const [a, b, c, d, e, f, g, h] = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => get(v(k, i)));
    const wi = W[i % 16];
    if (i >= 16) {
      const w15 = get(W[(i + 1) % 16]);
      const w2 = get(W[(i + 14) % 16]);
      const s0 = xor(xor(rotr(w15, 1), rotr(w15, 8)), shr(w15, 7));
      const s1 = xor(xor(rotr(w2, 19), rotr(w2, 61)), shr(w2, 6));
      code.push(...add(add(get(wi), s0), add(get(W[(i + 9) % 16]), s1)), ...set(wi));
    }
    const S1 = xor(xor(rotr(e, 14), rotr(e, 18)), rotr(e, 41));
    const ch = xor(g, and(e, xor(f, g)));
    code.push(...add(add(add(h, S1), add(ch, c64(hex(K512[i])))), get(wi)), ...set(T1));
    const S0 = xor(xor(rotr(a, 28), rotr(a, 34)), rotr(a, 39));
    const maj = or(and(a, b), and(c, or(a, b)));
    code.push(...add(S0, maj), ...set(T2));
    code.push(...add(d, get(T1)), ...set(v(3, i)));
    code.push(...add(get(T1), get(T2)), ...set(v(7, i)));
  }
  for (let i = 0; i < 8; i++) code.push(...store(OUT, 8 * i, add(get(S[i]), get(V[i]))));
  return { locals: [[n - 3, I64]], code };
}

// функции модуля: 0 — сжатие блока из памяти, 1 — сжатие 64-байтного сообщения, 2 — seed()
const F_MEM = 0;
const F_64 = 1;

function seedBody() {
  const CNT = 0;
  const code = [];
  SHA512_IV.forEach((h, i) => code.push(...storeAt(IV + 8 * i, c64(hex(h)))));
  // состояния HMAC: ключ (фраза) ^ ipad и ^ opad
  for (const [pad, out] of [['3636363636363636', IST], ['5c5c5c5c5c5c5c5c', OST]]) {
    for (let i = 0; i < 16; i++) code.push(...storeAt(BLK + 8 * i, xor(loadAt(KEY + 8 * i), c64(hex(pad)))));
    code.push(...call(F_MEM, IV, BLK, out));
  }
  // U1 = HMAC(фраза, "mnemonic" || INT(1)): 128 + 12 байт → длина 1120 бит
  const salt = ['6d6e656d6f6e6963', '0000000180000000', ...Array(13).fill('0'), '460'];
  salt.forEach((h, i) => code.push(...storeAt(BLK + 8 * i, c64(hex(h)))));
  code.push(...call(F_MEM, IST, BLK, TMP), ...call(F_64, OST, TMP, U));
  for (let i = 0; i < 8; i++) code.push(...storeAt(T + 8 * i, loadAt(U + 8 * i)));
  // ещё 2047 звеньев: U = HMAC(U), T ^= U
  code.push(...c32(2047), ...set(CNT), 0x03, 0x40);
  code.push(...call(F_64, IST, U, TMP), ...call(F_64, OST, TMP, U));
  for (let i = 0; i < 8; i++) code.push(...storeAt(T + 8 * i, xor(loadAt(T + 8 * i), loadAt(U + 8 * i))));
  code.push(...get(CNT), ...c32(1), 0x6b, 0x22, ...u32(CNT), 0x0d, 0, 0x0b);
  return { locals: [[1, I32]], code };
}

function buildModule() {
  const fn = ({ locals, code }) => {
    const body = [...vec(locals.map(([cnt, type]) => [...u32(cnt), type])), ...code, 0x0b];
    return [...u32(body.length), ...body];
  };
  const name = (s) => [...u32(s.length), ...new TextEncoder().encode(s)];
  return new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...section(1, vec([[0x60, ...vec([[I32], [I32], [I32]]), 0], [0x60, 0, 0]])),
    ...section(3, vec([[0], [0], [1]])),
    ...section(5, vec([[0x00, 1]])),
    ...section(7, vec([[...name('mem'), 0x02, 0], [...name('seed'), 0x00, 2]])),
    ...section(10, vec([fn(compressBody(false)), fn(compressBody(true)), fn(seedBody())])),
  ]);
}

/**
 * Возвращает функцию phraseBytes → 64 байта BIP39 seed (соль "mnemonic").
 * Компилируется синхронно — вызывать в воркере (в основном потоке браузер ограничивает размер).
 */
export function createSeedHasher() {
  const inst = new WebAssembly.Instance(new WebAssembly.Module(buildModule()), {});
  const mem = new Uint32Array(inst.exports.mem.buffer);
  const key = new Uint8Array(128);
  const out = new Uint8Array(64);
  return (phrase) => {
    if (phrase.length > 128) throw new Error('Фраза длиннее блока HMAC');
    key.fill(0);
    key.set(phrase);
    // слово i64 в памяти little-endian: младшие 32 бита по меньшему адресу
    for (let i = 0; i < 16; i++) {
      const p = 8 * i;
      mem[2 * i + 1] = ((key[p] << 24) | (key[p + 1] << 16) | (key[p + 2] << 8) | key[p + 3]) >>> 0;
      mem[2 * i] = ((key[p + 4] << 24) | (key[p + 5] << 16) | (key[p + 6] << 8) | key[p + 7]) >>> 0;
    }
    inst.exports.seed();
    for (let i = 0; i < 8; i++) {
      const hi = mem[T / 4 + 2 * i + 1];
      const lo = mem[T / 4 + 2 * i];
      out[8 * i] = hi >>> 24;
      out[8 * i + 1] = (hi >>> 16) & 0xff;
      out[8 * i + 2] = (hi >>> 8) & 0xff;
      out[8 * i + 3] = hi & 0xff;
      out[8 * i + 4] = lo >>> 24;
      out[8 * i + 5] = (lo >>> 16) & 0xff;
      out[8 * i + 6] = (lo >>> 8) & 0xff;
      out[8 * i + 7] = lo & 0xff;
    }
    return out.slice();
  };
}
