import fs from 'node:fs';
import { db } from '../db.js';
import { getTheme, themeStyle } from './themes.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function loadImage(id) {
  const a = db.prepare('SELECT * FROM attachments WHERE id=?').get(id);
  if (!a || !fs.existsSync(a.path)) return null;
  try {
    return { mime: a.mime, data: fs.readFileSync(a.path) };
  } catch {
    return null;
  }
}

function inlineStandalone(html) {
  if (!html) return '';
  return html.replace(/\/api\/attachments\/(\d+)/g, (_m, id) => {
    const img = loadImage(id);
    return img ? `data:${img.mime};base64,${img.data.toString('base64')}` : _m;
  });
}

const WI_STATUS = { blank: '未填写', stale: '未更新', done: '已更新' };
const REPORT_STATUS = { draft: '草稿', collecting: '收集中', published: '已发布' };

// theme：主题 key（classic/executive/mint/amber/print），缺省 classic
export function buildStandaloneHtml(report, theme = 'classic') {
  const style = themeStyle(theme);
  const statusLabel = REPORT_STATUS[report.status] || report.status;

  // —— 模块一：一句话核心进展（按部门）——
  const coreItems = report.departments.length
    ? report.departments.map((d) => {
        const body = inlineStandalone(d.core_html) || '<span class="rp-empty">该部门暂未填写核心进展</span>';
        return `<div class="rp-core-item">
          <div class="rp-core-name">${esc(d.name)}</div>
          <div class="rp-core-body">${body}</div>
        </div>`;
      }).join('')
    : '<div class="rp-empty">暂无部门</div>';

  // —— 模块二：关键专项进展（多条，编号 2.1 / 2.2 …）——
  const sp = report.special_progress || [];
  const spItems = sp.length
    ? sp.map((s, i) => {
        const body = inlineStandalone(s.content_html) || '<span class="rp-empty">未填写</span>';
        return `<article class="rp-sp" id="sec-high-${s.id}">
          <div class="rp-sp-head"><span class="rp-sp-num">2.${i + 1}</span>${esc(s.title || '（未命名专项）')}</div>
          <div class="rp-sp-body">${body}</div>
        </article>`;
      }).join('')
    : '<div class="rp-empty">暂未填写关键专项进展</div>';
  const spToc = sp.length
    ? `<ol>${sp.map((s, i) => `<li><a href="#sec-high-${s.id}">2.${i + 1} ${esc(s.title || '（未命名专项）')}</a></li>`).join('')}</ol>`
    : '';

  // —— 模块三：部门工作展示（每部门一个分组，编号 3.1 / 3.2 …，下含工作项卡片）——
  const depItems = report.departments.length
    ? report.departments.map((d, di) => {
        const wi = d.work_items.length
          ? d.work_items.map((w) => `
            <article class="rp-wi" id="sec-wi-${w.id}">
              <div class="rp-wi-head">${esc(w.title) || '（无标题）'}</div>
              <div class="rp-wi-block"><span class="rp-lbl">本周进展</span>${inlineStandalone(w.progress_html) || '<span class="rp-empty">未填写</span>'}</div>
              <div class="rp-wi-block"><span class="rp-lbl">下周计划</span>${inlineStandalone(w.plan_html) || '<span class="rp-empty">未填写</span>'}</div>
              <div class="rp-wi-status">状态：${WI_STATUS[w.status] || w.status}</div>
            </article>`).join('')
          : '<div class="rp-empty">该部门暂无工作项</div>';
        return `<div class="rp-dep" id="sec-dep-${d.id}">
          <h3 class="rp-h2"><span class="rp-num2">3.${di + 1}</span>${esc(d.name)}</h3>
          <div class="rp-wi-list">${wi}</div>
        </div>`;
      }).join('')
    : '<div class="rp-empty">暂无部门</div>';
  const depToc = report.departments.length
    ? `<ol>${report.departments.map((d, di) => `<li><a href="#sec-dep-${d.id}">3.${di + 1} ${esc(d.name)}</a></li>`).join('')}</ol>`
    : '';

  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(report.period_label)} 周报</title><style>
  ${style}
  </style></head><body>
  <div class="rp-page">
    <header class="rp-header">
      <div class="rp-header-bar"></div>
      <div class="rp-header-inner">
        <div class="rp-kicker">周报 · WEEKLY REPORT</div>
        <h1 class="rp-title">${esc(report.period_label)}</h1>
        <div class="rp-subtitle">${esc(report.title || '（未填写标题）')}</div>
        <div class="rp-meta">
          <span class="rp-badge">${esc(statusLabel)}</span>
          <span>生成于 ${new Date().toLocaleString('zh-CN')}</span>
        </div>
      </div>
    </header>

    <nav class="rp-toc" aria-label="目录">
      <div class="rp-toc-title">目录</div>
      <ol>
        <li><a href="#sec-core">一、一句话核心进展</a></li>
        <li><a href="#sec-highlights">二、关键专项进展</a>${spToc}</li>
        <li><a href="#sec-deps">三、部门工作展示</a>${depToc}</li>
      </ol>
    </nav>

    <main class="rp-main">
      <section class="rp-section" id="sec-core">
        <h2 class="rp-h1"><span class="rp-num">一</span>一句话核心进展</h2>
        <div class="rp-core-list">${coreItems}</div>
      </section>

      <section class="rp-section" id="sec-highlights">
        <h2 class="rp-h1"><span class="rp-num">二</span>关键专项进展</h2>
        <div class="rp-sp-list">${spItems}</div>
      </section>

      <section class="rp-section" id="sec-deps">
        <h2 class="rp-h1"><span class="rp-num">三</span>部门工作展示</h2>
        ${depItems}
      </section>
    </main>
  </div>
  </body></html>`;
}

// theme：主题 key，缺省 classic
export function buildEmailHtml(report, theme = 'classic') {
  const e = getTheme(theme).email;
  const cids = new Map();
  const rich = (h) => {
    if (!h) return '';
    return h.replace(/\/api\/attachments\/(\d+)/g, (_m, id) => {
      const img = loadImage(id);
      if (!img) return _m;
      const cid = `img${id}`;
      if (!cids.has(cid)) cids.set(cid, img);
      return `cid:${cid}`;
    });
  };
  const statusLabel = REPORT_STATUS[report.status] || report.status;
  const numBadge = (n) => `<span style="display:inline-block;min-width:24px;text-align:center;background:${e.accent};color:#fff;border-radius:6px;font-size:12px;font-weight:700;padding:1px 7px;margin-right:8px;">${n}</span>`;

  // 模块一：核心进展（按部门）
  const coreRows = report.departments.length
    ? report.departments.map((d) => {
        const body = rich(d.core_html) || `<span style="color:${e.labelText};">该部门暂未填写核心进展</span>`;
        return `<tr><td style="padding:6px 0;border-top:1px solid ${e.border};"><div style="font-size:14px;font-weight:600;color:${e.accent};">${esc(d.name)}</div><div style="font-size:14px;color:${e.accent};padding:4px 0 8px;">${body}</div></td></tr>`;
      }).join('')
    : `<tr><td style="color:${e.labelText};padding:8px 0;">暂无部门</td></tr>`;

  // 模块二：关键专项进展
  const spHtmlEmail = (report.special_progress || []).length
    ? report.special_progress.map((s, i) => {
        const body = rich(s.content_html) || `<span style="color:${e.labelText};">未填写</span>`;
        return `<div style="border:1px solid ${e.border};border-left:3px solid ${e.accent};border-radius:10px;padding:12px 16px;margin:8px 0;background:${e.labelBg};"><div style="font-size:15px;font-weight:600;color:${e.accent};">${numBadge('2.' + (i + 1))}${esc(s.title || '（未命名专项）')}</div><div style="font-size:14px;color:${e.accent};padding:4px 0;">${body}</div></div>`;
      }).join('')
    : `<span style="color:${e.labelText};">暂未填写关键专项进展</span>`;

  // 模块三：部门工作展示
  const workDeps = report.departments.length
    ? report.departments.map((d, di) => {
        const items = d.work_items.length
          ? d.work_items.map((w) => `
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${e.border};border-radius:10px;margin:8px 0;">
              <tr><td style="padding:12px 16px;">
                <div style="font-size:15px;font-weight:600;color:${e.accent};">${esc(w.title) || '（无标题）'}</div>
                <div style="padding:6px 0 2px;"><span style="font-size:12px;color:${e.labelText};background:${e.labelBg};border-radius:6px;padding:2px 8px;">本周进展</span></div>
                <div style="font-size:14px;color:${e.accent};padding:2px 0;">${rich(w.progress_html) || `<span style="color:${e.labelText};">未填写</span>`}</div>
                <div style="padding:6px 0 2px;"><span style="font-size:12px;color:${e.labelText};background:${e.labelBg};border-radius:6px;padding:2px 8px;">下周计划</span></div>
                <div style="font-size:14px;color:${e.accent};padding:2px 0;">${rich(w.plan_html) || `<span style="color:${e.labelText};">未填写</span>`}</div>
                <div style="font-size:12px;color:${e.labelText};padding-top:4px;">状态：${WI_STATUS[w.status] || w.status}</div>
              </td></tr>
            </table>`).join('')
          : `<div style="color:${e.labelText};padding:6px 0;">该部门暂无工作项</div>`;
        return `<div style="margin:14px 0;"><div style="font-size:16px;font-weight:700;color:${e.accent};margin-bottom:6px;">${numBadge('3.' + (di + 1))}${esc(d.name)}</div>${items}</div>`;
      }).join('')
    : `<span style="color:${e.labelText};">暂无部门</span>`;

  const sectionCard = (title, num, inner) => `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ${e.border};border-radius:12px;margin:0 0 16px;"><tr><td style="padding:18px 22px;"><h2 style="font-size:18px;margin:0 0 12px;color:${e.accent};">${numBadge(num)}${title}</h2>${inner}</td></tr></table>`;

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:${e.bg};font-family:'Microsoft YaHei',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:820px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;"><tr><td>
    <div style="background:${e.accent};padding:26px 28px;">
      <div style="font-size:12px;letter-spacing:2px;color:rgba(255,255,255,.8);text-transform:uppercase;">周报 · WEEKLY REPORT</div>
      <div style="font-size:22px;font-weight:700;color:#fff;margin:6px 0 2px;">${esc(report.period_label)}</div>
      <div style="font-size:15px;color:rgba(255,255,255,.9);">${esc(report.title || '（未填写标题）')}</div>
      <div style="font-size:13px;color:rgba(255,255,255,.85);margin-top:10px;">状态：${esc(statusLabel)}</div>
    </div>
    <div style="padding:22px 28px;">
      ${sectionCard('一句话核心进展', '一', `<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${e.border};">${coreRows}</table>`)}
      ${sectionCard('关键专项进展', '二', spHtmlEmail)}
      ${sectionCard('部门工作展示', '三', workDeps)}
    </div>
  </td></tr></table></body></html>`;
  return { html, cids: [...cids.entries()] };
}
