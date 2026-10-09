import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// ссылка «Исходный код» на сайте: поле repository в package.json (пусто — кнопка скрыта)
const repoUrl = (pkg.repository?.url || pkg.repository || '').replace(/^git\+/, '').replace(/\.git$/, '');

// Content-Security-Policy только для production-сборки (dev-серверу Vite нужны websocket и eval).
// Fetch/XHR разрешены только к toncenter; это страховка на случай будущей XSS, а не полная защита от утечки.
const CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  'worker-src blob:',
  'connect-src https://toncenter.com https://testnet.toncenter.com',
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const cspPlugin = {
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
};

// Сборка в один index.html: его можно открыть локально или выложить на любой статический хостинг.
export default defineConfig({
  plugins: [viteSingleFile(), cspPlugin],
  server: { port: 5178, host: '127.0.0.1', strictPort: true },
  define: {
    global: 'globalThis',
    __APP_VERSION__: JSON.stringify(pkg.version),
    __REPO_URL__: JSON.stringify(repoUrl),
  },
});
