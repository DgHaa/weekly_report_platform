import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('button.primary');
await page.waitForSelector('.report-list, .empty', { timeout: 8000 });
await page.waitForTimeout(600);
await page.screenshot({ path: 'docs/verify-list.png' });
console.log('list screenshot ok');

await browser.close();
