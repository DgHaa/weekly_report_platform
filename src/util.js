import { db } from './db.js';

export function logHistory({ weekly_report_id, work_item_id = null, field, action, operator_id, summary = '' }) {
  db.prepare(
    'INSERT INTO edit_history (weekly_report_id,work_item_id,field,action,operator_id,created_at,summary) VALUES (?,?,?,?,?,?,?)'
  ).run(weekly_report_id, work_item_id, field, action, operator_id, new Date().toISOString(), summary);
}

export function getReportTree(id) {
  const report = db.prepare('SELECT * FROM weekly_reports WHERE id=?').get(id);
  if (!report) return null;
  const departments = db
    .prepare('SELECT * FROM departments WHERE weekly_report_id=? ORDER BY sort_order,id')
    .all(id);
  for (const dep of departments) {
    dep.work_items = db
      .prepare('SELECT * FROM work_items WHERE department_id=? ORDER BY sort_order,id')
      .all(dep.id);
  }
  report.departments = departments;
  report.special_progress = db
    .prepare('SELECT * FROM special_progress WHERE weekly_report_id=? ORDER BY sort_order, id')
    .all(id);
  return report;
}

export function buildSnapshot(tree) {
  return JSON.stringify({
    period_label: tree.period_label,
    title: tree.title,
    status: tree.status,
    departments: tree.departments.map((d) => ({
      name: d.name,
      work_items: d.work_items.map((w) => ({
        title: w.title,
        progress_html: w.progress_html,
        plan_html: w.plan_html,
        status: w.status
      }))
    }))
  });
}

export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((d - yearStart) / 86400000 / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
