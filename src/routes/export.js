import { Router } from 'express';
import { authMiddleware } from '../middleware.js';
import { getReportTree } from '../util.js';
import { buildStandaloneHtml } from '../export/html.js';
import { buildEml } from '../export/eml.js';
import { htmlToPdf } from '../export/pdf.js';
import { getTheme } from '../export/themes.js';

const r = Router();
r.use(authMiddleware);

r.get('/:id/export/html', (req, res) => {
  const tree = getReportTree(req.params.id);
  if (!tree) return res.status(404).json({ error: 'not found' });
  const html = buildStandaloneHtml(tree, getTheme(req.query.theme || tree.theme).key);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${tree.period_label}.html"`);
  res.send(html);
});

// 预览用：返回内联 HTML（无附件头），供前端注入编辑器预览区即时查看风格
r.get('/:id/export/preview-html', (req, res) => {
  const tree = getReportTree(req.params.id);
  if (!tree) return res.status(404).json({ error: 'not found' });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(buildStandaloneHtml(tree, getTheme(req.query.theme || tree.theme).key));
});

r.get('/:id/export/pdf', async (req, res) => {
  try {
    const tree = getReportTree(req.params.id);
    if (!tree) return res.status(404).json({ error: 'not found' });
    const buf = await htmlToPdf(buildStandaloneHtml(tree, getTheme(req.query.theme || tree.theme).key));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${tree.period_label}.pdf"`);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: 'pdf failed: ' + (e.message || e), hint: 'run: npx playwright install chromium' });
  }
});

r.get('/:id/export/eml', (req, res) => {
  const tree = getReportTree(req.params.id);
  if (!tree) return res.status(404).json({ error: 'not found' });
  const eml = buildEml(tree, req.query.to, getTheme(req.query.theme || tree.theme).key);
  res.setHeader('Content-Type', 'message/rfc822');
  res.setHeader('Content-Disposition', `attachment; filename="${tree.period_label}.eml"`);
  res.send(eml);
});

export default r;
