// Режим «процессор»: пул воркеров с тем же интерфейсом, что у GpuMiner (run / stop / power).
// Нагрузка — это доля потоков процессора: на 50 % половина ядер свободна, и компьютер не тормозит.
import CpuWorker from './worker.js?worker&inline';
import { indicesToWords } from '../core/fast.js';

/** Сколько потоков есть у процессора (браузер сообщает логические ядра). */
export const cpuThreads = () => Math.max(1, navigator.hardwareConcurrency || 4);

export class CpuMiner {
  static available() {
    return typeof WebAssembly === 'object' && typeof Worker === 'function';
  }

  constructor() {
    this.power = 1;
    this.running = false;
    this.workers = [];
  }

  /** Потоков при текущей нагрузке; один поток браузеру оставляем, если их больше двух. */
  #wanted() {
    const total = cpuThreads();
    const usable = total > 2 ? total - 1 : total;
    return Math.max(1, Math.round(usable * Math.min(1, Math.max(0.1, this.power ?? 1))));
  }

  /** Поиск до stop(). onProgress(checked, rate, sampleAddress), onFound({ words, address }) — как у GpuMiner. */
  run(job, onProgress, onFound) {
    this.running = true;
    let checked = 0;
    let sample = '';
    let error = null;
    // скорость — по окну последних ~2 с
    const hist = [];
    const tick = setInterval(() => {
      const now = performance.now();
      hist.push([now, checked]);
      while (hist.length > 1 && now - hist[0][0] > 2000) hist.shift();
      const [t0, c0] = hist[0];
      const rate = now > t0 ? ((checked - c0) / (now - t0)) * 1000 : 0;
      onProgress(checked, rate, sample);
      // нагрузку меняют на ходу — добавляем или останавливаем потоки
      if (this.running) this.#balance(start);
    }, 250);

    const done = new Promise((r) => (this.finish = r));
    const start = () => {
      const w = new CpuWorker();
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'progress') {
          checked += m.checked;
          sample = m.sample;
        } else if (m.type === 'found') {
          onFound({ words: indicesToWords(m.idx), address: m.address });
        } else if (m.type === 'error') {
          error = new Error(m.message);
          this.stop();
        } else if (m.type === 'stopped') {
          w.terminate();
          this.workers = this.workers.filter((x) => x !== w);
          if (!this.running && !this.workers.length) this.finish();
        }
      };
      w.onerror = (e) => {
        error = new Error(e.message || 'Ошибка потока процессора');
        this.stop();
      };
      w.postMessage({ cmd: 'start', job });
      this.workers.push(w);
    };
    this.#balance(start);
    return done.then(() => {
      clearInterval(tick);
      if (error) throw error;
    });
  }

  #balance(start) {
    const want = this.#wanted();
    const active = this.workers.filter((w) => !w.stopping);
    for (let i = active.length; i < want; i++) start();
    for (const w of active.slice(want)) {
      w.stopping = true;
      w.postMessage({ cmd: 'stop' });
    }
  }

  stop() {
    this.running = false;
    for (const w of this.workers) {
      w.stopping = true;
      w.postMessage({ cmd: 'stop' });
    }
    // воркер, упавший до старта цикла, не ответит «stopped» — добиваем через полторы секунды
    setTimeout(() => {
      if (this.running || !this.workers.length) return;
      for (const w of this.workers) w.terminate();
      this.workers = [];
      this.finish?.();
    }, 1500);
  }
}
