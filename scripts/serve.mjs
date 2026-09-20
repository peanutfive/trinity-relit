// 零依赖静态服务器，用于本地开发与预览 dist 等价物（prototype/）。
// 用法: node scripts/serve.mjs [--port 8080] [--root prototype]

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const port = Number(option('port', 8080));
const host = option('host', '127.0.0.1');
const root = resolve(process.cwd(), option('root', 'prototype'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(body);
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  // 解析后必须仍在 root 内，挡掉 ../ 穿越
  const requested = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let filepath = join(root, requested);
  if (filepath !== root && !filepath.startsWith(root + sep)) return send(response, 403, '403');

  try {
    let info = await stat(filepath);
    if (info.isDirectory()) {
      filepath = join(filepath, 'index.html');
      info = await stat(filepath);
    }
    response.writeHead(200, {
      'content-type': TYPES[extname(filepath)] ?? 'application/octet-stream',
      'content-length': info.size,
      'cache-control': 'no-cache',
    });
    createReadStream(filepath).pipe(response);
  } catch {
    send(response, 404, '404');
  }
}).listen(port, host, () => {
  console.log(`Trinity Relit  →  http://${host}:${port}/`);
});
