import { chromium } from 'playwright';
import fs from 'node:fs';

const COOKIE = '/tmp/cj-order.json';
const BASE = 'http://localhost:8000';

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

// 登录
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('button.primary');
await page.waitForSelector('.report-row, .report-card, a[href*="/reports/"]', { timeout: 10000 });

// 进入第一个周报（点击「打开」按钮）
await page.locator('.report-row .primary').first().click();
await page.waitForSelector('.dep', { timeout: 10000 });
await page.waitForTimeout(1500); // 等协作客户端初始化

// 收集编辑区各 section 的出现顺序（按文档顺序）
const order = await page.evaluate(() => {
  const titles = [...document.querySelectorAll('.edit-module .module-title, .dep .dep-head h3')].map((el) => el.textContent.trim());
  // 关键专项进展卡片的 module-title
  const highlights = document.querySelector('.edit-module .module-title');
  const firstDep = document.querySelector('.dep .dep-head h3');
  const hs = highlights ? highlights.textContent.trim() : null;
  const fd = firstDep ? firstDep.textContent.trim() : null;
  return { order: titles, highlightsFirst: highlights ? highlights.getBoundingClientRect().top : null, firstDepTop: firstDep ? firstDep.getBoundingClientRect().top : null, hs, fd };
});

const ok = order.firstDepTop !== null && order.highlightsFirst !== null && order.firstDepTop < order.highlightsFirst;
console.log('编辑区顺序片段:', JSON.stringify(order.order.slice(0, 6)));
console.log('首个部门核心进展 top=', Math.round(order.firstDepTop), '| 关键专项进展 top=', Math.round(order.highlightsFirst));
console.log('RESULT 核心进展在关键专项之前 =', ok);
await browser.close();
process.exit(ok ? 0 : 2);
