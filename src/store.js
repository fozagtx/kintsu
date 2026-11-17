// Everything Ratchet keeps lives under .ratchet/.
//   config.json          flows, app, handlers, lint targets (human-owned)
//   flows.lock.json      hash of each flow's objective + saved test body
//   <bug-id>.json        the receipt for one locked bug
//   diffs/<bug-id>.*     the diff that introduced the bug, and the fix
//   evidence/<bug-id>.*  the Kane evidence pack for the failing run
//   state/               per-machine loop state, gitignored

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RESERVED = new Set(['config.json', 'flows.lock.json']);

export function paths(root) {
  const dir = path.join(root, '.ratchet');
  return {
    dir,
    config: path.join(dir, 'config.json'),
    flowsLock: path.join(dir, 'flows.lock.json'),
    state: path.join(dir, 'state'),
    pending: path.join(dir, 'state', 'pending.json'),
    runs: path.join(dir, 'state', 'runs.ndjson'),
    session: (id) => path.join(dir, 'state', `session-${String(id).replace(/[^\w-]/g, '_')}.json`),
    receipt: (id) => path.join(dir, `${id}.json`),
    badDiff: (id) => path.join(dir, 'diffs', `${id}.bad.diff`),
    fixDiff: (id) => path.join(dir, 'diffs', `${id}.fix.diff`),
    evidence: (id, ext = '.evidence') => path.join(dir, 'evidence', `${id}${ext}`),
  };
}

export function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw err;
  }
}

export function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

export function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

export function appendRun(root, entry) {
  const file = paths(root).runs;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
}

export function loadConfig(root) {
  const file = paths(root).config;
  if (!fs.existsSync(file)) throw new Error(`No ${path.relative(root, file)}. Ratchet needs a config to know which flows to run.`);
  const cfg = readJSON(file);
  for (const flow of cfg.flows ?? []) {
    if (!/^[A-Za-z0-9_-]+$/.test(flow.name)) throw new Error(`Flow name "${flow.name}" must match [A-Za-z0-9_-]+ (Kane --name rule)`);
    flow.test ??= `.testmuai/tests/${flow.name}_test.md`;
    flow.paths ??= ['.'];
  }
  cfg.maxCycles ??= 3;
  cfg.kaneTimeout ??= 300;
  return cfg;
}

export function listReceipts(root) {
  const dir = paths(root).dir;
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !RESERVED.has(f))
    .map((f) => readJSON(path.join(dir, f)))
    .filter((r) => r && r.id && r.check)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function newBugId(flowName, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  return `bug-${stamp}-${flowName}`;
}

export function rel(root, file) {
  return path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
}
