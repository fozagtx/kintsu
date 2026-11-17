// `ratchet verify`: what the Stop hook runs.
//
// Order matters:
//   1. Locked checks must be intact and green. These are free and run first,
//      so a bug Ratchet already knows is blocked with 0 credits and no browser.
//   2. Saved flows must be the ones that were locked (no weakening).
//   3. Kane replays the flows touched since the last green run, healing off.
//   4. Red  -> record a pending bug, block the stop (exit 2), max N cycles.
//      Green -> lock every pending bug for those flows.
//      Kane exit 2/3 -> report and let the agent stop. Never block on infra.

import fs from 'node:fs';
import path from 'node:path';
import { paths, readJSON, writeJSON, listReceipts, appendRun, newBugId, sha256 } from './store.js';
import { snapshotTree, headTree, changedFiles } from './git.js';
import { integrityProblems, runLockedChecks } from './checks.js';
import { runKane, replayArgs } from './run-kane.js';
import { ensureApp } from './app.js';
import { lockBug } from './lock.js';
import { testBody } from './write-check.js';

export function flowFingerprint(root, flow) {
  const md = fs.readFileSync(path.join(root, flow.test), 'utf8');
  const mode = /^mode:\s*(.+)$/m.exec(/^---\n([\s\S]*?)\n---/.exec(md)?.[1] ?? '')?.[1]?.trim() ?? null;
  return { objective: sha256(flow.objective), test: sha256(testBody(md)), mode };
}

function flowsTampered(root, cfg) {
  const p = paths(root);
  const lock = readJSON(p.flowsLock, {});
  const problems = [];
  let changed = false;
  for (const flow of cfg.flows) {
    if (!fs.existsSync(path.join(root, flow.test))) continue;
    const now = flowFingerprint(root, flow);
    const was = lock[flow.name];
    if (!was) {
      lock[flow.name] = now; // first sighting: trust it, lock it
      changed = true;
      continue;
    }
    if (was.objective !== now.objective) problems.push(`objective for flow "${flow.name}" in .ratchet/config.json was changed`);
    if (was.test !== now.test) problems.push(`saved test ${flow.test} was edited`);
    if (was.mode !== now.mode) problems.push(`mode in ${flow.test} was changed from ${was.mode} to ${now.mode}`);
  }
  if (changed) writeJSON(p.flowsLock, lock);
  return problems;
}

const under = (file, dirs) => dirs.some((d) => d === '.' || file === d || file.startsWith(d.replace(/\/?$/, '/')));

export async function verify(root, cfg, { sessionId = 'cli', log = () => {} } = {}) {
  const p = paths(root);
  const sessionFile = p.session(sessionId);
  const session = readJSON(sessionFile, { cycles: 0 });
  const pending = readJSON(p.pending, {});
  const receipts = listReceipts(root);

  const block = (kind, text) => {
    session.cycles += 1;
    if (session.cycles >= cfg.maxCycles) {
      const msg = `Ratchet: ${session.cycles} red verify cycles in a row (${kind}). Stopping the loop and handing this to you.\n\n${text}`;
      session.cycles = 0;
      writeJSON(sessionFile, session);
      appendRun(root, { session: sessionId, result: 'escalated', kind });
      return { outcome: 'escalate', message: msg };
    }
    writeJSON(sessionFile, session);
    appendRun(root, { session: sessionId, result: 'blocked', kind });
    return { outcome: 'block', message: `${text}\n\n(Ratchet verify cycle ${session.cycles}/${cfg.maxCycles}.)` };
  };

  // 1. Locked checks: intact, then green.
  const broken = integrityProblems(root, receipts);
  if (broken.length) {
    return block(
      'check-tampered',
      `Ratchet: a locked check was weakened.\n${broken.map((b) => `  - ${b}`).join('\n')}\n\nLocked checks only tighten. Restore them (git checkout -- <path>) and fix the code instead.`,
    );
  }
  const failing = runLockedChecks(root, receipts, cfg);
  if (failing.length) {
    const lines = failing.map(
      (f) => `Blocked at check: ${f.check.path} (${f.check.type}) for ${f.id}\n  receipt: .ratchet/${f.id}.json\n${f.output.replace(/^/gm, '  ')}`,
    );
    return block(
      'locked-check',
      `Ratchet: this is a bug class Ratchet already locked. 0 credits, no browser, Kane not run.\n\n${lines.join('\n\n')}\n\nRead the receipt to see the original failure, then fix the code so the check passes. Do not edit the check.`,
    );
  }

  // 2. Saved flows must not be weakened.
  const tampered = flowsTampered(root, cfg);
  if (tampered.length) {
    return block(
      'flow-tampered',
      `Ratchet: the browser flow was changed instead of the code.\n${tampered.map((t) => `  - ${t}`).join('\n')}\n\nRestore it. The objective and saved test are fixed; rerun the same objective after fixing the code.`,
    );
  }

  // 3. Which flows does this change touch?
  const tree = snapshotTree(root);
  const base = session.lastGreenTree ?? headTree(root);
  const changed = tree === base ? [] : changedFiles(root, base, tree);
  const affected = cfg.flows.filter((f) => pending[f.name] || changed.some((c) => under(c, f.paths)));
  if (!affected.length) {
    writeJSON(sessionFile, { ...session, cycles: 0 });
    return { outcome: 'pass', message: changed.length ? 'Ratchet: no saved flow covers the files changed.' : 'Ratchet: nothing changed since the last green run.' };
  }

  const unauthored = affected.filter((f) => !fs.existsSync(path.join(root, f.test)));
  const runnable = affected.filter((f) => !unauthored.includes(f));
  const notes = unauthored.map((f) => `flow "${f.name}" has no saved test yet (run: ratchet author ${f.name})`);
  if (!runnable.length) return { outcome: 'pass', message: `Ratchet: ${notes.join('; ')}` };

  // 4. Replay in a real browser.
  let app;
  try {
    app = await ensureApp(root, cfg);
  } catch (err) {
    appendRun(root, { session: sessionId, result: 'infra', reason: err.message });
    return { outcome: 'infra', message: `Ratchet: could not start the app, not blocking. ${err.message}` };
  }

  const results = [];
  try {
    for (const flow of runnable) {
      log(`ratchet: replaying "${flow.name}" with Kane (healing off)...`);
      results.push({ flow, res: await runKane(root, replayArgs(flow, cfg)) });
    }
  } finally {
    app.stop();
  }

  for (const { flow, res } of results) {
    appendRun(root, { session: sessionId, flow: flow.name, verdict: res.verdict, code: res.code, evidence: res.evidence, testUrl: res.testUrl });
  }

  const red = results.filter((r) => r.res.verdict === 'fail');
  const infra = results.filter((r) => r.res.verdict === 'not-started' || r.res.verdict === 'timeout');

  if (red.length) {
    for (const { flow, res } of red) {
      const failure = { runEnd: res.runEnd, reason: res.reason, summary: res.summary, finalState: res.finalState, remark: res.remark, evidence: res.evidence, testUrl: res.testUrl };
      if (pending[flow.name]) pending[flow.name].failure = failure; // keep the first bad tree: that is where the bug came in
      else pending[flow.name] = { id: newBugId(flow.name), flow: flow.name, objective: flow.objective, baseTree: base, badTree: tree, failedAt: new Date().toISOString(), failure };
    }
    writeJSON(p.pending, pending);
    const text = red.map(({ flow, res }) => failureText(flow, res)).join('\n\n');
    return block('kane-red', text);
  }

  if (infra.length) {
    const why = infra.map(({ flow, res }) => `"${flow.name}": Kane ${res.verdict} (exit ${res.code}) ${res.reason ?? ''}`.trim());
    return { outcome: 'infra', message: `Ratchet: Kane could not give a verdict, not blocking.\n${why.join('\n')}` };
  }

  // All green.
  const locked = [];
  for (const { flow } of results) {
    if (!pending[flow.name]) continue;
    locked.push(lockBug(root, cfg, pending[flow.name]));
    delete pending[flow.name];
  }
  writeJSON(p.pending, pending);
  // Lock commits change HEAD and the tree; re-snapshot so the next stop starts clean.
  writeJSON(sessionFile, { cycles: 0, lastGreenTree: locked.length ? snapshotTree(root) : tree });

  const msgs = [`Ratchet: Kane green on ${results.map((r) => `"${r.flow.name}"`).join(', ')}.`, ...notes, ...locked.map((l) => l.message)];
  return { outcome: 'pass', locked, message: msgs.join('\n\n') };
}

function failureText(flow, res) {
  return [
    `Ratchet: Kane replay FAILED for flow "${flow.name}" in a real browser.`,
    `run_end: ${JSON.stringify(res.runEnd ?? { status: 'failed', reason: res.reason })}`,
    res.remark ? `remark: ${res.remark}` : null,
    `evidence: ${res.evidence ?? 'not found'}${res.evidence ? `   (open: kane-cli evidence serve ${res.evidence})` : ''}`,
    res.testUrl ? `kane run: ${res.testUrl}` : null,
    '',
    'Fix the application code so this exact objective passes:',
    `  "${flow.objective}"`,
    '',
    `Do not edit ${flow.test}, .ratchet/, or the objective. When you stop, Ratchet replays the same saved flow with healing off.`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}
