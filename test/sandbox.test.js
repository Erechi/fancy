// Полный сценарий на эмуляторе с НАСТОЯЩИМ байткодом WalletTg из config[-123] (test/config-123.json):
// пополнение → деплой + смена ключа одним external → старый ключ больше не работает, новый — работает.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Blockchain } from '@ton/sandbox';
import { Cell, Dictionary, beginCell, external, internal, storeMessage, storeMessageRelaxed, toNano } from '@ton/core';
import { ed25519 } from '@noble/curves/ed25519.js';
import { generateMnemonic } from '@scure/bip39';
import { WORDLIST, NETWORKS, bytesToHex, wordsToWallet } from '../src/core/fast.js';
import { buildDeployAndRotate, buildStateInit } from '../src/core/wallet.js';

const walletTgCode = Cell.fromBase64(JSON.parse(readFileSync(new URL('./config-123.json', import.meta.url))).result.config.bytes);

const bc = await Blockchain.create();
const cfg = Dictionary.loadDirect(Dictionary.Keys.Int(32), Dictionary.Values.Cell(), bc.config);
cfg.set(-123, walletTgCode);
bc.setConfig(beginCell().storeDictDirect(cfg).endCell());

const anchor = await wordsToWallet(generateMnemonic(WORDLIST, 128).split(' '));
const signing = await wordsToWallet(generateMnemonic(WORDLIST, 128).split(' '));
const { boc, address } = buildDeployAndRotate({
  anchorPrivateKey: anchor.privateKey,
  anchorPublicKey: anchor.publicKey,
  newPrivateKey: signing.privateKey,
  newPublicKey: signing.publicKey,
  network: 'mainnet',
  seqno: 0,
  deploy: true,
  validUntil: Math.floor(Date.now() / 1000) + 180,
});
assert.equal(address.toString({ bounceable: false, urlSafe: true }), anchor.address);

const treasury = await bc.treasury('payer');
await treasury.send({ to: address, value: toNano('0.05'), bounce: false });
const before = await bc.getContract(address);
assert.equal(before.accountState?.type, 'uninit');

const r = await bc.sendMessage(Cell.fromBase64(boc));
const tx = r.transactions[0];
assert.equal(tx.description.type, 'generic');
assert.equal(tx.description.computePhase.type, 'vm');
assert.equal(tx.description.computePhase.exitCode, 0, 'деплой + смена ключа: exit code');

const getKey = async () => bytesToHex(Buffer.from((await bc.runGetMethod(address, 'get_public_key')).stackReader.readBigNumber().toString(16).padStart(64, '0'), 'hex'));
assert.equal(await getKey(), bytesToHex(signing.publicKey), 'ключ в контракте = ключ 24 слов');
const seqno = (await bc.runGetMethod(address, 'seqno')).stackReader.readNumber();
assert.equal(seqno, 1);

// перевод, подписанный ключом из 13–24 слов, проходит; anchor-ключом — нет
function sendOne(privateKey, seq) {
  const out = internal({ to: treasury.address, value: toNano('0.01'), bounce: false });
  const request = beginCell()
    .storeUint(0x63896e75, 32)
    .storeUint(NETWORKS.mainnet.subwalletId, 32)
    .storeUint(Math.floor(Date.now() / 1000) + 180, 32)
    .storeUint(seq, 32)
    .storeUint(3, 8) // PAY_FEES_SEPARATELY | IGNORE_ERRORS
    .storeRef(beginCell().store(storeMessageRelaxed(out)).endCell())
    .endCell();
  const sig = ed25519.sign(request.hash(), privateKey);
  const body = beginCell().storeBuffer(Buffer.from(sig)).storeSlice(request.beginParse()).endCell();
  return bc.sendMessage(beginCell().store(storeMessage(external({ to: address, body }))).endCell());
}

await assert.rejects(sendOne(anchor.privateKey, 1), 'anchor-ключ больше не подписывает');
const ok = await sendOne(signing.privateKey, 1);
assert.equal(ok.transactions[0].description.computePhase.exitCode, 0);
assert.equal(ok.transactions[0].outMessagesCount >= 1, true);

// повторная отправка той же смены ключа не проходит (seqno уже другой)
await assert.rejects(bc.sendMessage(Cell.fromBase64(boc)));

assert.ok(buildStateInit(anchor.publicKey).code.hash().equals(Cell.fromBoc(Buffer.from('b5ee9c7241010101001a000030ff00209821d7498308b9f240df8085f833d0ed1e20ed53d969427e39', 'hex'))[0].hash()));
console.log('OK: эмулятор с живым WalletTg — деплой, смена ключа, перевод новым ключом, отказ старому');
