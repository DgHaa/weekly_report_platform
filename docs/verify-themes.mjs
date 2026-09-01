import fs from 'node:fs';

const BASE = 'http://localhost:8000';
const outDir = 'C:/Users/Dong/weekly-report-platform/docs';
const log = (...a) => console.log(...a);

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
}).then((r) => r.json());
if (!login.token) { log('LOGIN FAILED', login); process.exit(1); }
const token = login.token;

const themes = await fetch(`${BASE}/api/weekly-reports/themes`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
log('themes list:', JSON.stringify(themes));
if (themes.length < 5) { log('WARN: expected >=5 themes, got', themes.length); }

const reports = await fetch(`${BASE}/api/weekly-reports`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
if (!reports.length) { log('NO REPORTS to export'); process.exit(1); }
const rid = reports[0].id;
log('using report id', rid, '(', reports[0].period_label, ')');

const expectedAccent = {
  classic: '#26215c', executive: '#0c447c', mint: '#0f6e56', amber: '#993c1d', print: '#222222'
};

let ok = true;
for (const t of themes) {
  const html = await fetch(`${BASE}/api/weekly-reports/${rid}/export/html?theme=${t.key}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.text());
  const hasAccent = html.includes(`--accent:${expectedAccent[t.key]}`);
  const hasPrintOverride = t.key !== 'print' || html.includes('border-bottom:2px solid');
  const hasModuleTitle = html.includes('module-title');
  const pass = hasAccent && hasPrintOverride && hasModuleTitle;
  if (!pass) ok = false;
  log(`[${pass ? 'PASS' : 'FAIL'}] theme=${t.key} accent=${expectedAccent[t.key]} match=${hasAccent} printOverride=${hasPrintOverride}`);
  fs.writeFileSync(`${outDir}/export-${t.key}.html`, html);
}

// 邮件主题校验：executive 邮件标题颜色应为 #0c447c
const eml = await fetch(`${BASE}/api/weekly-reports/${rid}/export/eml?theme=executive`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.text());
const emlAccentOk = eml.includes('#0c447c');
log(`[${emlAccentOk ? 'PASS' : 'FAIL'}] email theme=executive accent color applied`);
if (!emlAccentOk) ok = false;

log(ok ? '\nALL THEME CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
