import { chromium } from 'playwright';

const BASE = 'http://localhost:8020';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: 'docs/beauty-login.png' });
console.log('login screenshot ok');

// 登录
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('button.primary');
await page.waitForSelector('.report-grid, .empty', { timeout: 8000 });
await page.waitForTimeout(600);
await page.screenshot({ path: 'docs/beauty-list.png' });
console.log('list screenshot ok');

// 进入第一个周报编辑器
const openBtn = page.locator('button.primary', { hasText: '打开' }).first();
await openBtn.click();
await page.waitForSelector('.dep', { timeout: 10000 });
await page.waitForTimeout(800);
await page.screenshot({ path: 'docs/beauty-editor.png', fullPage: true });
console.log('editor screenshot ok');

await browser.close();
console.log('done');
