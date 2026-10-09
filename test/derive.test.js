// Сверка быстрого пути (src/core/fast.js) с независимыми эталонными библиотеками:
// @scure/bip39 (seed), micro-key-producer (SLIP-10), @ton/core (stateInit и адрес).
import assert from 'node:assert/strict';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { HDKey } from 'micro-key-producer/slip10.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { Cell, beginCell, contractAddress } from '@ton/core';
import {
  TRAMPOLINE_BOC_HEX,
  TRAMPOLINE_CODE_HASH,
  NETWORKS,
  WORDLIST,
  entropyToIndices,
  indicesToWords,
  wordsToWallet,
  makeMatcher,
  bytesToHex,
  indicesToPhraseBytes,
  phraseBytesToSeed,
  phraseBytesToSeedSync,
} from '../src/core/fast.js';
import { buildDeployAndRotate, buildStateInit } from '../src/core/wallet.js';

const code = Cell.fromBoc(Buffer.from(TRAMPOLINE_BOC_HEX, 'hex'))[0];
assert.equal(code.hash().toString('hex'), bytesToHex(TRAMPOLINE_CODE_HASH), 'хеш трамплина');

function reference(words, network) {
  const seed = mnemonicToSeedSync(words.join(' '));
  const hd = HDKey.fromMasterSeed(seed).derive("m/44'/607'/0'");
  const pub = ed25519.getPublicKey(hd.privateKey);
  const data = beginCell()
    .storeUint(0, 8)
    .storeUint(0, 32)
    .storeUint(NETWORKS[network].subwalletId, 32)
    .storeBuffer(Buffer.from(pub), 32)
    .endCell();
  const addr = contractAddress(0, { code, data });
  return {
    priv: bytesToHex(hd.privateKey),
    pub: bytesToHex(pub),
    address: addr.toString({ bounceable: false, urlSafe: true, testOnly: NETWORKS[network].testOnly }),
  };
}

// 1) энтропия → слова совпадает с BIP39 (включая чек-сумму)
for (let n = 0; n < 200; n++) {
  const entropy = crypto.getRandomValues(new Uint8Array(16));
  const words = indicesToWords(entropyToIndices(entropy));
  assert.ok(validateMnemonic(words.join(' '), WORDLIST), 'чек-сумма BIP39');
}

// 2) полный путь до адреса — и для mainnet, и для testnet
for (let n = 0; n < 30; n++) {
  const words = generateMnemonic(WORDLIST, 128).split(' ');
  for (const network of ['mainnet', 'testnet']) {
    const ref = reference(words, network);
    const got = await wordsToWallet(words, network);
    assert.equal(bytesToHex(got.privateKey), ref.priv, 'приватный ключ');
    assert.equal(bytesToHex(got.publicKey), ref.pub, 'публичный ключ');
    assert.equal(got.address, ref.address, 'адрес');
  }
}

// 2b) JS-вариант PBKDF2 совпадает с WebCrypto
for (let n = 0; n < 5; n++) {
  const ph = indicesToPhraseBytes(entropyToIndices(crypto.getRandomValues(new Uint8Array(16))));
  assert.equal(bytesToHex(phraseBytesToSeedSync(ph)), bytesToHex(await phraseBytesToSeed(ph)));
}

// 3) матчер
assert.ok(makeMatcher('Split', 'suffix', true)('UQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxSPLIT'));
assert.ok(!makeMatcher('Split', 'suffix', false)('UQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxSPLIT'));
assert.ok(makeMatcher('Dog', 'prefix', false)('UQDogxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'));

// 4) сообщение деплоя + смены ключа: структура и подписи
{
  const anchor = generateMnemonic(WORDLIST, 128).split(' ');
  const signing = generateMnemonic(WORDLIST, 128).split(' ');
  const a = await wordsToWallet(anchor);
  const s = await wordsToWallet(signing);
  const { boc, address } = buildDeployAndRotate({
    anchorPrivateKey: a.privateKey,
    anchorPublicKey: a.publicKey,
    newPrivateKey: s.privateKey,
    newPublicKey: s.publicKey,
    network: 'mainnet',
    seqno: 0,
    validUntil: 2_000_000_000,
  });
  assert.equal(address.toString({ bounceable: false, urlSafe: true }), a.address);
  const init = buildStateInit(a.publicKey, 'mainnet');
  assert.equal(contractAddress(0, init).toString({ bounceable: false }), a.address);

  const ext = Cell.fromBoc(Buffer.from(boc, 'base64'))[0].beginParse();
  // ext_in_msg_info$10 src:addr_none dest:MsgAddressInt import_fee:Grams
  assert.equal(ext.loadUint(2), 2);
  ext.loadAddressAny();
  const dest = ext.loadAddress();
  assert.ok(dest.equals(address));
  ext.loadCoins();
  assert.equal(ext.loadBit(), true, 'есть stateInit');
  const initInRef = ext.loadBit();
  const initCell = initInRef ? ext.loadRef() : null;
  assert.ok(initCell);
  const bodyInRef = ext.loadBit();
  const body = bodyInRef ? ext.loadRef().beginParse() : ext;
  const signature = body.loadBuffer(64);
  const requestCell = body.asCell();
  assert.ok(ed25519.verify(signature, requestCell.hash(), a.publicKey), 'подпись anchor-ключом');
  const req = requestCell.beginParse();
  assert.equal(req.loadUint(32), 0xfbba99c8, 'опкод ChangePublicKeyRequestE');
  assert.equal(req.loadUint(32), NETWORKS.mainnet.subwalletId);
  assert.equal(req.loadUint(32), 2_000_000_000);
  assert.equal(req.loadUint(32), 0, 'seqno');
  assert.equal(req.loadBuffer(32).toString('hex'), bytesToHex(s.publicKey));
  const rotSig = req.loadRef().beginParse().loadBuffer(64);
  const proof = beginCell()
    .storeUint(BigInt('0x4B45595F524F544154494F4E'), 96)
    .storeInt(0, 8)
    .storeBuffer(address.hash, 32)
    .endCell();
  assert.ok(ed25519.verify(rotSig, proof.hash(), s.publicKey), 'доказательство новым ключом');
  const encOld = req.loadRef().beginParse();
  assert.equal(encOld.remainingBits, 256);
  assert.equal(req.remainingBits, 0);
  assert.equal(req.remainingRefs, 0);
}

console.log('OK: деривация, адреса, матчер и сообщение смены ключа совпадают с эталоном');
