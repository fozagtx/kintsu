import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAccount, ValidationError } from './src/signup.js';
import { createStore } from './src/store.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, 'public');
const port = Number(process.env.PORT || 4310);
const store = createStore();

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });

  if (req.method === 'POST' && url.pathname === '/api/signup') {
    try {
      const account = createAccount(await readJson(req), store);
      return send(res, 201, { account });
    } catch (err) {
      if (err instanceof ValidationError) return send(res, 400, { error: err.message });
      if (err instanceof SyntaxError) return send(res, 400, { error: 'Invalid JSON' });
      console.error(err);
      return send(res, 500, { error: 'Something went wrong' });
    }
  }

  if (req.method === 'GET') {
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = path.join(publicDir, rel);
    if (file.startsWith(publicDir + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      return send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] ?? 'application/octet-stream');
    }
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(port, () => console.log(`demo app on http://localhost:${port}`));
