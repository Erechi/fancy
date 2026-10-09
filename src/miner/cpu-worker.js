// CPU-воркер: тот же конвейер, PBKDF2 — нативный WebCrypto, остальное — noble.
import {
  NETWORKS,
  addressHash,
  entropyToIndices,
  friendlyAddress,
  indicesToPhraseBytes,
  indicesToWords,
  makeMatcher,
  phraseBytesToSeed,
  phraseBytesToSeedSync,
  privateToPublic,
  seedToPrivateKey,
} from '../core/fast.js';

let running = false;

self.onmessage = (e) => {
  if (e.data.cmd === 'start') run(e.data.job);
  else if (e.data.cmd === 'stop') running = false;
};

async function run({ text, type, caseInsensitive, network, native = false }) {
  // native: PBKDF2 через WebCrypto (он один на страницу, поэтому так работает только один воркер)
  const concurrency = native ? 16 : 8;
  running = true;
  const match = makeMatcher(text, type, caseInsensitive);
  const net = NETWORKS[network];
  let pending = 0;
  let last = performance.now();

  const one = async (entropy) => {
    const idx = entropyToIndices(entropy);
    const phrase = indicesToPhraseBytes(idx);
    const seed = native ? await phraseBytesToSeed(phrase) : phraseBytesToSeedSync(phrase);
    const pk = privateToPublic(seedToPrivateKey(seed));
    const address = friendlyAddress(addressHash(pk, net.subwalletId), net.testOnly);
    if (match(address)) self.postMessage({ type: 'found', words: indicesToWords(idx), address });
  };

  while (running) {
    const ent = crypto.getRandomValues(new Uint8Array(16 * concurrency));
    const jobs = [];
    for (let i = 0; i < concurrency; i++) jobs.push(one(ent.subarray(16 * i, 16 * i + 16)));
    await Promise.all(jobs);
    // отдаём управление циклу событий, иначе команда stop не дойдёт
    await new Promise((r) => setTimeout(r, 0));
    pending += concurrency;
    const now = performance.now();
    if (now - last > 400) {
      self.postMessage({ type: 'progress', checked: pending });
      pending = 0;
      last = now;
    }
  }
  if (pending) self.postMessage({ type: 'progress', checked: pending });
  self.postMessage({ type: 'stopped' });
}
