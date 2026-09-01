import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware.js';
import { logHistory, getReportTree, buildSnapshot } from '../util.js';

const r = Router();
r.use(authMiddleware);

r.get('/:id/versions', (req, res) => {
  res.json(
    db.prepare('SELECT id,version_no,created_at,note,operator_id FROM version_snapshots WHERE weekly_report_id=? ORDER BY version_no DESC')
      .all(req.params.id)
  );
});

r.post('/:id/versions', (req, res) => {
  const tree = getReportTree(req.params.id);
  if (!tree) return res.status(404).json({ error: 'not found' });
  const cnt = db.prepare('SELECT COALESCE(MAX(version_no),0) m FROM version_snapshots WHERE weekly_report_id=?').get(tree.id).m;
  const note = req.body?.note || '';
  const info = db
    .prepare('INSERT INTO version_snapshots (weekly_report_id,version_no,snapshot_json,note,operator_id,created_at) VALUES (?,?,?,?,?,?)')
    .run(tree.id, cnt + 1, buildSnapshot(tree), note, req.user.uid, new Date().toISOString());
  logHistory({ weekly_report_id: tree.id, field: 'version', action: 'save', operator_id: req.user.uid, summary: `保存版本 v${cnt + 1}` });
  res.json({ id: info.lastInsertRowid, version_no: cnt + 1 });
});

r.post('/:id/versions/compare', (req, res) => {
  const { a, b } = req.body || {};
  const va = db.prepare('SELECT * FROM version_snapshots WHERE id=? AND weekly_report_id=?').get(a, req.params.id);
  const vb = db.prepare('SELECT * FROM version_snapshots WHERE id=? AND weekly_report_id=?').get(b, req.params.id);
  if (!va || !vb) return res.status(404).json({ error: 'not found' });
  const A = JSON.parse(va.snapshot_json);
  const B = JSON.parse(vb.snapshot_json);
  const diffs = [];
  const aByName = new Map(A.departments.map((d) => [d.name, d]));
  for (const dB of B.departments) {
    const dA = aByName.get(dB.name);
    const aWI = dA ? dA.work_items : [];
    dB.work_items.forEach((wB, i) => {
      const wA = aWI[i] || null;
      for (const f of ['title', 'progress_html', 'plan_html', 'status']) {
        const from = wA ? wA[f] : null;
        if (from !== wB[f]) diffs.push({ department: dB.name, work_item: wB.title, field: f, from, to: wB[f] });
      }
    });
  }
  res.json({ diffs, a: { version_no: va.version_no }, b: { version_no: vb.version_no } });
});

r.post('/:id/versions/:vid/restore', (req, res) => {
  const v = db.prepare('SELECT * FROM version_snapshots WHERE id=? AND weekly_report_id=?').get(req.params.vid, req.params.id);
  if (!v) return res.status(404).json({ error: 'not found' });
  const snap = JSON.parse(v.snapshot_json);
  const tx = db.transaction(() => {
    for (const d of db.prepare('SELECT id FROM departments WHERE weekly_report_id=?').all(req.params.id)) {
      db.prepare('DELETE FROM work_items WHERE department_id=?').run(d.id);
    }
    db.prepare('DELETE FROM departments WHERE weekly_report_id=?').run(req.params.id);
    const insDep = db.prepare('INSERT INTO departments (weekly_report_id,name,sort_order,is_default) VALUES (?,?,?,?)');
    const insWI = db.prepare('INSERT INTO work_items (department_id,title,progress_html,plan_html,status,sort_order,updated_at) VALUES (?,?,?,?,?,?,?)');
    snap.departments.forEach((d, i) => {
      const di = insDep.run(req.params.id, d.name, i, 0);
      d.work_items.forEach((w, j) => insWI.run(di.lastInsertRowid, w.title, w.progress_html, w.plan_html, w.status, j, new Date().toISOString()));
    });
  });
  tx();
  logHistory({ weekly_report_id: req.params.id, field: 'version', action: 'restore', operator_id: req.user.uid, summary: `恢复版本 v${v.version_no}` });
  res.json(getReportTree(req.params.id));
});

export default r;
