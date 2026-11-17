// Runs locked checks. These are deterministic and free: no browser, no credits.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha256 } from './store.js';
import { readEslintRules, hasTag } from './write-check.js';

const tail = (s, n = 2500) => (s.length > n ? '…' + s.slice(-n) : s).trim();

// A parent `node --test` leaks NODE_TEST_CONTEXT, which makes a nested
// `node --test` report to the parent instead of exiting with its own verdict.
const cleanEnv = () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
};

export function runCheck(dir, check, cfg) {
  if (check.type === 'unit-test') {
    const r = spawnSync(process.execPath, ['--test', check.path], { cwd: dir, encoding: 'utf8', env: cleanEnv() });
    return { ran: true, passed: r.status === 0, output: tail(`${r.stdout}\n${r.stderr}`) };
  }
  if (check.type === 'eslint') {
    const bin = path.join(dir, 'node_modules', '.bin', 'eslint');
    if (!fs.existsSync(bin)) return { ran: false, passed: false, output: 'eslint is not installed. Run npm install.' };
    const r = spawnSync(bin, ['--no-warn-ignored', ...(cfg.lint?.files ?? ['.'])], { cwd: dir, encoding: 'utf8' });
    return { ran: true, passed: r.status === 0, output: tail(`${r.stdout}\n${r.stderr}`) };
  }
  // Smoke promotions are browser replays; they run under `ratchet smoke`, not here.
  return { ran: false, passed: true, skipped: true, output: 'smoke check runs as a Kane replay (ratchet smoke)' };
}

// Locked checks only tighten. A missing or edited check blocks the stop.
export function integrityProblems(root, receipts) {
  const problems = [];
  let eslintText = null;
  for (const r of receipts) {
    const c = r.check;
    const file = path.join(root, c.path);
    if (!fs.existsSync(file)) {
      problems.push(`${c.path} (${r.id}) was deleted`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    if (c.type === 'unit-test' && c.sha256 && sha256(text) !== c.sha256) problems.push(`${c.path} (${r.id}) was edited`);
    if (c.type === 'eslint') {
      eslintText ??= readEslintRules(text);
      if (!eslintText?.rules.some((x) => x.selector === c.selector)) problems.push(`eslint rule for ${r.id} was removed from eslint.config.js`);
    }
    if (c.type === 'smoke' && !hasTag(text, 'smoke')) problems.push(`${c.path} (${r.id}) lost its smoke tag`);
  }
  return problems;
}

export function runLockedChecks(root, receipts, cfg) {
  const failures = [];
  let eslintDone = false;
  for (const r of receipts) {
    if (r.check.type === 'eslint') {
      if (eslintDone) continue;
      eslintDone = true;
    }
    const res = runCheck(root, r.check, cfg);
    if (!res.skipped && !res.passed) failures.push({ id: r.id, check: r.check, output: res.output, ran: res.ran });
  }
  return failures;
}
