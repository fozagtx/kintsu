// End-to-end loop in a throwaway clone, with test/fixtures/fake-kane.js
// standing in for kane-cli. Covers: red blocks the stop, green locks a check
// and commits it, the proof holds, and the same bug comes back blocked at the
// check with Kane never invoked.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fakeKane = path.join(repo, 'test', 'fixtures', 'fake-kane.js');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-e2e-'));
  for (const entry of ['bin', 'src', 'demo-app', 'eslint.config.js', 'package.json', '.gitignore', '.ratchet/config.json', '.testmuai/context.md']) {
    fs.cpSync(path.join(repo, entry), path.join(dir, entry), { recursive: true });
  }
  fs.symlinkSync(path.join(repo, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  const cfgFile = path.join(dir, '.ratchet', 'config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  cfg.app.url = `http://localhost:${4400 + Math.floor(Math.random() * 500)}`;
  fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
  const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  g('init', '-q', '-b', 'main');
  g('config', 'user.email', 'test@ratchet.test');
  g('config', 'user.name', 'ratchet-test');
  g('add', '-A');
  g('commit', '-qm', 'base');
  const log = `${dir}.kane-calls`;
  const env = { ...process.env, RATCHET_KANE_BIN: fakeKane, RATCHET_FAKE_KANE_LOG: log, CLAUDE_PROJECT_DIR: '' };
  const ratchet = (args, session = 's1') =>
    spawnSync(process.execPath, [path.join(dir, 'bin', 'ratchet.js'), ...args], {
      cwd: dir,
      env,
      encoding: 'utf8',
      input: JSON.stringify({ session_id: session, hook_event_name: 'Stop' }),
    });
  const kaneCalls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).length : 0);
  return { dir, g, ratchet, kaneCalls };
}

test('full ratchet loop: red, fix, lock, prove, re-block for free', { timeout: 120_000 }, () => {
  const { dir, g, ratchet, kaneCalls } = setup();

  // Step 1: author both flows on the clean app.
  for (const flow of ['signup', 'signup-terms']) {
    const r = ratchet(['author', flow]);
    assert.equal(r.status, 0, r.stderr);
  }
  g('add', '-A');
  g('commit', '-qm', 'flows');

  // Clean app, nothing changed: no Kane run.
  let calls = kaneCalls();
  let r = ratchet(['verify', '--hook']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(kaneCalls(), calls);

  // Step 2+3: plant the dropped-field bug. Kane red, stop blocked.
  g('apply', 'demo-app/bugs/dropped-field.patch');
  r = ratchet(['verify', '--hook']);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /Kane replay FAILED for flow "signup"/);
  assert.match(r.stderr, /run_end: \{/);
  assert.match(r.stderr, /evidence: \.testmuai\/evidence\/.+\.evidence/);
  assert.match(r.stderr, /cycle 1\/3/);

  // Step 4: agent fixes the code. Kane green. Step 5+6: check locked, proved, committed.
  g('apply', '-R', 'demo-app/bugs/dropped-field.patch');
  r = ratchet(['verify', '--hook']);
  assert.equal(r.status, 0, r.stderr);
  const msg = JSON.parse(r.stdout).systemMessage;
  assert.match(msg, /locked .* as a unit-test check/);
  assert.match(msg, /blocked at check, 0 credits, no browser/);

  const receipts = fs.readdirSync(path.join(dir, '.ratchet')).filter((f) => f.startsWith('bug-') && f.endsWith('.json'));
  assert.equal(receipts.length, 1);
  const receipt = JSON.parse(fs.readFileSync(path.join(dir, '.ratchet', receipts[0]), 'utf8'));
  assert.equal(receipt.check.type, 'unit-test');
  assert.equal(receipt.proof.proved, true);
  assert.equal(receipt.proof.control.passed, true);
  assert.equal(receipt.proof.replay.blocked, true);
  assert.ok(fs.existsSync(path.join(dir, receipt.check.path)));
  assert.ok(fs.existsSync(path.join(dir, receipt.evidence)));
  assert.match(fs.readFileSync(path.join(dir, receipt.badDiff), 'utf8'), /payload\.planId/);
  const commit = g('log', '-1', '--format=%B');
  assert.match(commit, /^ratchet: lock unit-test check/);
  assert.match(commit, /Evidence: \.ratchet\/evidence\//);
  assert.equal(g('status', '--porcelain', '--', '.ratchet', 'tests'), '');

  // Acceptance: reintroducing the bug fails at the check, no browser, no credits.
  g('apply', 'demo-app/bugs/dropped-field.patch');
  calls = kaneCalls();
  r = ratchet(['verify', '--hook']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Blocked at check: tests\/ratchet\/bug-.*\.test\.js/);
  assert.match(r.stderr, /0 credits, no browser, Kane not run/);
  assert.equal(kaneCalls(), calls, 'Kane must not run when a locked check already blocks');
  g('apply', '-R', 'demo-app/bugs/dropped-field.patch');

  // Step 7: second bug class, the fake-disabled button -> ESLint rule.
  g('apply', 'demo-app/bugs/fake-disabled.patch');
  r = ratchet(['verify', '--hook'], 's2');
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /FAILED for flow "signup-terms"/);
  g('apply', '-R', 'demo-app/bugs/fake-disabled.patch');
  r = ratchet(['verify', '--hook'], 's2');
  assert.equal(r.status, 0, r.stderr);
  assert.match(JSON.parse(r.stdout).systemMessage, /as a eslint check: eslint\.config\.js/);
  assert.match(fs.readFileSync(path.join(dir, 'eslint.config.js'), 'utf8'), /classList/);

  g('apply', 'demo-app/bugs/fake-disabled.patch');
  calls = kaneCalls();
  r = ratchet(['verify', '--hook'], 's2');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Blocked at check: eslint\.config\.js/);
  assert.equal(kaneCalls(), calls);
  g('apply', '-R', 'demo-app/bugs/fake-disabled.patch');

  // Proof replays from the committed receipts on demand.
  r = ratchet(['prove']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal((r.stdout.match(/blocked at check, 0 credits, no browser/g) ?? []).length, 2);

  // Locked checks only tighten: deleting one blocks the stop.
  fs.rmSync(path.join(dir, receipt.check.path));
  r = ratchet(['verify', '--hook'], 's3');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /was deleted/);
  g('checkout', '--', receipt.check.path);

  // Weakening the saved flow blocks the stop.
  fs.appendFileSync(path.join(dir, '.testmuai/tests/signup_test.md'), '\n## Skip the plan check\n');
  r = ratchet(['verify', '--hook'], 's4');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /saved test .*signup_test\.md was edited/);
  g('checkout', '--', '.testmuai/tests/signup_test.md');

  // Loop guard: the third red cycle lets the agent stop and escalates to the human.
  g('apply', 'demo-app/bugs/dropped-field.patch');
  assert.equal(ratchet(['verify', '--hook'], 's5').status, 2);
  assert.equal(ratchet(['verify', '--hook'], 's5').status, 2);
  r = ratchet(['verify', '--hook'], 's5');
  assert.equal(r.status, 0);
  assert.match(JSON.parse(r.stdout).systemMessage, /3 red verify cycles in a row.*handing this to you/s);

  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(`${dir}.kane-calls`, { force: true });
});

test('Kane infrastructure failure never blocks the stop', { timeout: 60_000 }, () => {
  const { dir, g, ratchet } = setup();
  assert.equal(ratchet(['author', 'signup']).status, 0);
  g('add', '-A');
  g('commit', '-qm', 'flow');
  g('apply', 'demo-app/bugs/dropped-field.patch');
  const r = spawnSync(process.execPath, [path.join(dir, 'bin', 'ratchet.js'), 'verify', '--hook'], {
    cwd: dir,
    env: { ...process.env, RATCHET_KANE_BIN: '/nonexistent/kane-cli', CLAUDE_PROJECT_DIR: '' },
    encoding: 'utf8',
    input: '{}',
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(JSON.parse(r.stdout).systemMessage, /could not give a verdict, not blocking/);
  fs.rmSync(dir, { recursive: true, force: true });
});
