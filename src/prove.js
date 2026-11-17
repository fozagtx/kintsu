// The proof: in a throwaway git worktree, show that
//   1. the check passes on the fixed code   (negative control)
//   2. the check fails once the bug is put back
// with no browser and no credits. A check that fails either half is not kept.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git } from './git.js';
import { runCheck } from './checks.js';

export function prove(root, cfg, { check, fixDiffPath, overlayTree }) {
  const started = Date.now();
  if (check.type === 'smoke') {
    return {
      proved: false,
      browser: true,
      note: 'A smoke promotion is a browser replay. Prove it with `ratchet smoke` (Kane, healing off).',
    };
  }

  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-prove-'));
  git(root, ['worktree', 'add', '--detach', '--force', wt, 'HEAD']);
  try {
    // Bring the worktree to "fixed code + new check" when the check is not committed yet.
    if (overlayTree) git(wt, ['checkout', overlayTree, '--', '.']);
    const nm = path.join(root, 'node_modules');
    if (fs.existsSync(nm)) fs.symlinkSync(nm, path.join(wt, 'node_modules'), 'dir');

    const control = runCheck(wt, check, cfg);

    // Put the bug back: undo exactly the fix, leave the check in place.
    // File by file, so one unrelated file that moved on since cannot sink the proof.
    const reverted = [];
    const skipped = [];
    for (const { file, patch } of splitDiff(fs.readFileSync(path.resolve(root, fixDiffPath), 'utf8'))) {
      try {
        git(wt, ['apply', '-R', '--whitespace=nowarn', '-'], { input: patch });
        reverted.push(file);
      } catch (err) {
        skipped.push({ file, error: err.message.split('\n').pop() });
      }
    }
    const applied = reverted.length > 0;
    const replay = applied
      ? runCheck(wt, check, cfg)
      : { ran: false, passed: false, output: `could not re-apply the bad code: ${skipped.map((s) => `${s.file}: ${s.error}`).join('; ')}` };

    const blocked = applied && replay.ran && !replay.passed;
    return {
      proved: control.passed && blocked,
      browser: false,
      credits: 0,
      control: { passed: control.passed, output: control.output },
      replay: { applied, reverted, skipped, blocked, output: replay.output },
      ms: Date.now() - started,
    };
  } finally {
    git(root, ['worktree', 'remove', '--force', wt], { allowFail: true });
    fs.rmSync(wt, { recursive: true, force: true });
  }
}

export function splitDiff(diff) {
  return diff
    .split(/^(?=diff --git )/m)
    .filter((p) => p.startsWith('diff --git '))
    .map((patch) => ({ file: /^diff --git a\/.+? b\/(.+)$/m.exec(patch)?.[1] ?? '?', patch }));
}

export function formatProof(bugId, check, proof) {
  if (check.type === 'smoke') return `${bugId}: ${proof.note}`;
  const lines = [
    `Proof for ${bugId} (${check.type}: ${check.path})`,
    `  fixed code:  check ${proof.control.passed ? 'passes' : 'FAILS'}  (negative control)`,
    `  bad code:    ${proof.replay.blocked ? 'blocked at check, 0 credits, no browser' : 'NOT blocked'}`,
  ];
  if (proof.replay.skipped?.length) lines.push(`  skipped (no longer applies): ${proof.replay.skipped.map((s) => s.file).join(', ')}`);
  if (!proof.proved) lines.push('', proof.control.passed ? proof.replay.output : proof.control.output);
  return lines.join('\n');
}
