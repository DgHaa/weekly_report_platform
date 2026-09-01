import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:8000';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));

// 登录
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('.login-card button.primary');
await page.waitForSelector('.report-row', { timeout: 10000 });
await page.waitForTimeout(800);

// 打开第一份周报
await page.click('.report-row .primary');
await page.waitForSelector('.editor-toc', { timeout: 10000 });
await page.waitForTimeout(800);

const beforeCount = await page.locator('.sp').count();
const beforeToc = await page.locator('.editor-toc .toc-link.toc-sub').count();

// 添加两个专项进展（prompt 弹窗填标题）
page.once('dialog', (d) => d.accept('专项一：服务渠道整合'));
await page.click('button:has-text("专项进展")');
await page.waitForTimeout(900);
page.once('dialog', (d) => d.accept('专项二：AI 辅助录单'));
await page.click('button:has-text("专项进展")');
await page.waitForTimeout(900);

const afterCount = await page.locator('.sp').count();
const afterToc = await page.locator('.editor-toc .toc-link.toc-sub').count();

// 校验目录子项锚点存在
const anchorInfo = await page.evaluate(() => {
  const subs = Array.from(document.querySelectorAll('.editor-toc .toc-link.toc-sub'));
  return subs.map((a) => {
    const id = (a.getAttribute('href') || '').replace('#', '');
    return { id, exist: !!document.getElementById(id) };
  });
});
const allAnchors = anchorInfo.every((x) => x.exist);

// 点击第一个专项目录项，验证定位
const yBefore = await page.evaluate(() => window.scrollY);
await page.locator('.editor-toc .toc-link.toc-sub').first().click();
await page.waitForTimeout(900);
const yAfter = await page.evaluate(() => window.scrollY);
const activeText = await page.locator('.editor-toc .toc-link.active').first().innerText().catch(() => '(none)');
writeFileSync('C:/Users/Dong/weekly-report-platform/docs/sp-edit.png', await page.screenshot());

// 测试上移/下移
const moveBtns = page.locator('.sp-actions button.ghost');
const moveBefore = await page.evaluate(() => Array.from(document.querySelectorAll('.sp .sp-title')).map((e) => e.value));
// 把第二个上移
await page.locator('.sp').nth(1).locator('.sp-actions button.ghost').first().click();
await page.waitForTimeout(800);
const moveAfter = await page.evaluate(() => Array.from(document.querySelectorAll('.sp .sp-title')).map((e) => e.value));

// 预览模式
await page.click('button:has-text("预览")');
await page.waitForTimeout(900);
const previewSp = await page.locator('.preview-sp').count();
writeFileSync('C:/Users/Dong/weekly-report-platform/docs/sp-preview.png', await page.screenshot());
await page.click('button:has-text("编辑")');
await page.waitForTimeout(400);

// 删除第一个专项（confirm）
page.once('dialog', (d) => d.accept());
await page.locator('.sp').first().locator('button.danger').click();
await page.waitForTimeout(900);
const finalCount = await page.locator('.sp').count();

console.log(JSON.stringify({
  ok: afterCount === beforeCount + 2 && afterToc === beforeToc + 2 && allAnchors && yAfter > yBefore && previewSp === 2 && finalCount === 1,
  beforeCount, afterCount, beforeToc, afterToc,
  allAnchors, anchorInfo,
  scrolledDown: yAfter > yBefore, yBefore, yAfter, activeText,
  moveBefore, moveAfter,
  previewSp, finalCount,
  consoleErrors: errors.slice(0, 5),
}, null, 2));

await browser.close();
