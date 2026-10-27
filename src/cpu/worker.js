// Поток режима «процессор»: перебирает случайные фразы и сравнивает адреса с шаблоном.
// PBKDF2 (почти всё время) — на WebAssembly, остальное (SLIP-10, ed25519, адрес) — те же функции, что везде.
import { createSeedHasher } from './pbkdf2-wasm.js';
import {
  NETWORKS,
  addressHash,
  bytesToHex,
  entropyToIndices,
  friendlyAddress,
  indicesToPhraseBytes,
  makeMatcher,
  phraseBytesToSeedSync,
  privateToPublic,
  seedToPrivateKey,
} from '../core/fast.js';

let hasher = null;
let running = false;

/** Самопроверка: WebAssembly должен считать seed так же, как эталонная библиотека. */
function selfTest() {
  for (let i = 0; i < 2; i++) {
    const phrase = indicesToPhraseBytes(entropyToIndices(crypto.getRandomValues(new Uint8Array(16))));
    if (bytesToHex(hasher(phrase)) !== bytesToHex(phraseBytesToSeedSync(phrase))) throw new Error('самопроверка WebAssembly не прошла');
  }
}

async function loop(job) {
  const net = NETWORKS[job.network];
  const match = makeMatcher(job);
  const ent = new Uint8Array(16);
  while (running) {
    let checked = 0;
    let sample = '';
    const t0 = performance.now();
    // порция ~150 мс, потом отчёт и пауза в 0 мс — чтобы успело прийти сообщение «стоп»
    while (performance.now() - t0 < 150) {
      crypto.getRandomValues(ent);
      const idx = entropyToIndices(ent);
      const pub = privateToPublic(seedToPrivateKey(hasher(indicesToPhraseBytes(idx))));
      sample = friendlyAddress(addressHash(pub, net.subwalletId), net.testOnly);
      checked++;
      if (match(sample)) postMessage({ type: 'found', idx, address: sample });
    }
    postMessage({ type: 'progress', checked, sample });
    await new Promise((r) => setTimeout(r, 0));
  }
  postMessage({ type: 'stopped' });
}

onmessage = (e) => {
  const m = e.data;
  if (m.cmd === 'start') {
    try {
      if (!hasher) {
        hasher = createSeedHasher();
        selfTest();
      }
    } catch (err) {
      postMessage({ type: 'error', message: err.message || String(err) });
      return;
    }
    running = true;
    loop(m.job);
  } else if (m.cmd === 'stop') {
    running = false;
  }
};
