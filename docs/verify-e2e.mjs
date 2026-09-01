import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:8000';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync('C:/Users/Dong/weekly-report-platform/docs/test.png', png);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
page.on('console', (msg) => {
  const t = msg.text();
  if (t.includes('[RTE-SAVE]') || t.includes('[patchWI]')) console.log('PAGE>', t);
});
const log = (...a) => console.log(...a);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('button.primary');
await page.waitForSelector('.report-row', { timeout: 8000 });

async function openFirst() {
  await page.locator('button.primary', { hasText: '打开' }).first().click();
  await page.waitForSelector('.dep', { timeout: 10000 });
  await page.waitForTimeout(900);
}
await openFirst();

// 本周进展输入文字 + 插入图片
const progress = page.locator('.rte-content').first();
await progress.click();
await page.keyboard.type('进展-AA');
await page.locator('.rte-up input[type=file]').first().setInputFiles('C:/Users/Dong/weekly-report-platform/docs/test.png');
await page.waitForTimeout(500);

// 下周计划输入文字
const plan = page.locator('.rte-content').nth(1);
await plan.click();
await page.keyboard.type('计划-BB');

// 保存全部富文本
const saveBtns = await page.locator('.rte-bar button', { hasText: '保存' }).count();
for (let i = 0; i < saveBtns; i++) {
  await page.locator('.rte-bar button', { hasText: '保存' }).nth(i).click();
}
await page.waitForTimeout(900);

// 返回列表再打开，验证持久化
await page.locator('button', { hasText: '返回' }).first().click();
await page.waitForSelector('.report-row', { timeout: 8000 });
await openFirst();

const pText = (await page.locator('.rte-content').first().innerText()).trim();
const plText = (await page.locator('.rte-content').nth(1).innerText()).trim();
const imgCount = await page.locator('.rte-content img').count();
const natW = imgCount > 0 ? await page.locator('.rte-content img').first().evaluate((i) => i.naturalWidth) : 0;
log('PERSIST progress=', JSON.stringify(pText), '| plan=', JSON.stringify(plText), '| img=', imgCount, '| natW=', natW);

// 预览模式
await page.locator('button', { hasText: '预览' }).click();
await page.waitForTimeout(700);
const pv = await page.locator('.preview-report').innerText();
const pvImg = await page.locator('.preview-content img').count();
log('PREVIEW has 计划-BB=', pv.includes('计划-BB'), '| previewImg=', pvImg);
log('PREVIEW FULL:', JSON.stringify(pv.slice(0, 800)));
await page.screenshot({ path: 'docs/verify-preview.png', fullPage: true });
await page.locator('button', { hasText: '编辑' }).click();
await page.waitForTimeout(400);

// 筛选测试：把第一个工作项状态改为"已更新"，再筛选"已更新"
await page.locator('.status-select').first().selectOption('done');
await page.waitForTimeout(700);
await page.locator('.filters button', { hasText: '已更新' }).click();
await page.waitForTimeout(600);
const visibleWI = await page.locator('.wi').count();
const visibleDeps = await page.locator('.dep').count();
log('FILTER 已更新 -> visible work items=', visibleWI, '| visible departments=', visibleDeps);
await page.screenshot({ path: 'docs/verify-filter.png', fullPage: true });

await browser.close();
log('DONE');
