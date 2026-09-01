import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('button.primary');
await page.waitForSelector('.report-row .primary', { timeout: 10000 });
await page.locator('.report-row .primary').first().click();
await page.waitForSelector('.dep', { timeout: 10000 });
await page.waitForTimeout(1500);
await page.getByText('预览').click();
await page.waitForSelector('.preview-module', { timeout: 8000 });
await page.waitForTimeout(800);

const order = await page.evaluate(() =>
  [...document.querySelectorAll('.preview-module .module-title')].map((e) => e.textContent.trim())
);
console.log('预览版块顺序:', JSON.stringify(order));

await page.locator('.preview-report').screenshot({ path: 'C:/Users/Dong/weekly-report-platform/docs/verify-preview-order.png', fullPage: true });
await browser.close();
