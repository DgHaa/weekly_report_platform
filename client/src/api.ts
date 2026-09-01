const BASE = '/api';

function hdr() {
  const t = localStorage.getItem('wr_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function req(method: string, path: string, body?: any) {
  const opt: RequestInit = { method, headers: { 'Content-Type': 'application/json', ...hdr() } };
  if (body !== undefined) opt.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opt);
  if (!r.ok) {
    let e: any;
    try { e = await r.json(); } catch { /* ignore */ }
    throw new Error(e?.error || r.statusText);
  }
  if (r.status === 204) return null;
  return r.json();
}

export const api = {
  login: (username: string, password: string) => req('POST', '/auth/login', { username, password }),
  listReports: (q?: any) => req('GET', '/weekly-reports' + (q ? `?${new URLSearchParams(q)}` : '')),
  getReport: (id: any) => req('GET', `/weekly-reports/${id}`),
  createReport: (body: any) => req('POST', '/weekly-reports', body),
  patchReport: (id: any, body: any) => req('PATCH', `/weekly-reports/${id}`, body),
  publish: (id: any, to: string) => req('POST', `/weekly-reports/${id}/publish`, { to }),
  deleteReport: (id: any) => req('DELETE', `/weekly-reports/${id}`),
  copyLast: (id: any, body: any) => req('POST', `/weekly-reports/${id}/copy-last`, body),
  addDept: (id: any, name: string) => req('POST', `/weekly-reports/${id}/departments`, { name }),
  patchDept: (did: any, body: any) => req('PATCH', `/weekly-reports/departments/${did}`, body),
  delDept: (rid: any, did: any) => req('DELETE', `/weekly-reports/${rid}/departments/${did}`),
  addWorkItem: (did: any, title: string) => req('POST', `/weekly-reports/departments/${did}/work-items`, { title }),
  patchWorkItem: (wid: any, body: any) => req('PATCH', `/weekly-reports/work-items/${wid}`, body),
  delWorkItem: (wid: any) => req('DELETE', `/weekly-reports/work-items/${wid}`),
  addSpecial: (rid: any, body: any) => req('POST', `/weekly-reports/${rid}/special-progress`, body),
  patchSpecial: (rid: any, sid: any, body: any) => req('PATCH', `/weekly-reports/${rid}/special-progress/${sid}`, body),
  delSpecial: (rid: any, sid: any) => req('DELETE', `/weekly-reports/${rid}/special-progress/${sid}`),
  listVersions: (id: any) => req('GET', `/weekly-reports/${id}/versions`),
  saveVersion: (id: any, note: string) => req('POST', `/weekly-reports/${id}/versions`, { note }),
  compareVersions: (id: any, a: any, b: any) => req('POST', `/weekly-reports/${id}/versions/compare`, { a, b }),
  restoreVersion: (id: any, vid: any) => req('POST', `/weekly-reports/${id}/versions/${vid}/restore`),
  uploadAttachment: (weekly_report_id: any, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('weekly_report_id', String(weekly_report_id));
    return fetch(BASE + '/attachments', { method: 'POST', headers: hdr(), body: fd }).then((r) => r.json());
  },
  listUsers: () => req('GET', '/auth/'),
  createUser: (body: any) => req('POST', '/auth/', body),
  deleteUser: (id: any) => req('DELETE', `/auth/${id}`),
  listThemes: () => req('GET', '/weekly-reports/themes')
};

// 取导出 HTML 文本（内联，无附件头），用于编辑器内预览
export async function getExportHtml(id: any, theme?: string) {
  const qs = theme ? `?theme=${encodeURIComponent(theme)}` : '';
  const r = await fetch(`${BASE}/weekly-reports/${id}/export/preview-html${qs}`, { headers: hdr() });
  if (!r.ok) throw new Error('预览生成失败');
  return r.text();
}

export async function downloadExport(id: any, type: 'html' | 'pdf' | 'eml', to?: string, theme?: string) {
  const qs = new URLSearchParams();
  if (to) qs.set('to', to);
  if (theme) qs.set('theme', theme);
  const url = `${BASE}/weekly-reports/${id}/export/${type}${qs.toString() ? `?${qs}` : ''}`;
  const r = await fetch(url, { headers: hdr() });
  if (!r.ok) throw new Error('导出失败');
  const blob = await r.blob();
  const obj = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = obj;
  a.download = `周报.${type}`;
  a.click();
  URL.revokeObjectURL(obj);
}
