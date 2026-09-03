import { Router } from 'express';
import { db, DEFAULT_DEPARTMENTS } from '../db.js';
import { authMiddleware, requireAdmin } from '../middleware.js';
import { logHistory, getReportTree, isoWeek } from '../util.js';
import { themeList, getTheme } from '../export/themes.js';

const r = Router();
r.use(authMiddleware);

r.get('/themes', (req, res) => {
  res.json(themeList());
});

// 字段级编辑历史：联表用户显示名，支持 field/action/limit 过滤
r.get('/:id/history', (req, res) => {
  const rep = db.prepare('SELECT id FROM weekly_reports WHERE id=?').get(req.params.id);
  if (!rep) return res.status(404).json({ error: 'not found' });
  const clauses = ['h.weekly_report_id=?'];
  const params = [rep.id];
  if (req.query.field) { clauses.push('h.field=?'); params.push(req.query.field); }
  if (req.query.action) { clauses.push('h.action=?'); params.push(req.query.action); }
  const lim = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);
  const rows = db.prepare(
    `SELECT h.id, h.field, h.action, h.work_item_id, h.operator_id, h.created_at, h.summary,
            u.display_name AS operator_name, u.username AS operator_username
       FROM edit_history h
       LEFT JOIN users u ON h.operator_id = u.id
      WHERE ${clauses.join(' AND ')}
      ORDER BY h.created_at DESC
      LIMIT ${lim}`
  ).all(...params);
  res.json(rows);
});

r.get('/', (req, res) => {
  const { status, q, period } = req.query;
  let sql = 'SELECT * FROM weekly_reports WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status=?'; params.push(status); }
  if (period) { sql += ' AND period_label LIKE ?'; params.push(`%${period}%`); }
  if (q) { sql += ' AND (title LIKE ? OR period_label LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

r.post('/', (req, res) => {
  const { period_label, title } = req.body || {};
  const label = period_label || isoWeek();
  const now = new Date().toISOString();
  const info = db
    .prepare('INSERT INTO weekly_reports (period_label,title,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?)')
    .run(label, title || '', 'draft', req.user.uid, now, now);
  const rid = info.lastInsertRowid;
  const insDep = db.prepare('INSERT INTO departments (weekly_report_id,name,sort_order,is_default) VALUES (?,?,?,?)');
  DEFAULT_DEPARTMENTS.forEach((n, i) => insDep.run(rid, n, i, 1));
  logHistory({ weekly_report_id: rid, field: 'report', action: 'create', operator_id: req.user.uid, summary: `创建周报 ${label}` });
  res.json(getReportTree(rid));
});

r.get('/:id', (req, res) => {
  const tree = getReportTree(req.params.id);
  if (!tree) return res.status(404).json({ error: 'not found' });
  tree.versions = db
    .prepare('SELECT id,version_no,created_at,note,operator_id FROM version_snapshots WHERE weekly_report_id=? ORDER BY version_no DESC')
    .all(tree.id);
  tree.history = db
    .prepare('SELECT * FROM edit_history WHERE weekly_report_id=? ORDER BY created_at DESC LIMIT 100')
    .all(tree.id);
  res.json(tree);
});

r.patch('/:id', (req, res) => {
  const rep = db.prepare('SELECT * FROM weekly_reports WHERE id=?').get(req.params.id);
  if (!rep) return res.status(404).json({ error: 'not found' });
  const { title, period_label, highlights_html, theme } = req.body || {};
  const nextTheme = theme !== undefined ? getTheme(theme).key : rep.theme;
  db.prepare('UPDATE weekly_reports SET title=?, period_label=?, highlights_html=?, theme=?, updated_at=? WHERE id=?')
    .run(title ?? rep.title, period_label ?? rep.period_label, highlights_html ?? rep.highlights_html, nextTheme, new Date().toISOString(), rep.id);
  logHistory({ weekly_report_id: rep.id, field: 'report', action: 'update', operator_id: req.user.uid, summary: '更新标题/周期' });
  res.json(getReportTree(rep.id));
});

r.post('/:id/publish', requireAdmin, (req, res) => {
  const rep = db.prepare('SELECT * FROM weekly_reports WHERE id=?').get(req.params.id);
  if (!rep) return res.status(404).json({ error: 'not found' });
  const to = req.body?.to;
  const allowed = { draft: 'collecting', collecting: 'published' };
  if (!allowed[rep.status] || allowed[rep.status] !== to) {
    return res.status(400).json({ error: 'invalid transition' });
  }
  const now = new Date().toISOString();
  const published = to === 'published' ? now : rep.published_at;
  db.prepare('UPDATE weekly_reports SET status=?, published_at=?, updated_at=? WHERE id=?')
    .run(to, published, now, rep.id);
  logHistory({ weekly_report_id: rep.id, field: 'report', action: `publish:${to}`, operator_id: req.user.uid, summary: `状态→${to}` });
  res.json(getReportTree(rep.id));
});

r.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM weekly_reports WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

r.post('/:id/copy-last', (req, res) => {
  const src = getReportTree(req.params.id);
  if (!src) return res.status(404).json({ error: 'not found' });
  const now = new Date().toISOString();
  const label = req.body?.period_label || src.period_label;
  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO weekly_reports (period_label,title,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?)')
      .run(label, req.body?.title || `${src.title || src.period_label}（副本）`, 'draft', req.user.uid, now, now);
    const rid = info.lastInsertRowid;
    const insDep = db.prepare('INSERT INTO departments (weekly_report_id,name,sort_order,is_default) VALUES (?,?,?,?)');
    const insWI = db.prepare('INSERT INTO work_items (department_id,title,progress_html,plan_html,status,sort_order,updated_at) VALUES (?,?,?,?,?,?,?)');
    for (const dep of src.departments) {
      const di = insDep.run(rid, dep.name, dep.sort_order, dep.is_default);
      for (const wi of dep.work_items) {
        insWI.run(di.lastInsertRowid, wi.title, wi.progress_html, wi.plan_html, 'stale', wi.sort_order, now);
      }
    }
    return rid;
  });
  const rid = tx();
  logHistory({ weekly_report_id: rid, field: 'report', action: 'copy', operator_id: req.user.uid, summary: `从 ${src.period_label} 复制` });
  res.json(getReportTree(rid));
});

r.post('/:id/departments', (req, res) => {
  const rep = db.prepare('SELECT id FROM weekly_reports WHERE id=?').get(req.params.id);
  if (!rep) return res.status(404).json({ error: 'not found' });
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'missing name' });
  const max = db.prepare('SELECT COALESCE(MAX(sort_order),-1) m FROM departments WHERE weekly_report_id=?').get(rep.id).m;
  const di = db.prepare('INSERT INTO departments (weekly_report_id,name,sort_order,is_default) VALUES (?,?,?,0)').run(rep.id, name, max + 1);
  logHistory({ weekly_report_id: rep.id, field: 'department', action: 'create', operator_id: req.user.uid, summary: `新增部门 ${name}` });
  res.json({ id: di.lastInsertRowid });
});

r.patch('/departments/:did', (req, res) => {
  const dep = db.prepare('SELECT * FROM departments WHERE id=?').get(req.params.did);
  if (!dep) return res.status(404).json({ error: 'not found' });
  const { name, core_html } = req.body || {};
  db.prepare('UPDATE departments SET name=?, core_html=? WHERE id=?')
    .run(name ?? dep.name, core_html ?? dep.core_html, dep.id);
  if (core_html !== undefined) {
    logHistory({ weekly_report_id: dep.weekly_report_id, field: 'department', action: 'update', operator_id: req.user.uid, summary: `编辑「${dep.name}」核心进展` });
  }
  res.json({ ok: true });
});

r.delete('/:id/departments/:did', requireAdmin, (req, res) => {
  const d = db.prepare('SELECT name FROM departments WHERE id=?').get(req.params.did);
  db.prepare('DELETE FROM departments WHERE id=? AND weekly_report_id=?').run(req.params.did, req.params.id);
  logHistory({ weekly_report_id: Number(req.params.id), field: 'department', action: 'delete', operator_id: req.user.uid, summary: `删除部门 ${d?.name || ''}` });
  res.json({ ok: true });
});

r.post('/departments/:did/work-items', (req, res) => {
  const dep = db.prepare('SELECT * FROM departments WHERE id=?').get(req.params.did);
  if (!dep) return res.status(404).json({ error: 'not found' });
  const { title } = req.body || {};
  const now = new Date().toISOString();
  const max = db.prepare('SELECT COALESCE(MAX(sort_order),-1) m FROM work_items WHERE department_id=?').get(dep.id).m;
  const wi = db.prepare('INSERT INTO work_items (department_id,title,status,sort_order,updated_at) VALUES (?,?,?,?,?)')
    .run(dep.id, title || '', 'blank', max + 1, now);
  logHistory({ weekly_report_id: dep.weekly_report_id, work_item_id: wi.lastInsertRowid, field: 'work_item', action: 'create', operator_id: req.user.uid, summary: `新增工作项「${title || ''}」` });
  res.json({ id: wi.lastInsertRowid });
});

r.patch('/work-items/:wid', (req, res) => {
  const wi = db.prepare('SELECT * FROM work_items WHERE id=?').get(req.params.wid);
  if (!wi) return res.status(404).json({ error: 'not found' });
  const { title, progress_html, plan_html, status } = req.body || {};
  const hasStatus = status !== undefined;
  let ns = hasStatus ? status : wi.status;
  // Auto-advance: editing 本周进展 with no explicit status pushes blank/stale -> done.
  if (progress_html !== undefined && !hasStatus && (ns === 'blank' || ns === 'stale')) ns = 'done';
  db.prepare('UPDATE work_items SET title=?, progress_html=?, plan_html=?, status=?, updated_at=? WHERE id=?')
    .run(title ?? wi.title, progress_html ?? wi.progress_html, plan_html ?? wi.plan_html, ns, new Date().toISOString(), wi.id);
  const wid = db.prepare('SELECT weekly_report_id FROM departments WHERE id=?').get(wi.department_id).weekly_report_id;
  // 细化到具体工作项 + 变更字段
  const newTitle = title ?? wi.title;
  const changes = [];
  if (title !== undefined && title !== wi.title) changes.push(`标题→${newTitle || '(空)'}`);
  if (ns !== wi.status) changes.push(`状态→${ns}`);
  if (progress_html !== undefined && progress_html !== wi.progress_html) changes.push('编辑本周进展');
  if (plan_html !== undefined && plan_html !== wi.plan_html) changes.push('编辑下周计划');
  const detail = changes.length ? `（${changes.join('，')}）` : '';
  logHistory({ weekly_report_id: wid, work_item_id: wi.id, field: 'work_item', action: 'update', operator_id: req.user.uid, summary: `更新工作项「${newTitle}」${detail}` });
  res.json(db.prepare('SELECT * FROM work_items WHERE id=?').get(wi.id));
});

r.delete('/work-items/:wid', requireAdmin, (req, res) => {
  const wi = db.prepare('SELECT w.id, w.title, d.weekly_report_id FROM work_items w JOIN departments d ON w.department_id=d.id WHERE w.id=?').get(req.params.wid);
  db.prepare('DELETE FROM work_items WHERE id=?').run(req.params.wid);
  if (wi) logHistory({ weekly_report_id: wi.weekly_report_id, work_item_id: wi.id, field: 'work_item', action: 'delete', operator_id: req.user.uid, summary: `删除工作项「${wi.title || ''}」` });
  res.json({ ok: true });
});

// 关键专项进展：多条，每条一个可编辑框（标题 + 富文本）
r.post('/:id/special-progress', (req, res) => {
  const rep = db.prepare('SELECT id FROM weekly_reports WHERE id=?').get(req.params.id);
  if (!rep) return res.status(404).json({ error: 'not found' });
  const { title, content_html } = req.body || {};
  const now = new Date().toISOString();
  const max = db.prepare('SELECT COALESCE(MAX(sort_order),-1) m FROM special_progress WHERE weekly_report_id=?').get(rep.id).m;
  const si = db.prepare('INSERT INTO special_progress (weekly_report_id,title,content_html,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?)')
    .run(rep.id, title || '', content_html || '', max + 1, now, now);
  logHistory({ weekly_report_id: rep.id, field: 'special_progress', action: 'create', operator_id: req.user.uid, summary: `新增专项进展 ${title || ''}` });
  res.json({ id: si.lastInsertRowid });
});

r.patch('/:id/special-progress/:sid', (req, res) => {
  const sp = db.prepare('SELECT * FROM special_progress WHERE id=?').get(req.params.sid);
  if (!sp) return res.status(404).json({ error: 'not found' });
  const { title, content_html, sort_order } = req.body || {};
  db.prepare('UPDATE special_progress SET title=?, content_html=?, sort_order=?, updated_at=? WHERE id=?')
    .run(title ?? sp.title, content_html ?? sp.content_html, sort_order ?? sp.sort_order, new Date().toISOString(), sp.id);
  logHistory({ weekly_report_id: sp.weekly_report_id, field: 'special_progress', action: 'update', operator_id: req.user.uid, summary: `编辑专项「${sp.title}」` });
  res.json({ ok: true });
});

r.delete('/:id/special-progress/:sid', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM special_progress WHERE id=? AND weekly_report_id=?').run(req.params.sid, req.params.id);
  res.json({ ok: true });
});

export default r;
