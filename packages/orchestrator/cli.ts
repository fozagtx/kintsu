import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { runKane, type KaneResult } from '../kane-runner/index.ts';
import { attribute, attributeFalsePass, extractStepAssets, type OwnershipEntry } from '../attribution/index.ts';
import { openStore } from '../store/index.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SHOP = 'http://localhost:3000';
const MAX_ATTEMPTS = 3;
const AGENT_CLI = process.env.KINTSU_AGENT ?? 'claude';
const change = JSON.parse(fs.readFileSync(path.join(ROOT, 'agents/change.json'), 'utf8'));
const ownership: OwnershipEntry[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'agents/ownership.json'), 'utf8'));
const db = openStore(ROOT);
const log = (m: string) => console.log(`[kintsu] ${m}`);

function seed() {
  db.prepare('INSERT OR IGNORE INTO change_requests VALUES (?, ?, ?, ?)').run(change.id, change.prompt, new Date().toISOString(), 'open');
  for (const t of change.tasks) {
    db.prepare('INSERT OR IGNORE INTO tasks (id, change_id, owner_agent, title, file_scope, depends_on, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      t.id, change.id, t.owner, t.title, JSON.stringify(t.files), JSON.stringify(t.depends_on), 'pending');
  }
  for (const s of change.seams) {
    db.prepare('INSERT OR REPLACE INTO seams (id, name, owners, objective, testmd_path, expected_final_state, tags) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      s.id, s.name, JSON.stringify(s.owners), s.objective, fs.existsSync(testmdPath(s.id)) ? testmdPath(s.id) : null, JSON.stringify(s.expected), JSON.stringify(s.tags));
  }
}
const testmdPath = (id: string) => path.join(ROOT, 'tests', `${id}_test.md`);

async function shopUp() {
  try {
    return (await fetch(SHOP, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
}
async function ensureShop() {
  if (await shopUp()) return;
  log('starting the shop on :3000');
  spawn('npm', ['--prefix', 'apps/shop', 'run', 'dev'], { cwd: ROOT, stdio: 'ignore', detached: true }).unref();
  for (let i = 0; i < 90; i++) {
    if (await shopUp()) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('shop did not start on :3000');
}

function agentFor(owner: string) {
  return change.tasks.find((t: any) => t.owner === owner);
}

function dispatchAgent(owner: string, prompt: string): { ok: boolean; output: string } {
  const args =
    AGENT_CLI === 'claude'
      ? ['-p', prompt, '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Edit,Write,Grep,Glob']
      : AGENT_CLI === 'codex'
        ? ['exec', '--full-auto', prompt]
        : ['-p', prompt];
  log(`dispatching ${owner} via ${AGENT_CLI}`);
  const env = { ...process.env };
  delete env.CLAUDECODE;
  const r = spawnSync(AGENT_CLI, args, { cwd: ROOT, env, encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 16 << 20 });
  return { ok: r.status === 0, output: `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim().slice(-6000) };
}

function ticketPrompt(seam: any, run: KaneResult, attr: ReturnType<typeof attribute>, owner: string, cmd: string[]) {
  const task = agentFor(owner);
  return `You are ${owner}. You own only these files: ${task.files.join(', ')}.
Kintsu's merge review ran Kane CLI against the running shop, and the composed flow "${seam.name}" FAILED. The failure was attributed to you.

Why you: ${attr.reason}
Kane run_end summary: ${run.summary ?? '(none)'}
Failing remark: ${run.failedRemark ?? '(none)'}
failure.yaml error: ${attr.errorMessage ?? '(none)'}  ${attr.triageTitle ? `| Kane triage: ${attr.triageTitle}` : ''}
Failed step: ${attr.failedStep} on ${attr.stepUrl}
Stored values (final_state): ${JSON.stringify(run.finalState)}
Expected: ${JSON.stringify(seam.expected)}
Pricing rules: docs/pricing-rules.md
Evidence pack: ${run.evidencePath}  (open: kane-cli evidence serve ${run.evidencePath})
Screenshots: ${attr.screenshots.slice(-4).join(', ')}

Fix the product code in your files so the flow is correct. Do not edit the Kane objective, agents/, tests/, or docs/. Do not run Kane yourself: Kintsu re-runs the identical command after you finish:
${cmd.join(' ')}
Do not add code comments. Reply with one paragraph describing the root cause and your change.`;
}

function seal(seamId: string, tags: string[]) {
  const dir = path.join(ROOT, '.testmuai', 'tests');
  const name = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.startsWith(seamId) && f.endsWith('_test.md')).sort((x, y) => fs.statSync(path.join(dir, y)).mtimeMs - fs.statSync(path.join(dir, x)).mtimeMs)[0] : undefined;
  const src = path.join(dir, name ?? `${seamId}_test.md`);
  if (!fs.existsSync(src)) return log(`no ${seamId}_test.md written by Kane to seal`);
  const md = fs.readFileSync(src, 'utf8');
  const tagged = /^---\n/.test(md)
    ? md.replace(/^---\n/, `---\ntags: [${tags.join(', ')}]\n`).replace(/\ntags:.*\n([\s\S]*?\ntags:)/, '\n$1')
    : `---\ntags: [${tags.join(', ')}]\n---\n${md}`;
  fs.mkdirSync(path.join(ROOT, 'tests'), { recursive: true });
  fs.writeFileSync(testmdPath(seamId), tagged);
  fs.rmSync(src);
  const out = path.join(dir, `output-${(name ?? `${seamId}_test.md`).replace(/_test\.md$/, '')}`);
  if (fs.existsSync(out)) fs.renameSync(out, path.join(ROOT, 'tests', `output-${seamId}`));
  db.prepare('UPDATE seams SET testmd_path = ? WHERE id = ?').run(testmdPath(seamId), seamId);
  log(`sealed tests/${seamId}_test.md`);
}

async function walkSeam(seamId: string): Promise<boolean> {
  const seam = change.seams.find((s: any) => s.id === seamId);
  if (!seam) throw new Error(`unknown seam ${seamId}`);
  await ensureShop();
  const cmd = ['run', seam.objective, '--url', SHOP, '--agent', '--headless', '--timeout', '180', '--name', seam.id];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    log(`Kane walks "${seam.name}" (attempt ${attempt}/${MAX_ATTEMPTS})`);
    db.prepare('DELETE FROM run_events WHERE seam_id = ?').run(seam.id);
    const run = await runKane(cmd, ROOT, (ev) => {
      if (!ev.type && ev.remark) db.prepare('INSERT INTO run_events (seam_id, at, step, status, remark) VALUES (?, ?, ?, ?, ?)').run(seam.id, new Date().toISOString(), String(ev.step ?? ''), String(ev.status ?? ''), String(ev.remark));
    });
    const runId = Number(db.prepare(`INSERT INTO kane_runs (seam_id, attempt, command, exit_code, run_end_status, summary, final_state, session_dir, evidence_path, test_url, credits_consumed, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(seam.id, attempt, JSON.stringify(run.command), run.exitCode, run.runEnd?.status ?? run.status, run.summary, JSON.stringify(run.finalState), run.sessionDir, run.evidencePath, run.testUrl, run.credits, run.startedAt, run.endedAt).lastInsertRowid);
    const shots = run.evidencePath ? extractStepAssets(run.evidencePath, path.join(ROOT, '.kintsu', 'runs', String(runId))) : [];
    db.prepare('UPDATE kane_runs SET screenshots = ? WHERE id = ?').run(JSON.stringify(shots.map((s) => path.relative(ROOT, s))), runId);
    log(`run ${runId}: exit ${run.exitCode}, ${run.summary ?? ''}`);

    const falsePass = run.exitCode === 0 ? attributeFalsePass(run, seam.expected) : null;
    if (run.exitCode === 0 && !falsePass) {
      seal(seam.id, seam.tags);
      return true;
    }
    if (falsePass) {
      const dir = path.join(ROOT, '.testmuai', 'tests');
      if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter((f) => f.includes(seam.id))) fs.rmSync(path.join(dir, f), { recursive: true });
    }
    const attr = falsePass ?? attribute(run, ownership, seam.expected);
    attr.screenshots = shots;
    db.prepare('INSERT INTO attributions VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(runId, attr.failedStep, attr.stepUrl, attr.verdict, attr.primaryOwner, JSON.stringify(attr.involved), attr.reason, attr.errorMessage);
    log(`attribution: ${attr.verdict} -> ${attr.primaryOwner ?? 'nobody'}. ${attr.reason}`);
    if (attr.verdict !== 'failed' || !attr.primaryOwner) {
      log('not a product defect, so no repair ticket. Fix the runner or the test, then re-run.');
      return false;
    }
    if (attempt === MAX_ATTEMPTS) break;
    const prompt = ticketPrompt(seam, run, attr, attr.primaryOwner, ['kane-cli', ...cmd]);
    const ticketId = Number(db.prepare('INSERT INTO repair_tickets (run_id, assignee, prompt, status, attempt, max_attempts) VALUES (?, ?, ?, ?, ?, ?)').run(runId, attr.primaryOwner, prompt, 'open', attempt, MAX_ATTEMPTS).lastInsertRowid);
    const res = dispatchAgent(attr.primaryOwner, prompt);
    db.prepare('UPDATE repair_tickets SET status = ?, agent_output = ? WHERE id = ?').run(res.ok ? 'patched' : 'agent-error', res.output, ticketId);
    log(`${attr.primaryOwner}: ${res.output.split('\n').slice(-3).join(' ')}`);
    if (!res.ok) return false;
  }
  log(`"${seam.name}" still failing after ${MAX_ATTEMPTS} attempts. Escalating to a human.`);
  return false;
}

async function wave() {
  const done = new Set<string>();
  const tasks = change.tasks;
  while (done.size < tasks.length) {
    const ready = tasks.filter((t: any) => !done.has(t.id) && t.depends_on.every((d: string) => done.has(d)));
    log(`wave: ${ready.map((t: any) => t.owner).join(', ')}`);
    for (const t of ready) {
      const built = t.files.every((f: string) => fs.existsSync(path.join(ROOT, f)));
      if (!built) {
        const r = dispatchAgent(t.owner, `You are ${t.owner}. Implement "${t.title}" for the shop in apps/shop, touching only ${t.files.join(', ')}. Follow docs/pricing-rules.md. Do not add code comments. Report when done; you do not decide whether the product is done.`);
        if (!r.ok) throw new Error(`${t.owner} failed: ${r.output.slice(-500)}`);
      }
      db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('complete', t.id);
      done.add(t.id);
    }
    for (const s of change.seams.filter((s: any) => ready.some((t: any) => t.id === s.after))) await walkSeam(s.id);
  }
}

async function replay() {
  await ensureShop();
  const files = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('_test.md'));
  for (const f of files) {
    const r = await runKane(['testmd', 'run', `tests/${f}`, '--agent', '--headless', '--timeout', '180', '--no-adaptive-heal'], ROOT);
    log(`${f}: exit ${r.exitCode} ${r.testmdDone?.overall_status ?? r.summary ?? ''}`);
  }
}

seed();
const [cmd, arg] = process.argv.slice(2);
if (cmd === 'seam') process.exit((await walkSeam(arg)) ? 0 : 1);
else if (cmd === 'wave') await wave();
else if (cmd === 'replay') await replay();
else if (cmd === 'graph') await import('../../apps/dashboard/server.ts');
else console.log('usage: kintsu wave | kintsu seam <id> | kintsu replay | kintsu graph');
