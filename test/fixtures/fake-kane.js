#!/usr/bin/env node
// Test double for kane-cli, used only by Ratchet's own test suite
// (RATCHET_KANE_BIN). It speaks Kane's contract: NDJSON on stdout ending in
// run_end, exit 0 pass / 1 fail, a sealed .evidence file, and --name saving a
// _test.md. It judges the two demo flows by hitting the real running app.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const cwd = process.cwd();
const url = opt('--url') ?? 'http://localhost:4310';
const emit = (ev) => process.stdout.write(JSON.stringify(ev) + '\n');

if (process.env.RATCHET_FAKE_KANE_LOG) fs.appendFileSync(process.env.RATCHET_FAKE_KANE_LOG, args.join(' ') + '\n');

const flowOf = (name) => (name.includes('terms') ? 'signup-terms' : 'signup');

async function judge(flow) {
  if (flow === 'signup') {
    const res = await fetch(`${url}/api/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada Lovelace', email: 'ada@example.com', plan: 'pro', terms: true }),
    });
    const { account } = await res.json();
    const plan = { free: 'Free', team: 'Team', pro: 'Pro' }[account?.plan];
    return plan === 'Pro'
      ? { ok: true, summary: 'Welcome message says Ada Lovelace is on the Pro plan.' }
      : { ok: false, summary: `Welcome message says "Welcome, Ada Lovelace. You're on the ${plan} plan." instead of the Pro plan that was chosen.` };
  }
  const js = await (await fetch(`${url}/app.js`)).text();
  const html = await (await fetch(`${url}/`)).text();
  const reallyDisabled = /submit\.disabled\s*=/.test(js) && /<button[^>]*id="submit"[^>]*\bdisabled\b(?!-)/.test(html.replace(/is-disabled/g, ''));
  return reallyDisabled
    ? { ok: true, summary: 'Create account button is disabled while terms are unticked; no welcome message.' }
    : { ok: false, summary: 'Create account looked disabled but the click still went through: the account was created and the welcome message appeared with terms unticked.' };
}

function seal() {
  const dir = path.join(cwd, '.testmuai', 'evidence');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `run-${Date.now()}-${process.pid}.evidence`);
  fs.writeFileSync(file, JSON.stringify({ fake: true, args }) + '\n');
  return path.relative(cwd, file);
}

async function main() {
  let flow;
  let name;
  if (args[0] === 'run') {
    name = opt('--name');
    flow = flowOf(name ?? '');
  } else if (args[0] === 'testmd' && args[1] === 'run') {
    name = path.basename(args[2]).replace(/_test\.md$/, '');
    flow = flowOf(name);
  } else {
    emit({ type: 'error', message: `fake-kane: unsupported ${args.join(' ')}` });
    return 2;
  }

  emit({ type: 'run_start', run_id: 'run-0', objective: args[1] });
  emit({ type: 'step', n: 1, action: 'navigate', url });
  const verdict = await judge(flow);
  const evidence = seal();
  emit({ type: 'step', n: 2, action: 'assert', passed: verdict.ok, remark: verdict.summary });

  if (args[0] === 'run' && verdict.ok && name) {
    const file = path.join(cwd, '.testmuai', 'tests', `${name}_test.md`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `---\nmode: testing\ntags: [${flow}]\nurl: ${url}\n---\n\n## Open the signup page\n\n## Fill and submit\n\n## Verify the outcome\n`);
  }

  emit({
    type: 'run_end',
    status: verdict.ok ? 'passed' : 'failed',
    run_id: 'run-0',
    summary: verdict.summary,
    reason: verdict.ok ? undefined : verdict.summary,
    final_state: { url, welcome_visible: !verdict.ok || flow === 'signup' },
    test_url: `https://example.invalid/kane/runs/${Date.now()}`,
    credits_consumed: 0,
    evidence_path: evidence,
  });
  return verdict.ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    emit({ type: 'error', message: err.message });
    process.exit(2);
  },
);
