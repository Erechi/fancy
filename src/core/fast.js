// Быстрый путь «12 слов → адрес WalletTg» без @ton/core.
// Используется в воркерах майнинга и для проверки найденного результата.
//
// Схема Telegram Wallet (та же, что у vanity.tg):
//   12 слов BIP39 → PBKDF2-SHA512(2048, salt "mnemonic") → SLIP-10 ed25519 m/44'/607'/0'
//   → публичный ключ → stateInit(трамплин WalletTg + storage) → адрес.

import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export const WORDLIST = wordlist;

/** contracts/WalletTrampoline.boc из ton-blockchain/tg-wallet-contract. */
export const TRAMPOLINE_BOC_HEX =
  'b5ee9c7241010101001a000030ff00209821d7498308b9f240df8085f833d0ed1e20ed53d969427e39';
/** Хеш ячейки кода трамплина (depth 0). Проверяется тестом против @ton/core. */
export const TRAMPOLINE_CODE_HASH = hexToBytes(
  '9149ae51c1e4689710cebf7830297b16acfbadb363a920a537893e7ffeeca768',
);

export const NETWORKS = {
  mainnet: { subwalletId: 0x7fff7f11, testOnly: false },
  testnet: { subwalletId: 0x7fff7ffd, testOnly: true },
};

const enc = new TextEncoder();
const WORD_BYTES = wordlist.map((w) => enc.encode(w));
const SLIP10_PATH = [44, 607, 0];

export function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

export function bytesToHex(b) {
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}

/** 16 байт энтропии → 12 индексов слов BIP39 (4 бита чек-суммы из sha256). */
export function entropyToIndices(entropy) {
  const cs = sha256(entropy)[0] >> 4;
  // 132 бита: 128 энтропии + 4 чек-суммы, читаем по 11
  const idx = new Array(12);
  let acc = 0;
  let accBits = 0;
  let k = 0;
  for (let i = 0; i < 17; i++) {
    const byte = i < 16 ? entropy[i] : cs << 4;
    acc = (acc << 8) | byte;
    accBits += 8;
    while (accBits >= 11 && k < 12) {
      accBits -= 11;
      idx[k++] = (acc >>> accBits) & 0x7ff;
    }
    acc &= (1 << accBits) - 1;
  }
  return idx;
}

export function indicesToWords(idx) {
  return idx.map((i) => wordlist[i]);
}

/** Байты строки «word1 word2 … word12» (NFKD для английского списка — то же самое). */
export function indicesToPhraseBytes(idx) {
  let len = 11;
  for (const i of idx) len += WORD_BYTES[i].length;
  const out = new Uint8Array(len);
  let p = 0;
  for (let k = 0; k < idx.length; k++) {
    if (k) out[p++] = 0x20;
    out.set(WORD_BYTES[idx[k]], p);
    p += WORD_BYTES[idx[k]].length;
  }
  return out;
}

const SALT = enc.encode('mnemonic');

/** BIP39 seed через нативный WebCrypto PBKDF2. */
export async function phraseBytesToSeed(phraseBytes) {
  const key = await crypto.subtle.importKey('raw', phraseBytes, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-512', salt: SALT, iterations: 2048 },
    key,
    512,
  );
  return new Uint8Array(bits);
}

/**
 * То же на чистом JS. WebCrypto в браузере выполняет PBKDF2 по одному на страницу,
 * а этот вариант честно параллелится по воркерам.
 */
export function phraseBytesToSeedSync(phraseBytes) {
  return pbkdf2(sha512, phraseBytes, SALT, { c: 2048, dkLen: 64 });
}

const ED_SEED_KEY = enc.encode('ed25519 seed');

/** SLIP-10 ed25519, путь m/44'/607'/0' — как у Telegram Wallet. Возвращает 32-байтный приватный ключ. */
export function seedToPrivateKey(seed) {
  let I = hmac(sha512, ED_SEED_KEY, seed);
  let key = I.subarray(0, 32);
  let chain = I.subarray(32);
  const data = new Uint8Array(37);
  for (const index of SLIP10_PATH) {
    data[0] = 0;
    data.set(key, 1);
    const v = (index | 0x80000000) >>> 0;
    data[33] = v >>> 24;
    data[34] = (v >>> 16) & 0xff;
    data[35] = (v >>> 8) & 0xff;
    data[36] = v & 0xff;
    I = hmac(sha512, chain, data);
    key = I.subarray(0, 32);
    chain = I.subarray(32);
  }
  return key.slice();
}

export function privateToPublic(priv) {
  return ed25519.getPublicKey(priv);
}

/**
 * Хеш stateInit = адрес аккаунта.
 * data-ячейка: Storage { 0x00:uint8, seqno:uint32=0, subwalletId:uint32, publicKey:uint256 } = 328 бит.
 * stateInit: биты 00110 (code и data — ссылки), 2 ссылки глубины 0.
 */
const DATA_REPR = new Uint8Array(2 + 41);
const INIT_REPR = new Uint8Array(3 + 4 + 64);
DATA_REPR[0] = 0; // refs=0, ordinary
DATA_REPR[1] = 82; // 41 полный байт
INIT_REPR[0] = 2; // 2 ссылки
INIT_REPR[1] = 1; // 5 бит → 1 неполный байт
INIT_REPR[2] = 0x34; // 00110 + тег завершения 1 + 00
// глубины обеих ссылок = 0 (байты 3..6 остаются нулями)
INIT_REPR.set(TRAMPOLINE_CODE_HASH, 7);

export function addressHash(publicKey, subwalletId) {
  // data[0] = revision 0x00, seqno = 0 → байты 2..6 нули
  DATA_REPR[7] = subwalletId >>> 24;
  DATA_REPR[8] = (subwalletId >>> 16) & 0xff;
  DATA_REPR[9] = (subwalletId >>> 8) & 0xff;
  DATA_REPR[10] = subwalletId & 0xff;
  DATA_REPR.set(publicKey, 11);
  INIT_REPR.set(sha256(DATA_REPR), 39);
  return sha256(INIT_REPR);
}

function crc16(data) {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const ADDR_BUF = new Uint8Array(36);

/** Неотскакиваемый (UQ…) user-friendly адрес в workchain 0. */
export function friendlyAddress(hash, testOnly = false) {
  ADDR_BUF[0] = testOnly ? 0x51 | 0x80 : 0x51;
  ADDR_BUF[1] = 0;
  ADDR_BUF.set(hash, 2);
  const crc = crc16(ADDR_BUF.subarray(0, 34));
  ADDR_BUF[34] = crc >>> 8;
  ADDR_BUF[35] = crc & 0xff;
  let s = '';
  for (let i = 0; i < 36; i += 3) {
    const n = (ADDR_BUF[i] << 16) | (ADDR_BUF[i + 1] << 8) | ADDR_BUF[i + 2];
    s += B64URL[n >>> 18] + B64URL[(n >>> 12) & 63] + B64URL[(n >>> 6) & 63] + B64URL[n & 63];
  }
  return s;
}

/** Полный путь для одной фразы из 12 слов. Медленный (PBKDF2), но независимый от майнера. */
export async function wordsToWallet(words, network = 'mainnet') {
  const idx = words.map((w) => {
    const i = wordlist.indexOf(w);
    if (i < 0) throw new Error(`Слово «${w}» не из списка BIP39`);
    return i;
  });
  const seed = await phraseBytesToSeed(indicesToPhraseBytes(idx));
  const privateKey = seedToPrivateKey(seed);
  const publicKey = privateToPublic(privateKey);
  const net = NETWORKS[network];
  const hash = addressHash(publicKey, net.subwalletId);
  return { privateKey, publicKey, hash, address: friendlyAddress(hash, net.testOnly) };
}

// ---------- Шаблон ----------
// job = { prefix: 'Dog', suffix: 'GRAM', caseInsensitive: true } — любая из частей может быть пустой.

export const PATTERN_CHARS = /^[A-Za-z0-9_-]+$/;
export const MAX_PART = 8;

/** Код ошибки одной части (переводится в интерфейсе) или null. */
export function validatePart(text, kind, caseInsensitive = true) {
  if (!text) return null;
  if (!PATTERN_CHARS.test(text)) return 'chars';
  if (text.length > MAX_PART) return 'long';
  // адрес всегда начинается с «UQ» (в тестнете «0Q»), третий символ — только A–D
  if (kind === 'prefix' && !(caseInsensitive ? /^[A-Da-d]/ : /^[A-D]/).test(text)) return 'prefix3';
  return null;
}

export function validateJob(job) {
  const prefix = validatePart(job.prefix, 'prefix', job.caseInsensitive);
  const suffix = validatePart(job.suffix, 'suffix', job.caseInsensitive);
  const empty = !job.prefix && !job.suffix ? 'empty' : null;
  return { prefix, suffix, empty, ok: !prefix && !suffix && !empty };
}

/** Позиции символов в 48-символьном адресе и допустимые варианты для каждой. */
export function patternPositions(job) {
  const out = [];
  const push = (ch, index) => {
    const letter = /[A-Za-z]/.test(ch);
    const alts = job.caseInsensitive && letter ? [ch.toUpperCase(), ch.toLowerCase()] : [ch];
    out.push({ index, alts });
  };
  const p = job.prefix || '';
  const sfx = job.suffix || '';
  for (let i = 0; i < p.length; i++) push(p[i], 2 + i);
  for (let i = 0; i < sfx.length; i++) push(sfx[i], 48 - sfx.length + i);
  return out;
}

export function makeMatcher(job) {
  const pos = patternPositions(job);
  return (a) => pos.every(({ index, alts }) => alts.includes(a[index]));
}

/** Вероятность совпадения одного кандидата. Третий символ адреса — только A–D (1/4). */
export function matchProbability(job) {
  let p = 1;
  for (const { index, alts } of patternPositions(job)) {
    p *= index === 2 ? 1 / 4 : alts.length / 64;
  }
  return p;
}
