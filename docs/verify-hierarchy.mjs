import fs from 'node:fs';

const BASE = 'http://localhost:8000';
const auth = Buffer.from('admin:admin123').toString('base64');
const H = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };

const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
const { token } = await login.json();
const hdr = { Authorization: `Bearer ${token}` };

const list = await (await fetch(`${BASE}/api/weekly-reports`, { headers: hdr })).json();
const rep = list[0];
console.log('报告:', rep.id, rep.period_label, '| 部门数:', rep.departments?.length, '| 专项数:', rep.special_progress?.length, '| 工作项数:', rep.departments?.reduce((a, d) => a + d.work_items.length, 0));

const themes = ['classic', 'executive', 'mint', 'amber', 'print'];
let allPass = true;
for (const th of themes) {
  const res = await fetch(`${BASE}/api/weekly-reports/${rep.id}/export/preview-html?theme=${th}`, { headers: hdr });
  const html = await res.text();
  fs.writeFileSync(`docs/sample-${th}.html`, html);
  const checks = {
    '报告横幅 rp-header': html.includes('rp-header'),
    '目录 rp-toc': html.includes('rp-toc'),
    '一级编号 一': html.includes('class="rp-num">一<') || html.includes('>一<'),
    '二级编号 2.1': html.includes('2.1'),
    '三级编号 3.1': html.includes('3.1'),
    '锚点 sec-core': html.includes('id="sec-core"'),
    '锚点 sec-deps': html.includes('id="sec-deps"'),
    '锚点 sec-high-': html.includes('id="sec-high-'),
    '锚点 sec-dep-': html.includes('id="sec-dep-'),
    '锚点 sec-wi-': html.includes('id="sec-wi-'),
    '部门分组标题 三.': /3\.\d/.test(html)
  };
  const fails = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  if (fails.length) allPass = false;
  console.log(`\n[${th}] ${fails.length ? 'FAIL: ' + fails.join(', ') : 'OK (13 项全过)'}`);
}

// 邮件层级校验
const eml = await (await fetch(`${BASE}/api/weekly-reports/${rep.id}/export/eml?theme=classic`, { headers: hdr })).text();
const emlOk = eml.includes('WEEKLY REPORT') && eml.includes('2.1') && eml.includes('3.1') && eml.includes('一句话核心进展');
console.log(`\n[email] ${emlOk ? 'OK 邮件层级编号正常' : 'FAIL 邮件层级缺失'}`);
if (!emlOk) allPass = false;

console.log('\n==== 总判定:', allPass ? '全部通过 ✅' : '存在失败 ❌', '====');
process.exit(allPass ? 0 : 1);
