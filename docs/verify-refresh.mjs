import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));

await page.goto('http://localhost:8000/', { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('.login-card button.primary');
await page.waitForSelector('.report-row', { timeout: 10000 });
await page.waitForTimeout(600);

// 打开第一份周报
await page.click('.report-row .primary');
await page.waitForSelector('#sec-core', { timeout: 10000 });
const url1 = page.url();
const hasReportParam1 = url1.includes('?report=');

// 模拟刷新
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#sec-core', { timeout: 10000 });
const url2 = page.url();
const hasReportParam2 = url2.includes('?report=');
const stillEditor = await page.locator('#sec-core').count() === 1;
const localReportId = await page.evaluate(() => localStorage.getItem('wr_last_report_id'));

// 返回列表，确认 URL 清掉 report
await page.click('button:has-text("返回")');
await page.waitForSelector('.report-list', { timeout: 10000 });
await page.waitForTimeout(500);
const url3 = page.url();
const noReportParam = !url3.includes('?report=');
const localCleared = await page.evaluate(() => localStorage.getItem('wr_last_report_id')) === null;

console.log(JSON.stringify({
  ok: hasReportParam1 && hasReportParam2 && stillEditor && noReportParam && localCleared,
  url1, url2, url3,
  hasReportParam1, hasReportParam2, stillEditor, noReportParam, localCleared,
  localReportId,
  consoleErrors: errors.slice(0, 5),
}, null, 2));

await browser.close();
