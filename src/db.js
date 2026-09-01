import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(__dirname, '..');
export const dataDir = path.join(root, 'data');
export const uploadsDir = path.join(root, 'uploads');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'weekly.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'filler',
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS weekly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_label TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekly_report_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(weekly_report_id) REFERENCES weekly_reports(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS work_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  progress_html TEXT NOT NULL DEFAULT '',
  plan_html TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'blank',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by INTEGER,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS version_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekly_report_id INTEGER NOT NULL,
  version_no INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  operator_id INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY(weekly_report_id) REFERENCES weekly_reports(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS edit_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekly_report_id INTEGER NOT NULL,
  work_item_id INTEGER,
  field TEXT NOT NULL,
  action TEXT NOT NULL,
  operator_id INTEGER,
  created_at TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekly_report_id INTEGER NOT NULL DEFAULT 0,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS special_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekly_report_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content_html TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(weekly_report_id) REFERENCES weekly_reports(id) ON DELETE CASCADE
);
`);

// 迁移：新增「一句话核心进展」与「关键专项进展」字段（列已存在则忽略）
for (const sql of [
  "ALTER TABLE departments ADD COLUMN core_html TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE weekly_reports ADD COLUMN highlights_html TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE weekly_reports ADD COLUMN theme TEXT NOT NULL DEFAULT 'classic'"
]) {
  try { db.exec(sql); } catch { /* duplicate column: ignore */ }
}

// 迁移：把原有 highlights_html 内容迁入专项进展表（每个报告一条，避免历史数据丢失）
{
  const rows = db.prepare("SELECT id, highlights_html FROM weekly_reports WHERE highlights_html IS NOT NULL AND TRIM(highlights_html) != ''").all();
  for (const r of rows) {
    const cnt = db.prepare('SELECT COUNT(*) c FROM special_progress WHERE weekly_report_id=?').get(r.id).c;
    if (cnt === 0) {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO special_progress (weekly_report_id,title,content_html,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?)')
        .run(r.id, '关键专项进展', r.highlights_html, 0, now, now);
    }
  }
}

export const DEFAULT_DEPARTMENTS = [
  '服务变革管理',
  'VOC平台建设与管理',
  '服务运作与服务业务运营管理',
  '流程质量与内控合规管理'
];

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, salt, hash) {
  const h = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
}

if (!db.prepare('SELECT id FROM users WHERE username=?').get('admin')) {
  const { hash, salt } = hashPassword('admin123');
  db.prepare('INSERT INTO users (username,display_name,role,password_hash,salt,created_at) VALUES (?,?,?,?,?,?)')
    .run('admin', '管理员', 'admin', hash, salt, new Date().toISOString());
  console.log('[seed] admin user created (admin / admin123)');
}
