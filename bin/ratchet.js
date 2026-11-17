#!/usr/bin/env node
// ratchet verify [--hook]   run locked checks, then Kane on touched flows (Stop hook entry)
// ratchet author <flow>     author a flow once with Kane and save it (--name)
// ratchet lock              replay pending red flows; lock the ones now green
// ratchet prove [bug-id]    re-apply the bad code, show the check blocks it (no browser)
// ratchet check             run every locked check
// ratchet smoke             replay every smoke-tagged Kane flow, healing off
// ratchet status            pending bugs and locked checks

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../src/git.js';
import { loadConfig, listReceipts, paths, readJSON, writeJSON } from '../src/store.js';
import { verify, flowFingerprint } from '../src/verify.js';
import { runKane, authorArgs, replayArgs, smokeArgs } from '../src/run-kane.js';
import { ensureApp } from '../src/app.js';
import { lockBug } from '../src/lock.js';
import { prove, formatProof } from '../src/prove.js';
import { runLockedChecks, integrityProblems } from '../src/checks.js';

const [cmd = 'help', ...rest] = process.argv.slice(2);
const root = repoRoot(process.env.CLAUDE_PROJECT_DIR || process.cwd());

async function readStdin() {
  if (process.stdin.isTTY) return {};
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function main() {
  if (cmd === 'help' || cmd === '--help') {
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('// ratchet')).map((l) => l.slice(3)).join('\n'));
    return 0;
  }
  if (!root) {
    console.error('ratchet: not inside a git repository');
    return cmd === 'verify' ? 0 : 1;
  }
  const cfg = loadConfig(root);

  switch (cmd) {
    case 'verify': {
      const hook = rest.includes('--hook');
      const input = hook ? await readStdin() : {};
      let r;
      try {
        r = await verify(root, cfg, { sessionId: input.session_id ?? 'cli', log: (m) => console.error(m) });
      } catch (err) {
        // A crash in Ratchet is infrastructure: never trap the agent because of it.
        console.error(`ratchet verify error (not blocking): ${err.stack || err.message}`);
        return 0;
      }
      if (!hook) {
        console.log(r.message);
        return r.outcome === 'block' || r.outcome === 'escalate' ? 1 : 0;
      }
      if (r.outcome === 'block') {
        console.error(r.message);
        return 2; // Claude Code: exit 2 blocks the stop and feeds stderr to the agent
      }
      // Pass, infra, or escalation: let the agent stop, tell the human.
      console.log(JSON.stringify({ systemMessage: r.message }));
      return 0;
    }

    case 'author': {
      const flow = cfg.flows.find((f) => f.name === rest[0]);
      if (!flow) {
        console.error(`usage: ratchet author <flow>   flows: ${cfg.flows.map((f) => f.name).join(', ')}`);
        return 1;
      }
      const app = await ensureApp(root, cfg);
      let res;
      try {
        console.error(`ratchet: authoring "${flow.name}" with Kane: ${flow.objective}`);
        res = await runKane(root, authorArgs(flow, cfg), { onEvent: (e) => e.type === 'run_end' && console.error(JSON.stringify(e)) });
      } finally {
        app.stop();
      }
      if (res.verdict !== 'pass') {
        console.error(`ratchet: authoring ${res.verdict} (exit ${res.code}). ${res.reason ?? ''}\n${res.stderrTail}`);
        return res.code || 1;
      }
      const saved = findSavedTest(root, flow);
      if (!saved) {
        console.error(`ratchet: Kane passed but no ${flow.name}_test.md was found under .testmuai/. Set "test" for this flow in .ratchet/config.json.`);
        return 1;
      }
      if (saved !== flow.test) {
        const raw = readJSON(paths(root).config);
        raw.flows.find((f) => f.name === flow.name).test = saved;
        writeJSON(paths(root).config, raw);
        flow.test = saved;
      }
      const lock = readJSON(paths(root).flowsLock, {});
      lock[flow.name] = flowFingerprint(root, flow);
      writeJSON(paths(root).flowsLock, lock);
      console.log(`ratchet: saved ${saved} and locked its objective + steps. Evidence: ${res.evidence ?? 'none found'}`);
      return 0;
    }

    case 'lock': {
      const pending = readJSON(paths(root).pending, {});
      const flows = cfg.flows.filter((f) => pending[f.name]);
      if (!flows.length) {
        console.log('ratchet: no pending bugs.');
        return 0;
      }
      const app = await ensureApp(root, cfg);
      let code = 0;
      try {
        for (const flow of flows) {
          const res = await runKane(root, replayArgs(flow, cfg));
          if (res.verdict !== 'pass') {
            console.log(`ratchet: "${flow.name}" is still ${res.verdict}; nothing locked.`);
            code = 1;
            continue;
          }
          const out = lockBug(root, cfg, pending[flow.name]);
          delete pending[flow.name];
          console.log(out.message);
        }
      } finally {
        app.stop();
        writeJSON(paths(root).pending, pending);
      }
      return code;
    }

    case 'prove': {
      const receipts = listReceipts(root).filter((r) => !rest[0] || r.id === rest[0]);
      if (!receipts.length) {
        console.log(rest[0] ? `ratchet: no receipt ${rest[0]}` : 'ratchet: no locked checks yet.');
        return rest[0] ? 1 : 0;
      }
      let ok = true;
      for (const r of receipts) {
        const proof = prove(root, cfg, { check: r.check, fixDiffPath: r.fixDiff });
        console.log(formatProof(r.id, r.check, proof) + '\n');
        if (r.check.type !== 'smoke' && !proof.proved) ok = false;
      }
      return ok ? 0 : 1;
    }

    case 'check': {
      const receipts = listReceipts(root);
      const problems = integrityProblems(root, receipts);
      const failing = runLockedChecks(root, receipts, cfg);
      for (const p of problems) console.log(`tampered: ${p}`);
      for (const f of failing) console.log(`blocked at check: ${f.check.path} (${f.id})\n${f.output}\n`);
      if (!problems.length && !failing.length) console.log(`ratchet: ${receipts.length} locked check(s) green.`);
      return problems.length || failing.length ? 1 : 0;
    }

    case 'smoke': {
      const app = await ensureApp(root, cfg);
      try {
        const res = await runKane(root, smokeArgs());
        console.log(`ratchet smoke: ${res.verdict} (exit ${res.code}) ${res.reason ?? ''}${res.evidence ? `\nevidence: ${res.evidence}` : ''}`);
        return res.code;
      } finally {
        app.stop();
      }
    }

    case 'status': {
      const pending = readJSON(paths(root).pending, {});
      const receipts = listReceipts(root);
      console.log(`pending bugs: ${Object.keys(pending).length ? '' : 'none'}`);
      for (const b of Object.values(pending)) console.log(`  ${b.id}  flow=${b.flow}  evidence=${b.failure.evidence ?? '-'}`);
      console.log(`locked checks: ${receipts.length ? '' : 'none'}`);
      for (const r of receipts) console.log(`  ${r.id}  ${r.check.type}  ${r.check.path}  proof=${r.proof.proved ? 'held' : r.check.type === 'smoke' ? 'browser' : 'NOT HELD'}`);
      return 0;
    }

    default:
      console.error(`ratchet: unknown command "${cmd}". Try: ratchet help`);
      return 1;
  }
}

function findSavedTest(root, flow) {
  if (fs.existsSync(path.join(root, flow.test))) return flow.test;
  const target = `${flow.name}_test.md`;
  const stack = [path.join(root, '.testmuai')];
  while (stack.length) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== 'evidence') stack.push(p);
      else if (e.name === target) return path.relative(root, p).split(path.sep).join('/');
    }
  }
  return null;
}

main().then(
  (code) => process.exit(code ?? 0),
  (err) => {
    console.error(`ratchet: ${err.message}`);
    process.exit(cmd === 'verify' ? 0 : 1);
  },
);
