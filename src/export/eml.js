import { buildEmailHtml } from './html.js';

export function buildEml(report, to, theme = 'classic') {
  const { html, cids } = buildEmailHtml(report, theme);
  const subject = `${report.period_label} 周报`;
  const subjectB64 = Buffer.from(subject, 'utf-8').toString('base64');
  const boundary = `----=weekly${Date.now()}`;
  const parts = [];
  parts.push('From: weekly-report-platform <noreply@local>');
  // 防邮件头注入：仅允许单一合法邮箱，非法（含 CRLF、冒号、额外头）直接置空
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const safeTo = emailRe.test(String(to || '').trim()) ? String(to).trim() : '';
  parts.push(`To: ${safeTo}`);
  parts.push(`Subject: =?utf-8?B?${subjectB64}?=`);
  parts.push(`Date: ${new Date().toUTCString()}`);
  parts.push('MIME-Version: 1.0');
  parts.push(`Content-Type: multipart/related; boundary="${boundary}"`);
  parts.push('');
  parts.push(`--${boundary}`);
  parts.push('Content-Type: text/html; charset=utf-8');
  parts.push('Content-Transfer-Encoding: 8bit');
  parts.push('');
  parts.push(html);
  for (const [cid, img] of cids) {
    const ext = (img.mime.split('/')[1] || 'png').replace('+xml', '');
    parts.push(`--${boundary}`);
    parts.push(`Content-Type: ${img.mime}; name="${cid}.${ext}"`);
    parts.push('Content-Transfer-Encoding: base64');
    parts.push(`Content-ID: <${cid}>`);
    parts.push(`Content-Disposition: inline; filename="${cid}.${ext}"`);
    parts.push('');
    parts.push(img.data.toString('base64'));
  }
  parts.push(`--${boundary}--`);
  return parts.join('\r\n');
}
