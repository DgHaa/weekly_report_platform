import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });

// 登录
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('button[type=submit]');
await page.waitForSelector('button:has-text("打开")', { timeout: 10000 });

// 进入第一个周报（点"打开"按钮）
await page.locator('button:has-text("打开")').first().click();
await page.waitForSelector('.edit-module', { timeout: 8000 });

// 收集编辑模式下所有版块标题，按 DOM 顺序
const titles = await page.$$eval('.edit-module .module-title', (els) =>
  els.map((e) => e.textContent.replace(/\s+/g, ' ').trim())
);
console.log('EDIT 版块顺序=', JSON.stringify(titles, null, 0));

await browser.close();
