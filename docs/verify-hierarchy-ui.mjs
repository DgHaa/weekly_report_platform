import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:8000';
const shot = (p, b) => fs.writeFileSync(p, b);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 1100 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// 1) 登录
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'admin123');
await page.click('button:has-text("登 录")');
await page.waitForSelector('text=打开', { timeout: 10000 });

// 2) 打开第一份报告
await page.click('button:has-text("打开")');
await page.waitForSelector('.theme-pick', { timeout: 10000 });

// 3) 切到预览
await page.click('button:has-text("预览")');
await page.waitForSelector('.theme-preview .rp-page', { timeout: 10000 });
await page.waitForTimeout(400);

const checkStructure = async (theme) => {
  const r = await page.evaluate(() => {
    const q = (s) => !!document.querySelector(s);
    return {
      toc: q('.rp-toc'),
      numOne: !!document.querySelector('.rp-num'),
      secCore: q('#sec-core'),
      secDeps: q('#sec-deps'),
      secHigh: q('[id^="sec-high-"]'),
      secDep: q('[id^="sec-dep-"]'),
      secWi: q('[id^="sec-wi-"]'),
      has21: document.body.innerHTML.includes('2.1'),
      has31: document.body.innerHTML.includes('3.1'),
      editorToc: document.querySelectorAll('.editor-toc a, .toc-link').length
    };
  });
  console.log(`[${theme}]`, JSON.stringify(r));
  return r;
};

// 4) 经典蓝紫截图
await page.screenshot({ path: 'docs/ui-preview-classic.png', fullPage: false });
const c1 = await checkStructure('classic');

// 5) 切到清新青绿
await page.selectOption('.theme-pick select', 'mint');
await page.waitForTimeout(700);
await page.waitForSelector('.theme-preview .rp-page', { timeout: 10000 });
await page.screenshot({ path: 'docs/ui-preview-mint.png', fullPage: false });
const c2 = await checkStructure('mint');

// 6) 切到打印单色
await page.selectOption('.theme-pick select', 'print');
await page.waitForTimeout(700);
await page.waitForSelector('.theme-preview .rp-page', { timeout: 10000 });
await page.screenshot({ path: 'docs/ui-preview-print.png', fullPage: false });
const c3 = await checkStructure('print');

await browser.close();

const allOk = [c1, c2, c3].every((c) => c.toc && c.numOne && c.secCore && c.secDeps && c.secHigh && c.secDep && c.secWi && c.has21 && c.has31);
console.log('\n控制台错误:', errors.length ? errors.join(' | ') : '无');
console.log('==== 总判定:', allOk && !errors.length ? '通过 ✅' : '失败 ❌', '====');
process.exit(allOk && !errors.length ? 0 : 1);
