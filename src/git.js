import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

// Ratchet's own bookkeeping never counts as app code.
const EXCLUDE = [':(exclude).ratchet', ':(exclude).testmuai', ':(exclude)node_modules'];

export function git(cwd, args, { env, input, allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      env: env ? { ...process.env, ...env } : process.env,
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(' ')} failed: ${(err.stderr || err.message).toString().trim()}`);
  }
}

export function repoRoot(cwd) {
  const out = git(cwd, ['rev-parse', '--show-toplevel'], { allowFail: true });
  return out ? out.trim() : null;
}

export function headTree(root) {
  const out = git(root, ['rev-parse', 'HEAD^{tree}'], { allowFail: true });
  return out ? out.trim() : EMPTY_TREE;
}

export function hasHead(root) {
  return git(root, ['rev-parse', '--verify', 'HEAD'], { allowFail: true }) !== null;
}

// Hash the whole working tree (tracked + untracked, minus .gitignore) into a
// tree object without touching the real index or the working copy.
export function snapshotTree(root) {
  const gitDir = git(root, ['rev-parse', '--absolute-git-dir']).trim();
  const index = path.join(gitDir, `ratchet-index-${process.pid}-${Date.now()}`);
  const env = { GIT_INDEX_FILE: index };
  try {
    git(root, ['add', '-A', '--', '.'], { env });
    return git(root, ['write-tree'], { env }).trim();
  } finally {
    fs.rmSync(index, { force: true });
  }
}

export function diffTrees(root, from, to) {
  return git(root, ['diff', '--binary', from, to, '--', '.', ...EXCLUDE]);
}

export function changedFiles(root, from, to) {
  return git(root, ['diff', '--name-only', from, to, '--', '.', ...EXCLUDE])
    .split('\n')
    .filter(Boolean);
}
