import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
const log = (...a) => console.log(...a);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('button.primary');
await page.waitForSelector('.report-row', { timeout: 8000 });

// 打开第一个周报
await page.locator('button.primary', { hasText: '打开' }).first().click();
await page.waitForSelector('.dep', { timeout: 10000 });
await page.waitForTimeout(900);

// 在"本周进展"里输入文字，触发 dirty
await page.locator('.rte-content').first().click();
await page.keyboard.type('toast-测试');
await page.waitForTimeout(200);

// 点击该富文本框的"保存"按钮
await page.locator('.rte-bar button', { hasText: '保存' }).first().click();

// 等待成功弹窗出现并截图
await page.waitForSelector('.toast.ok', { timeout: 5000 });
const toastMsg = await page.locator('.toast.ok').innerText();
log('TOAST OK msg =', JSON.stringify(toastMsg));
await page.locator('.toast.ok').screenshot({ path: 'C:/Users/Dong/weekly-report-platform/docs/verify-toast.png' });

// 再测一次状态变更的弹窗：把第一个工作项状态改成"已更新"
await page.locator('.status-select').first().selectOption('done');
await page.waitForSelector('.toast.ok', { timeout: 5000 });
const toastMsg2 = await page.locator('.toast.ok').last().innerText();
log('TOAST status msg =', JSON.stringify(toastMsg2));

// 清理：把第一个工作项进度清空，避免污染数据
const TOKEN = await page.evaluate(() => localStorage.getItem('token') || '');
const wid = await page.evaluate(async () => {
  const rows = document.querySelectorAll('.wi');
  return null; // 占位，下面用 API 取
});
const rep = await (await fetch(`${BASE}/api/weekly-reports/1`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
const firstWI = rep.departments.flatMap((d) => d.work_items)[0];
if (firstWI) {
  await fetch(`${BASE}/api/weekly-reports/work-items/${firstWI.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress_html: '', plan_html: '', status: 'blank' })
  });
  log('CLEANED work_item', firstWI.id);
}

await browser.close();
log('DONE');
