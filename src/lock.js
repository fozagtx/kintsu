// The ratchet step. Runs once a flow that was red goes green:
// diff the bad code against the fix, classify, write one check, prove it,
// write the receipt, commit. Never pushes.

import fs from 'node:fs';
import path from 'node:path';
import { git, snapshotTree, diffTrees, changedFiles, hasHead } from './git.js';
import { paths, writeJSON, writeText, rel } from './store.js';
import { classify } from './classify.js';
import { writeCheck, promoteToSmoke } from './write-check.js';
import { prove, formatProof } from './prove.js';

export function lockBug(root, cfg, pending, { commit = true } = {}) {
  const p = paths(root);
  const flow = cfg.flows.find((f) => f.name === pending.flow);
  if (!flow) throw new Error(`Pending bug ${pending.id} names unknown flow "${pending.flow}"`);

  const fixedTree = snapshotTree(root);
  const fixDiff = diffTrees(root, pending.badTree, fixedTree);
  const badDiff = diffTrees(root, pending.baseTree, pending.badTree);
  const fixFiles = changedFiles(root, pending.badTree, fixedTree);

  if (!fixDiff.trim()) {
    return {
      status: 'no-fix',
      message: `${pending.id}: "${flow.name}" went green with no code change since it failed. That is a flaky run, not a fix. No check written; look at ${pending.failure.evidence ?? 'the Kane run'}.`,
    };
  }

  writeText(p.badDiff(pending.id), badDiff);
  writeText(p.fixDiff(pending.id), fixDiff);

  let evidence = null;
  if (pending.failure.evidence) {
    const src = path.resolve(root, pending.failure.evidence);
    if (fs.existsSync(src)) {
      const dest = p.evidence(pending.id, fs.statSync(src).isDirectory() ? '.evidence' : path.extname(src) || '.evidence');
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
      evidence = rel(root, dest);
    }
  }

  const decision = classify({ failure: pending.failure, fixDiff, cfg, flow });
  const fixDiffPath = rel(root, p.fixDiff(pending.id));

  let written;
  let proof;
  let fallback = null;
  try {
    written = writeCheck(root, cfg, pending.id, decision, flow, evidence);
    proof = prove(root, cfg, { check: written.check, fixDiffPath, overlayTree: snapshotTree(root) });
  } catch (err) {
    proof = { proved: false, error: err.message };
  }

  // A check that does not pass on the fix and fail on the bug is worthless. Take it back.
  if (written?.check.type !== 'smoke' && !proof.proved) {
    written?.undo();
    fallback = { from: decision.type, why: proof.error ?? formatProof(pending.id, written.check, proof) };
    written = promoteToSmoke(root, flow);
    proof = prove(root, cfg, { check: written.check, fixDiffPath });
  }

  const receipt = {
    id: pending.id,
    flow: flow.name,
    objective: pending.objective,
    failedAt: pending.failedAt,
    lockedAt: new Date().toISOString(),
    kane: {
      verdict: 'fail',
      runEnd: pending.failure.runEnd,
      remark: pending.failure.remark,
      testUrl: pending.failure.testUrl,
      evidence: pending.failure.evidence,
    },
    evidence,
    badDiff: rel(root, p.badDiff(pending.id)),
    fixDiff: fixDiffPath,
    fixFiles,
    classification: { type: decision.type, reason: decision.reason, considered: decision.considered ?? [], signals: decision.signals },
    fallback,
    check: written.check,
    proof,
  };
  writeJSON(p.receipt(pending.id), receipt);

  let commitSha = null;
  if (commit && hasHead(root)) {
    const files = [...new Set([...fixFiles, written.check.path, rel(root, p.receipt(pending.id)), receipt.badDiff, receipt.fixDiff, evidence].filter(Boolean))];
    git(root, ['add', '-f', '--', ...files]);
    git(root, ['commit', '-q', '--only', '-m', commitMessage(receipt), '--', ...files]);
    commitSha = git(root, ['rev-parse', '--short', 'HEAD']).trim();
  }

  return { status: 'locked', receipt, commitSha, message: summary(receipt, commitSha) };
}

function commitMessage(r) {
  return [
    `ratchet: lock ${r.check.type} check for ${r.id}`,
    '',
    `Flow: ${r.flow}`,
    `Objective: ${r.objective}`,
    `Check: ${r.check.path} (${r.check.type})`,
    `Evidence: ${r.evidence ?? r.kane.evidence ?? 'none sealed'}`,
    r.kane.testUrl ? `Kane run: ${r.kane.testUrl}` : null,
    `Why this check: ${r.classification.reason}`,
    r.fallback ? `Fell back from ${r.fallback.from}: its proof did not hold.` : null,
    `Proof: ${r.proof.proved ? 'passes on the fix, blocked at check on the bad code, 0 credits' : r.proof.note ?? 'not proved'}`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

function summary(r, sha) {
  return [
    `Ratchet locked ${r.id} as ${({ "unit-test": "a unit test", eslint: "an ESLint rule", smoke: "a smoke promotion" })[r.check.type]}: ${r.check.path}`,
    `  why: ${r.classification.reason}`,
    r.fallback ? `  fell back from ${r.fallback.from}: its proof did not hold` : null,
    formatProof(r.id, r.check, r.proof).replace(/^/gm, '  '),
    `  evidence: ${r.evidence ?? r.kane.evidence ?? 'none sealed'}`,
    sha ? `  commit: ${sha} (not pushed)` : '  not committed (no HEAD yet)',
  ]
    .filter(Boolean)
    .join('\n');
}
