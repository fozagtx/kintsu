import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { openStore, graphSnapshot } from '../../packages/store/index.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const db = openStore(ROOT);
const PORT = Number(process.env.PORT ?? 4000);
const page = fs.readFileSync(path.join(import.meta.dirname, 'index.html'), 'utf8');

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/api/graph') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify(graphSnapshot(db)));
    }
    if (url.pathname.startsWith('/runs/')) {
      const file = path.join(ROOT, '.kintsu', url.pathname);
      if (file.startsWith(path.join(ROOT, '.kintsu', 'runs')) && fs.existsSync(file)) {
        res.writeHead(200, { 'content-type': file.endsWith('.png') ? 'image/png' : 'image/jpeg' });
        return res.end(fs.readFileSync(file));
      }
    }
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(page);
    }
    res.writeHead(404).end();
  })
  .listen(PORT, () => console.log(`[kintsu] graph on http://localhost:${PORT}`));
