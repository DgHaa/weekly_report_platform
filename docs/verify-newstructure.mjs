import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const log = (...a) => console.log(...a);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('button.primary');
await page.waitForSelector('.report-row', { timeout: 8000 });

await page.locator('button.primary', { hasText: '打开' }).first().click();
await page.waitForSelector('.dep', { timeout: 10000 });
await page.waitForTimeout(900);

// 编辑模式：是否存在「关键专项进展」编辑区 与 部门内「核心进展」编辑区
const editModuleCount = await page.locator('.edit-module').count();
const coreLabelCount = await page.locator('.dep .lbl', { hasText: '一句话核心进展' }).count();
log('EDIT edit-module=', editModuleCount, '| 部门核心进展编辑区=', coreLabelCount);

// 关键专项进展：输入文字
await page.locator('.edit-module .rte-content').first().click();
await page.keyboard.type('专项-AA');
await page.waitForTimeout(150);
await page.locator('.edit-module .rte-bar button', { hasText: '保存' }).first().click();
await page.waitForSelector('.toast.ok', { timeout: 5000 });

// 第一个部门核心进展：输入文字
await page.locator('.dep').first().locator('.rte-content').first().click();
await page.keyboard.type('核心-BB');
await page.waitForTimeout(150);
await page.locator('.dep').first().locator('.rte-bar button', { hasText: '保存' }).first().click();
await page.waitForSelector('.toast.ok', { timeout: 5000 });

// 切到预览
await page.locator('button', { hasText: '预览' }).click();
await page.waitForTimeout(700);
const modules = await page.locator('.preview-module').count();
const previewText = await page.locator('.preview-report').innerText();
log('PREVIEW modules=', modules, '| has 一句话核心进展=', previewText.includes('一句话核心进展'), '| has 关键专项进展=', previewText.includes('关键专项进展'), '| has 核心-BB=', previewText.includes('核心-BB'), '| has 专项-AA=', previewText.includes('专项-AA'));
await page.locator('.preview-report').screenshot({ path: 'C:/Users/Dong/weekly-report-platform/docs/verify-newstructure.png' });

// 后端字段校验
const TOKEN = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) })).json().then((j) => j.token);
const rep = await (await fetch(`${BASE}/api/weekly-reports/1`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
log('BACKEND highlights_html has 专项-AA=', (rep.highlights_html || '').includes('专项-AA'), '| dept0.core_html has 核心-BB=', (rep.departments[0]?.core_html || '').includes('核心-BB'));

// 清理
await fetch(`${BASE}/api/weekly-reports/1`, { method: 'PATCH', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ highlights_html: '' }) });
await fetch(`${BASE}/api/weekly-reports/departments/${rep.departments[0].id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ core_html: '' }) });
log('CLEANED');

await browser.close();
log('DONE');
