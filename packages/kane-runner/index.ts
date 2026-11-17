import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type KaneResult = {
  command: string[];
  exitCode: number;
  runEnd: Record<string, any> | null;
  testmdDone: Record<string, any> | null;
  status: 'passed' | 'failed' | 'not-started' | 'timeout';
  summary: string | null;
  finalState: Record<string, unknown> | null;
  sessionDir: string | null;
  evidencePath: string | null;
  testUrl: string | null;
  credits: number | null;
  failedRemark: string | null;
  stderrTail: string;
  startedAt: string;
  endedAt: string;
};

export type OnEvent = (ev: Record<string, any>) => void;

export function runKane(args: string[], cwd: string, onEvent?: OnEvent): Promise<KaneResult> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  return new Promise((resolve) => {
    const child = spawn('kane-cli', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const events: Record<string, any>[] = [];
    let buf = '';
    let stderr = '';
    const take = (line: string) => {
      line = line.trim();
      if (!line.startsWith('{')) return;
      try {
        const ev = JSON.parse(line);
        events.push(ev);
        onEvent?.(ev);
      } catch {}
    };
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        take(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    });
    child.stderr.on('data', (d) => (stderr += d));
    let done = false;
    const finish = (code: number) => {
      if (done) return;
      done = true;
      if (buf) take(buf);
      resolve(summarize(args, code, events, stderr, cwd, t0, startedAt));
    };
    child.on('error', (err) => {
      stderr += `\nspawn error: ${err.message}`;
      finish(2);
    });
    child.on('close', (code) => finish(code ?? 3));
  });
}

function summarize(args: string[], code: number, events: Record<string, any>[], stderr: string, cwd: string, t0: number, startedAt: string): KaneResult {
  const testmdDone = events.findLast((e) => e.type === 'test_md_done' || e.type === 'testrun_done') ?? null;
  const runEnds = events.filter((e) => e.type === 'run_end');
  const failedRunEnd = runEnds.find((e) => e.status === 'failed');
  const runEnd = failedRunEnd ?? runEnds.at(-1) ?? null;
  const failedStep = events.findLast((e) => !e.type && e.status === 'failed' && e.remark);
  const status = code === 0 ? 'passed' : code === 1 ? 'failed' : code === 3 ? 'timeout' : 'not-started';
  const sessionDir = runEnd?.session_dir ?? null;
  return {
    command: ['kane-cli', ...args],
    exitCode: code,
    runEnd,
    testmdDone,
    status,
    summary: runEnd?.summary || runEnd?.one_liner || runEnd?.reason || testmdDone?.overall_status || null,
    finalState: runEnd?.final_state ?? null,
    sessionDir,
    evidencePath: findPack(stderr, sessionDir, cwd, t0),
    testUrl: runEnd?.test_url ?? testmdDone?.share_url ?? null,
    credits: runEnd?.credits_consumed ?? null,
    failedRemark: failedStep?.remark ?? runEnd?.reason ?? null,
    stderrTail: stderr.slice(-2000),
    startedAt,
    endedAt: new Date().toISOString(),
  };
}

function newestPack(dir: string, since: number): string | null {
  if (!fs.existsSync(dir)) return null;
  const packs = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.evidence'))
    .map((f) => path.join(dir, f))
    .filter((p) => fs.statSync(p).mtimeMs >= since - 1000)
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return packs[0] ?? null;
}

function findPack(stderr: string, sessionDir: string | null, cwd: string, since: number): string | null {
  const hint = /evidence serve\s+(\S+\.evidence)/.exec(stderr)?.[1];
  if (hint && fs.existsSync(hint)) return hint;
  if (sessionDir) {
    const p = newestPack(path.join(sessionDir, 'evidence'), 0);
    if (p) return p;
  }
  return newestPack(path.join(cwd, '.testmuai', 'evidence'), since);
}
