import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 登录
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('button[type=submit]');
await page.waitForSelector('button:has-text("用户管理")', { timeout: 10000 });

// 打开用户管理
await page.locator('button:has-text("用户管理")').click();
await page.waitForSelector('.modal:has-text("新增用户")', { timeout: 5000 });

await page.screenshot({ path: 'C:/Users/Dong/weekly-report-platform/docs/verify-usermgmt.png', fullPage: false });
console.log('screenshot saved');

await browser.close();
