import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:8000';
const outDir = 'C:/Users/Dong/weekly-report-platform/docs';
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('button[type="submit"]');
await page.waitForSelector('.theme-pick', { timeout: 8000 }).catch(() => log('theme-pick not found'));

const optCount = await page.locator('.theme-pick select option').count().catch(() => 0);
const opts = await page.locator('.theme-pick select option').allInnerTexts().catch(() => []);
log('theme select option count:', optCount, JSON.stringify(opts));

let downloadOk = false;
if (optCount >= 5) {
  await page.locator('.theme-pick select').selectOption('mint');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    page.locator('.icon-btn[title="导出 HTML"]').first().click()
  ]);
  if (download) {
    const path = `${outDir}/ui-export-mint.html`;
    await download.saveAs(path);
    const txt = fs.readFileSync(path, 'utf8');
    downloadOk = txt.includes('--accent:#0f6e56');
    log(`[${downloadOk ? 'PASS' : 'FAIL'}] UI export theme=mint carries accent #0f6e56`);
  } else {
    log('[FAIL] no download event captured');
  }
}

await browser.close();
const ok = optCount === 5 && downloadOk && errors.length === 0;
log('console errors:', errors.length ? JSON.stringify(errors) : 'none');
log(ok ? '\nUI THEME CHECK PASSED' : '\nUI THEME CHECK INCOMPLETE');
process.exit(ok ? 0 : 1);
