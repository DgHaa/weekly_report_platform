const BASE = 'http://localhost:8000/api';
const ACCENTS = { classic: '#26215c', executive: '#0c447c', mint: '#0f6e56', amber: '#993c1d', print: '#222222' };

const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) }).then(r => r.json());
const token = login.token;
const H = { Authorization: `Bearer ${token}` };

const reports = await fetch(`${BASE}/weekly-reports`, { headers: H }).then(r => r.json());
const rid = reports[0].id;
console.log('report id =', rid, 'current theme =', reports[0].theme);

async function patchTheme(t) {
  const r = await fetch(`${BASE}/weekly-reports/${rid}`, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: t }) });
  return r.status;
}
async function previewHtml(t) {
  return fetch(`${BASE}/weekly-reports/${rid}/export/preview-html?theme=${t}`, { headers: H }).then(r => r.text());
}

let ok = true;
// mint
console.log('PATCH mint ->', await patchTheme('mint'));
let h = await previewHtml('mint');
const hasMintAccent = h.includes(`--accent:${ACCENTS.mint}`);
const hasIds = h.includes('id="sec-core"') && h.includes('id="sec-highlights"') && h.includes('id="sec-dep-') && h.includes('id="sec-wi-') && h.includes('id="sec-high-');
console.log('mint accent present:', hasMintAccent, '| anchor ids present:', hasIds);
ok = ok && hasMintAccent && hasIds;

// amber
h = await previewHtml('amber');
const hasAmber = h.includes(`--accent:${ACCENTS.amber}`);
console.log('amber accent present:', hasAmber);
ok = ok && hasAmber;

// classic via persisted theme (no ?theme) should now be mint since we patched
h = await previewHtml('');
const usesPersisted = h.includes(`--accent:${ACCENTS.mint}`);
console.log('no ?theme uses persisted(mint):', usesPersisted);
ok = ok && usesPersisted;

// export/html attachment still works + has ids + amber
const exp = await fetch(`${BASE}/weekly-reports/${rid}/export/html?theme=amber`, { headers: H });
const expText = await exp.text();
const expHasId = expText.includes('id="sec-core"') && expText.includes('id="sec-highlights"');
const expAccent = expText.includes(`--accent:${ACCENTS.amber}`);
console.log('export/html has ids:', expHasId, '| amber accent:', expAccent, '| disposition:', exp.headers.get('content-disposition'));
ok = ok && expHasId && expAccent;

// restore to classic
console.log('PATCH restore classic ->', await patchTheme('classic'));
console.log(ok ? 'ALL BACKEND CHECKS PASS' : 'SOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
