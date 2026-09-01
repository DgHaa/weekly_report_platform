import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:8000';
const OUT = 'C:/Users/Dong/weekly-report-platform/docs/toc-verify.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });

// 登录
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('.login-card button.primary');
await page.waitForSelector('.report-row', { timeout: 10000 });

// 打开第一份周报
await page.click('.report-row .primary');
await page.waitForTimeout(3500);
writeFileSync('C:/Users/Dong/weekly-report-platform/docs/toc-debug.png', await page.screenshot());
const diag = await page.evaluate(() => ({
  editorToc: document.querySelectorAll('.editor-toc').length,
  editModule: document.querySelectorAll('.edit-module').length,
  previewModule: document.querySelectorAll('.preview-module').length,
  topbar: document.querySelectorAll('.topbar').length,
  container: document.querySelectorAll('.container').length,
  bodyLen: document.body.innerText.length,
  bodyHead: document.body.innerText.slice(0, 160),
}));
console.log('DIAG', JSON.stringify(diag, null, 2));
console.log('ERRORS', JSON.stringify(errors.slice(0, 8), null, 2));
if (diag.editorToc === 0) { await browser.close(); process.exit(0); }
await page.waitForSelector('.editor-toc', { timeout: 8000 });

// 临时填充关键专项进展为多块（验证目录拆分，结束恢复）
const reportInfo = await page.evaluate(async () => {
  const token = localStorage.getItem('wr_token');
  const list = await (await fetch('/api/weekly-reports', { headers: { Authorization: 'Bearer ' + token } })).json();
  const id = Array.isArray(list) ? list[0].id : list.id;
  const multi = '<h3>专项一：服务渠道整合</h3><h3>专项二：AI 辅助录单上线</h3><p>专项三：VOC 平台升级，提升客诉处理时效。</p>';
  const r = await fetch('/api/weekly-reports/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ highlights_html: multi }) });
  return { id, status: r.status };
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.report-row', { timeout: 8000 });
await page.click('.report-row .primary');
await page.waitForSelector('.editor-toc', { timeout: 8000 });
await page.waitForTimeout(2500);

// 顶部截图（编辑模式）
writeFileSync('C:/Users/Dong/weekly-report-platform/docs/toc-top.png', await page.screenshot());
// 切换到预览模式截图
await page.click('button:has-text("预览")');
await page.waitForTimeout(800);
writeFileSync('C:/Users/Dong/weekly-report-platform/docs/toc-preview.png', await page.screenshot());
await page.click('button:has-text("编辑")');
await page.waitForTimeout(500);

const tocCount = await page.locator('.editor-toc .toc-link').count();
const subCount = await page.locator('.editor-toc .toc-link.toc-sub').count();
const hasCore = await page.locator('#sec-core').count();
const hasHighlights = await page.locator('#sec-highlights').count();

// 校验每个工作项子目录都对应一个存在的锚点
const subCheck = await page.evaluate(() => {
  const subs = Array.from(document.querySelectorAll('.editor-toc .toc-link.toc-sub'));
  return subs.map((a) => {
    const href = a.getAttribute('href') || '';
    const id = href.replace('#', '');
    return { id, exist: !!document.getElementById(id) };
  });
});
const allAnchorsExist = subCheck.every((s) => s.exist);

// 关键专项进展子项（sec-high-*）也应存在锚点
const highCheck = await page.evaluate(() => {
  const subs = Array.from(document.querySelectorAll('.editor-toc .toc-link.toc-sub'));
  const high = subs.filter((a) => (a.getAttribute('href') || '').includes('sec-high-'));
  return high.map((a) => {
    const id = (a.getAttribute('href') || '').replace('#', '');
    return { id, exist: !!document.getElementById(id), label: a.innerText };
  });
});
const highAnchorsExist = highCheck.every((h) => h.exist);

// 点击一个关键专项进展子目录，验证滚动定位
const links = page.locator('.editor-toc .toc-link');
const highIdx = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('.editor-toc .toc-link'));
  return all.findIndex((a) => (a.getAttribute('href') || '').includes('sec-high-'));
});
const yBefore = await page.evaluate(() => window.scrollY);
if (highIdx >= 0) {
  await links.nth(highIdx).click();
  await page.waitForTimeout(900);
}
const yAfter = await page.evaluate(() => window.scrollY);
const activeText = await page.locator('.editor-toc .toc-link.active').first().innerText().catch(() => '(none)');

writeFileSync(OUT, await page.screenshot());

// 切换预览模式，再数一次子目录，并验证关键专项进展锚点与定位
await page.click('button:has-text("预览")');
await page.waitForTimeout(1200);
const subCountPreview = await page.locator('.editor-toc .toc-link.toc-sub').count();
const highPreview = await page.evaluate(() => {
  const subs = Array.from(document.querySelectorAll('.editor-toc .toc-link.toc-sub'));
  return subs.filter((a) => (a.getAttribute('href') || '').includes('sec-high-')).length;
});
const previewHighAnchors = await page.evaluate(() => {
  const subs = Array.from(document.querySelectorAll('.editor-toc .toc-link.toc-sub'));
  const high = subs.filter((a) => (a.getAttribute('href') || '').includes('sec-high-'));
  return high.map((a) => { const id = (a.getAttribute('href') || '').replace('#', ''); return { id, exist: !!document.getElementById(id) }; });
});
const previewHighExist = previewHighAnchors.every((h) => h.exist);
const highIdx2 = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('.editor-toc .toc-link'));
  return all.findIndex((a) => (a.getAttribute('href') || '').includes('sec-high-'));
});
const yB2 = await page.evaluate(() => window.scrollY);
if (highIdx2 >= 0) { await page.locator('.editor-toc .toc-link').nth(highIdx2).click(); await page.waitForTimeout(900); }
const yA2 = await page.evaluate(() => window.scrollY);
writeFileSync('C:/Users/Dong/weekly-report-platform/docs/toc-preview.png', await page.screenshot());
await page.click('button:has-text("编辑")');
await page.waitForTimeout(500);

console.log(JSON.stringify({
  ok: tocCount >= 3 && hasCore === 1 && hasHighlights === 1 && subCount > 0 && highCheck.length > 0 && previewHighExist && (yA2 > yB2),
  tocCount,
  subCount,
  subCountPreview,
  highSubCount: highCheck.length,
  highSubCountPreview: highPreview,
  hasCore,
  hasHighlights,
  highLabels: highCheck.map((h) => h.label),
  allAnchorsExist,
  highAnchorsExist,
  previewHighExist,
  previewScroll: yA2 > yB2,
  yB2, yA2,
  scrolledDown: yAfter > yBefore,
  yBefore, yAfter,
  activeText,
  consoleErrors: errors.slice(0, 5),
}, null, 2));

// 恢复关键专项进展（清空临时填充）
await page.evaluate(async (id) => {
  const token = localStorage.getItem('wr_token');
  await fetch('/api/weekly-reports/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ highlights_html: '' }) });
}, reportInfo.id).catch(() => {});

await browser.close();
