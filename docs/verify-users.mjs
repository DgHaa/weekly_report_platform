import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 自动接受 confirm 弹窗（删除用户时会触发）
page.on('dialog', (d) => d.accept());

const log = (...a) => console.log(...a);

// 登录 admin
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('button[type=submit]');
await page.waitForSelector('button:has-text("用户管理")', { timeout: 10000 });

// 打开用户管理
await page.click('button:has-text("用户管理")');
await page.waitForSelector('.user-modal', { timeout: 8000 });
log('MODAL 打开成功');

// 创建用户
const TS = 'u_' + Date.now();
await page.fill('.um-grid input[placeholder="如 zhangsan"]', TS);
await page.fill('.um-grid input[placeholder="如 张三"]', '验证用户');
await page.fill('.um-grid input[type=password]', 'test123');
await page.click('button:has-text("创建用户")');
await page.waitForTimeout(800);
const created = await page.locator('.um-table', { hasText: TS }).count();
log('创建后表格含新用户=', created > 0);

// 新用户能否登录（curl）
const TOKEN = await page.evaluate(() => localStorage.getItem('wr_token'));
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: TS, password: 'test123' })
}).then((r) => r.json());
log('新用户登录=', login.token ? '成功' : '失败: ' + login.error);

// 删除该用户
await page.locator('.um-table tr', { hasText: TS }).locator('button[aria-label="删除用户"]').click();
await page.waitForTimeout(800);
const afterDel = await page.locator('.um-table', { hasText: TS }).count();
log('删除后表格含该用户=', afterDel > 0, '(应为 false)');

await page.screenshot({ path: 'C:/Users/Dong/weekly-report-platform/docs/verify-users.png' });
await browser.close();
log('DONE');
