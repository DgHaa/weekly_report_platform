import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:8000';
const out = 'docs/editor-theme-preview.png';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('button:has-text("登")');
await page.waitForSelector('.report-row', { timeout: 10000 });

// 打开第一份报告
await page.click('.report-row .primary');
await page.waitForSelector('.topbar', { timeout: 10000 });

// 切到预览
await page.click('button:has-text("预览")');
await page.waitForSelector('.theme-preview-wrap', { timeout: 10000 });
await page.waitForTimeout(600);

const readAccent = () => page.evaluate(() => {
  const el = document.querySelector('.theme-preview');
  return el ? getComputedStyle(el).getPropertyValue('--accent').trim() : null;
});
const hasAnchor = () => page.evaluate(() => !!document.getElementById('sec-core') && !!document.getElementById('sec-highlights'));

const accentClassic = await readAccent();
const anchorOk = await hasAnchor();
await page.screenshot({ path: out, fullPage: true });
console.log('classic accent:', accentClassic, '| sec anchors present:', anchorOk);

// 切换到「清新青绿」(mint)
await page.selectOption('.theme-pick select', 'mint');
// 等待预览重新注入且配色变化
await page.waitForFunction(() => {
  const el = document.querySelector('.theme-preview');
  const a = el ? getComputedStyle(el).getPropertyValue('--accent').trim() : '';
  return a === '#0f6e56';
}, { timeout: 10000 });
const accentMint = await readAccent();
const selectVal = await page.evaluate(() => document.querySelector('.theme-pick select').value);
await page.screenshot({ path: 'docs/editor-theme-mint.png', fullPage: true });
console.log('mint accent:', accentMint, '| select value:', selectVal);

// 再切到「打印单色」验证
await page.selectOption('.theme-pick select', 'print');
await page.waitForFunction(() => {
  const el = document.querySelector('.theme-preview');
  const a = el ? getComputedStyle(el).getPropertyValue('--accent').trim() : '';
  return a === '#222222';
}, { timeout: 10000 });
const accentPrint = await readAccent();
console.log('print accent:', accentPrint);

await browser.close();
const ok = accentClassic === '#26215c' && anchorOk && accentMint === '#0f6e56' && selectVal === 'mint' && accentPrint === '#222222' && errors.length === 0;
console.log('console errors:', errors.length ? errors : 'none');
console.log(ok ? 'ALL UI CHECKS PASS' : 'SOME UI CHECKS FAILED');
process.exit(ok ? 0 : 1);
