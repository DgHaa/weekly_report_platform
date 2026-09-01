const BASE = 'http://localhost:8000';
const l = await fetch(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
});
const j = await l.json();
const tok = j.token || (j.data && j.data.token);
if (!tok) { console.error('login failed', j); process.exit(1); }
const r = await fetch(BASE + '/api/weekly-reports/1/export/pdf', {
  headers: { Authorization: 'Bearer ' + tok }
});
const buf = Buffer.from(await r.arrayBuffer());
console.log('status', r.status, 'bytes', buf.length, 'magic', JSON.stringify(buf.slice(0, 4).toString()));
console.log(buf.slice(0, 4).toString() === '%PDF' ? 'PDF_OK' : 'PDF_FAIL');
