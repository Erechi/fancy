// Деплой WalletTg и смена ключа на «подписывающие» 12 слов одним external-сообщением.
// Формат запросов — contracts/WalletTg/messages.tolk из ton-blockchain/tg-wallet-contract.

import { Address, Cell, beginCell, contractAddress, external, storeMessage } from '@ton/core';
import { ed25519 } from '@noble/curves/ed25519.js';
import { NETWORKS, TRAMPOLINE_BOC_HEX, hexToBytes } from './fast.js';

const OP_CHANGE_KEY_E = 0xfbba99c8;
const KEY_ROTATION_TAG = BigInt('0x4B45595F524F544154494F4E'); // ASCII "KEY_ROTATION"

let trampoline;
function trampolineCode() {
  trampoline ??= Cell.fromBoc(toBuf(hexToBytes(TRAMPOLINE_BOC_HEX)))[0];
  return trampoline;
}

function toBuf(u8) {
  return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);
}

export function buildStateInit(publicKey, network = 'mainnet') {
  const data = beginCell()
    .storeUint(0x00, 8) // revision prefix Rev00 — контракт мигрирует c4 сам
    .storeUint(0, 32) // seqno
    .storeUint(NETWORKS[network].subwalletId, 32)
    .storeBuffer(toBuf(publicKey), 32)
    .endCell();
  return { code: trampolineCode(), data };
}

export function walletAddress(publicKey, network = 'mainnet') {
  return contractAddress(0, buildStateInit(publicKey, network));
}

/**
 * External-сообщение: [stateInit, если ещё не задеплоен] + SignedRequest<ChangePublicKeyRequestE>.
 * Подписано текущим (anchor) ключом, доказательство — новым ключом.
 *
 * encryptedOldPrivateKey контракт не проверяет — он лишь пишет его в ext-out событие.
 * Для свежего кошелька расшифровывать нечего, поэтому кладём нули (vanity.tg тоже
 * не знает нового приватного ключа и не может посчитать «настоящее» значение).
 */
export function buildDeployAndRotate({
  anchorPrivateKey,
  anchorPublicKey,
  newPrivateKey,
  newPublicKey,
  network = 'mainnet',
  seqno = 0,
  deploy = true,
  validUntil = Math.floor(Date.now() / 1000) + 180,
}) {
  const init = buildStateInit(anchorPublicKey, network);
  const address = contractAddress(0, init);

  const proofPayload = beginCell()
    .storeUint(KEY_ROTATION_TAG, 96)
    .storeInt(address.workChain, 8)
    .storeBuffer(address.hash, 32)
    .endCell();
  const rotationSignature = ed25519.sign(proofPayload.hash(), newPrivateKey);

  const request = beginCell()
    .storeUint(OP_CHANGE_KEY_E, 32)
    .storeUint(NETWORKS[network].subwalletId, 32)
    .storeUint(validUntil, 32)
    .storeUint(seqno, 32)
    .storeBuffer(toBuf(newPublicKey), 32)
    .storeRef(beginCell().storeBuffer(toBuf(rotationSignature), 64).endCell())
    .storeRef(beginCell().storeBuffer(Buffer.alloc(32), 32).endCell())
    .endCell();

  const signature = ed25519.sign(request.hash(), anchorPrivateKey);
  const body = beginCell().storeBuffer(toBuf(signature), 64).storeSlice(request.beginParse()).endCell();

  const msg = external({ to: address, init: deploy ? init : null, body });
  const boc = beginCell().store(storeMessage(msg)).endCell().toBoc().toString('base64');
  return { boc, address };
}

// ---------- toncenter ----------

const ENDPOINTS = {
  mainnet: 'https://toncenter.com/api/v2',
  testnet: 'https://testnet.toncenter.com/api/v2',
};

export class Toncenter {
  constructor(network = 'mainnet', apiKey = '') {
    this.base = ENDPOINTS[network];
    this.apiKey = apiKey;
  }

  async #call(path, init = {}, attempt = 0) {
    const headers = { 'Content-Type': 'application/json', ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}) };
    const res = await fetch(this.base + path, { ...init, headers });
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      return this.#call(path, init, attempt + 1);
    }
    const json = await res.json().catch(() => null);
    if (!json?.ok) throw new Error(json?.error || `toncenter: HTTP ${res.status}`);
    return json.result;
  }

  async getState(address) {
    const r = await this.#call(`/getAddressInformation?address=${encodeURIComponent(address)}`);
    return { state: r.state, balance: BigInt(r.balance) };
  }

  async getNumber(address, method) {
    const r = await this.#call('/runGetMethod', {
      method: 'POST',
      body: JSON.stringify({ address, method, stack: [] }),
    });
    if (r.exit_code !== 0) throw new Error(`${method}: exit code ${r.exit_code}`);
    return BigInt(r.stack[0][1]);
  }

  async getPublicKeyHex(address) {
    return (await this.getNumber(address, 'get_public_key')).toString(16).padStart(64, '0');
  }

  async sendBoc(boc) {
    return this.#call('/sendBoc', { method: 'POST', body: JSON.stringify({ boc }) });
  }
}

export function formatGram(nano) {
  const s = nano.toString().padStart(10, '0');
  const int = s.slice(0, -9);
  const frac = s.slice(-9).replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

export { Address };
