import Database from 'better-sqlite3';
import fs from 'node:fs';

const DB_PATH = 'data/weekly.db';
const BACKUP = DB_PATH + '.bak.2026-09-03';
if (!fs.existsSync(BACKUP)) {
  fs.copyFileSync(DB_PATH, BACKUP);
  console.log('[migrate] backup created:', BACKUP);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

db.exec(`
CREATE TABLE weekly_reports_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_label TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  highlights_html TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'classic'
);
INSERT INTO weekly_reports_new SELECT id, period_label, title, status, created_by, created_at, updated_at, published_at, highlights_html, theme FROM weekly_reports;
DROP TABLE weekly_reports;
ALTER TABLE weekly_reports_new RENAME TO weekly_reports;
`);

db.pragma('foreign_keys = ON');
console.log('[migrate] period_label UNIQUE constraint removed');

const idx = db.prepare("PRAGMA index_list('weekly_reports')").all();
console.log('[migrate] indexes:', idx);

db.close();
