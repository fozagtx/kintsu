import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openStore(root: string) {
  fs.mkdirSync(path.join(root, '.kintsu'), { recursive: true });
  const db = new DatabaseSync(path.join(root, '.kintsu', 'kintsu.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS change_requests (id TEXT PRIMARY KEY, prompt TEXT, created_at TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, change_id TEXT, owner_agent TEXT, title TEXT, file_scope TEXT, depends_on TEXT, status TEXT, attempt INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS seams (id TEXT PRIMARY KEY, name TEXT, owners TEXT, objective TEXT, testmd_path TEXT, expected_final_state TEXT, tags TEXT);
    CREATE TABLE IF NOT EXISTS kane_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, seam_id TEXT, attempt INTEGER, command TEXT, exit_code INTEGER, run_end_status TEXT, summary TEXT, final_state TEXT, session_dir TEXT, evidence_path TEXT, test_url TEXT, credits_consumed REAL, screenshots TEXT, started_at TEXT, ended_at TEXT);
    CREATE TABLE IF NOT EXISTS run_events (id INTEGER PRIMARY KEY AUTOINCREMENT, seam_id TEXT, at TEXT, step TEXT, status TEXT, remark TEXT);
    CREATE TABLE IF NOT EXISTS attributions (run_id INTEGER PRIMARY KEY, failed_step TEXT, step_url TEXT, verdict TEXT, primary_owner TEXT, involved_agents TEXT, reason TEXT, evidence_excerpt TEXT);
    CREATE TABLE IF NOT EXISTS repair_tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, assignee TEXT, prompt TEXT, status TEXT, attempt INTEGER, max_attempts INTEGER, agent_output TEXT);
  `);
  return db;
}

export type Store = ReturnType<typeof openStore>;

export function graphSnapshot(db: Store, at?: string) {
  const tasks = db.prepare('SELECT * FROM tasks').all() as any[];
  const seams = db.prepare('SELECT * FROM seams').all() as any[];
  const nodes = tasks.map((t) => ({ id: t.owner_agent, title: t.title, status: t.status }));
  const edges = seams.map((s) => {
    const run = (at
      ? db.prepare('SELECT * FROM kane_runs WHERE seam_id = ? AND ended_at <= ? ORDER BY id DESC LIMIT 1').get(s.id, at)
      : db.prepare('SELECT * FROM kane_runs WHERE seam_id = ? ORDER BY id DESC LIMIT 1').get(s.id)) as any;
    const attr = run ? (db.prepare('SELECT * FROM attributions WHERE run_id = ?').get(run.id) as any) : null;
    const ticket = run ? (db.prepare('SELECT * FROM repair_tickets WHERE run_id = ?').get(run.id) as any) : null;
    const live = at ? null : (db.prepare('SELECT * FROM run_events WHERE seam_id = ? ORDER BY id DESC LIMIT 1').get(s.id) as any);
    let color = 'gray';
    if (run) color = attr?.verdict === 'failed' ? 'red' : run.exit_code === 0 ? 'green' : 'amber';
    return { id: s.id, name: s.name, owners: JSON.parse(s.owners), color, run, attribution: attr, ticket, live };
  });
  return { nodes, edges };
}
