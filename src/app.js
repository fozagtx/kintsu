// Starts the app under test if it is not already up, so a fresh clone works
// with one command. Returns a stop() that only kills what it started.

import { spawn } from 'node:child_process';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function up(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function ensureApp(root, cfg) {
  const health = new URL(cfg.app.readyPath ?? '/', cfg.app.url).href;
  if (await up(health)) return { stop: () => {}, started: false };

  const [cmd, ...args] = cfg.app.serve;
  const port = new URL(cfg.app.url).port;
  const child = spawn(cmd, args, { cwd: root, stdio: 'ignore', env: { ...process.env, PORT: port } });
  const stop = () => {
    if (child.exitCode === null) child.kill();
  };
  for (let i = 0; i < 50; i++) {
    if (child.exitCode !== null) break;
    if (await up(health)) return { stop, started: true };
    await sleep(200);
  }
  stop();
  throw new Error(`App did not come up at ${health} (command: ${cfg.app.serve.join(' ')})`);
}
