// Spawns kane-cli in agent mode, parses its NDJSON stream, returns a verdict.
//
// Kane exit codes: 0 passed, 1 failed, 2 did not start (no credits used),
// 3 timeout or cancelled. Anything else (including a missing binary) is
// treated like 2: an infrastructure problem, never a product verdict.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { rel } from './store.js';

const VERDICTS = { 0: 'pass', 1: 'fail', 2: 'not-started', 3: 'timeout' };

export const kaneBin = () => process.env.RATCHET_KANE_BIN || 'kane-cli';

// Replays always run with healing off, so a re-authored step can never turn a
// real failure into a pass.
export function replayArgs(flow, cfg) {
  return [
    'testmd', 'run', flow.test,
    '--agent', '--headless',
    '--url', cfg.app.url,
    '--timeout', String(cfg.kaneTimeout),
    '--no-adaptive-heal',
  ];
}

export function authorArgs(flow, cfg) {
  return [
    'run', flow.objective,
    '--agent', '--headless',
    '--name', flow.name,
    '--url', cfg.app.url,
    '--timeout', String(cfg.kaneTimeout),
  ];
}

export function smokeArgs() {
  return ['testrun', 'run', '--tags', 'smoke', '--no-adaptive-heal', '--agent'];
}

export function runKane(root, args, { onEvent } = {}) {
  const started = Date.now();
  return new Promise((resolve) => {
    // stdin is closed (the `< /dev/null` rule) so Kane never waits on a prompt.
    const child = spawn(kaneBin(), args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    const events = [];
    let buf = '';
    let stderr = '';

    const take = (line) => {
      line = line.trim();
      if (!line.startsWith('{')) return;
      try {
        const ev = JSON.parse(line);
        events.push(ev);
        onEvent?.(ev);
      } catch {
        // Non-JSON noise on stdout is ignored; run_end is what matters.
      }
    };

    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        take(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    });
    child.stderr.on('data', (d) => {
      stderr = (stderr + d).slice(-4000);
    });

    let settled = false;
    const finish = (code, spawnError) => {
      if (settled) return;
      settled = true;
      if (buf) take(buf);
      resolve(summarize(root, { code, events, stderr, spawnError, started, args }));
    };
    child.on('error', (err) => finish(127, err));
    child.on('close', (code) => finish(code ?? 3));
  });
}

function summarize(root, { code, events, stderr, spawnError, started, args }) {
  const runEnd = events.findLast((e) => e.type === 'run_end') ?? null;
  const verdict = VERDICTS[code] ?? 'not-started';
  const remarks = collect(events, (k, v) => /remark/i.test(k) && typeof v === 'string' && v.trim());
  return {
    code,
    verdict,
    args,
    runEnd,
    reason:
      runEnd?.reason ??
      runEnd?.summary ??
      (spawnError ? `could not start ${kaneBin()}: ${spawnError.message}` : stderr.trim().split('\n').pop() || null),
    summary: runEnd?.summary ?? null,
    finalState: runEnd?.final_state ?? null,
    testUrl: runEnd?.test_url ?? null,
    credits: runEnd?.credits_consumed ?? null,
    remark: remarks.at(-1) ?? null,
    evidence: findEvidence(root, events, started),
    stderrTail: stderr.trim().slice(-1500),
    ms: Date.now() - started,
  };
}

function collect(value, match, out = [], key = '') {
  if (Array.isArray(value)) value.forEach((v) => collect(v, match, out, key));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) collect(v, match, out, k);
  else if (match(key, value)) out.push(value);
  return out;
}

// Prefer a path Kane printed; otherwise the newest pack sealed during this run.
function findEvidence(root, events, started) {
  const printed = collect(events, (_k, v) => typeof v === 'string' && /\.evidence\/?$/.test(v)).at(-1);
  if (printed) {
    // Kane often seals packs under ~/.testmuai, outside the repo: keep those absolute.
    const abs = path.resolve(root, printed.replace(/\/$/, ''));
    return abs.startsWith(root + path.sep) ? rel(root, abs) : abs;
  }

  const dir = path.join(root, '.testmuai', 'evidence');
  if (!fs.existsSync(dir)) return null;
  let best = null;
  const walk = (d, depth) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.name.endsWith('.evidence')) {
        const m = fs.statSync(p).mtimeMs;
        if (m >= started - 1000 && (!best || m > best.m)) best = { p, m };
      } else if (entry.isDirectory() && depth < 3) walk(p, depth + 1);
    }
  };
  walk(dir, 0);
  return best ? rel(root, best.p) : null;
}
