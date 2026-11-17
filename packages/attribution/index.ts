import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { KaneResult } from '../kane-runner/index.ts';

export type OwnershipEntry = { screen: string; owner: string; involved?: string[] };
export type Attribution = {
  verdict: 'failed' | 'broken' | 'runner-error';
  failedStep: string | null;
  stepUrl: string | null;
  primaryOwner: string | null;
  involved: string[];
  reason: string;
  errorMessage: string | null;
  screenshots: string[];
  triageTitle: string | null;
};

function unzipList(pack: string): string[] {
  return execFileSync('unzip', ['-Z1', pack], { encoding: 'utf8', maxBuffer: 32 << 20 }).split('\n').filter(Boolean);
}
function unzipRead(pack: string, entry: string): string {
  return execFileSync('unzip', ['-p', pack, entry], { encoding: 'utf8', maxBuffer: 32 << 20 });
}
function yamlValue(text: string, key: string): string | null {
  const m = new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm').exec(text);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
}

export function extractStepAssets(pack: string, outDir: string): string[] {
  const shots = unzipList(pack).filter((e) => /steps\/[^/]+\/(screenshot\.(jpg|png)|annotated\.png)$/.test(e));
  fs.mkdirSync(outDir, { recursive: true });
  return shots.map((e) => {
    const name = e.split('/').slice(-2).join('_');
    const dest = path.join(outDir, name);
    fs.writeFileSync(dest, execFileSync('unzip', ['-p', pack, e], { maxBuffer: 64 << 20 }));
    return dest;
  });
}

export function attribute(run: KaneResult, map: OwnershipEntry[], expected: Record<string, number>): Attribution {
  const base = { failedStep: null, stepUrl: null, primaryOwner: null, involved: [], errorMessage: null, screenshots: [], triageTitle: null };
  if (run.exitCode === 2 || run.exitCode === 3) {
    return { ...base, verdict: 'runner-error', reason: `Kane exit ${run.exitCode} (${run.exitCode === 2 ? 'did not start' : 'timeout or cancelled'}). Fix the runner, not a feature.` };
  }
  if (!run.evidencePath) {
    return { ...base, verdict: 'runner-error', reason: 'Kane exited 1 but no evidence pack was found, so no product check is proven to have failed (possibly an upload-only failure).' };
  }

  const entries = unzipList(run.evidencePath);
  const failureEntry = entries.find((e) => /steps\/[^/]+\/failure\.yaml$/.test(e));
  if (!failureEntry) {
    return { ...base, verdict: 'runner-error', reason: 'Exit 1 with no failed step in the pack: treated as a runner or upload failure, not a seam bug.' };
  }
  const stepDir = failureEntry.replace(/failure\.yaml$/, '');
  const failure = unzipRead(run.evidencePath, failureEntry);
  const stepJson = entries.includes(`${stepDir}step.json`) ? JSON.parse(unzipRead(run.evidencePath, `${stepDir}step.json`)) : {};
  const stepStatus = yamlValue(failure, 'status');
  const errorMessage = yamlValue(failure, 'message');
  const triageTitle = yamlValue(failure, 'title');
  const stepUrl: string | null = stepJson.url ?? yamlValue(failure, 'url');
  const failedStep = stepDir.split('/').filter(Boolean).at(-1) ?? null;

  if (stepStatus === 'broken') {
    return { ...base, verdict: 'broken', failedStep, stepUrl, errorMessage, triageTitle, reason: 'Kane marked the step broken (environment, infrastructure or test fault). Not sent to a feature agent.' };
  }

  const fs_ = (run.finalState ?? {}) as Record<string, unknown>;
  const num = (k: string) => {
    const v = fs_[k];
    const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) && String(v ?? '') !== '' ? n : null;
  };
  const mismatches = Object.entries(expected)
    .filter(([k, want]) => num(k) !== null && Math.abs((num(k) as number) - want) > 0.004)
    .map(([k, want]) => `${k}: expected ${want.toFixed(2)}, got ${(num(k) as number).toFixed(2)}`);

  let primaryOwner: string | null = null;
  let involved: string[] = [];
  let reason = '';
  if (mismatches.some((m) => m.startsWith('discount'))) {
    primaryOwner = 'coupon-agent';
    involved = ['giftwrap-agent'];
    reason = `Stored discount is wrong (${mismatches.join('; ')}). Discount errors belong to the shared pricing module owned by coupon-agent; gift wrap is involved because the error only appears with wrap on.`;
  } else if (mismatches.some((m) => m.startsWith('wrap'))) {
    primaryOwner = 'giftwrap-agent';
    reason = `Stored wrap fee is wrong (${mismatches.join('; ')}).`;
  } else {
    const hit = map.find((m) => stepUrl && new URL(stepUrl).pathname.startsWith(m.screen));
    primaryOwner = hit?.owner ?? null;
    involved = hit?.involved ?? [];
    reason = hit ? `Failed step ran on ${new URL(stepUrl!).pathname}, owned by ${hit.owner} in the ownership map.` : `No owner matched ${stepUrl ?? 'the failed step'}; a human must assign it.`;
    if (mismatches.length) reason += ` Stored values: ${mismatches.join('; ')}.`;
  }
  return { verdict: 'failed', failedStep, stepUrl, primaryOwner, involved, reason, errorMessage, screenshots: [], triageTitle };
}
