// Пул CPU-воркеров. Запасной вариант, если WebGPU недоступен, или в помощь видеокарте.
import Worker from './cpu-worker.js?worker&inline';

export class CpuMiner {
  constructor(threads = Math.max(1, (navigator.hardwareConcurrency || 4) - 1)) {
    this.threads = threads;
    this.workers = [];
  }

  run(job, onProgress, onFound) {
    this.stop();
    let checked = 0;
    let windowStart = performance.now();
    let windowCount = 0;
    let rate = 0;
    return new Promise((resolve) => {
      let alive = this.threads;
      for (let i = 0; i < this.threads; i++) {
        const w = new Worker();
        w.onmessage = (e) => {
          const m = e.data;
          if (m.type === 'progress') {
            checked += m.checked;
            windowCount += m.checked;
            const now = performance.now();
            if (now - windowStart > 1000) {
              rate = (windowCount / (now - windowStart)) * 1000;
              windowStart = now;
              windowCount = 0;
            }
            onProgress(checked, rate);
          } else if (m.type === 'found') {
            onFound({ words: m.words, address: m.address });
          } else if (m.type === 'stopped') {
            w.terminate();
            if (--alive === 0) resolve();
          }
        };
        w.postMessage({ cmd: 'start', job: { ...job, native: i === 0 } });
        this.workers.push(w);
      }
    });
  }

  stop() {
    for (const w of this.workers) w.postMessage({ cmd: 'stop' });
    this.workers = [];
  }
}
