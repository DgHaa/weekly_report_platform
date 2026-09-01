// 报告导出主题注册表：每套主题定义一套色系 + 排版变量 + 邮件配色。
// 主题只影响导出（HTML/PDF/邮件）的视觉风格，不改变任何数据结构。

const BODY_FONT = "-apple-system,'Segoe UI',Roboto,'Microsoft YaHei',sans-serif";

// 每套主题：
//  key      唯一标识，用于 URL ?theme= 与前端选择器
//  label    中文展示名
//  mode     'card' 卡片风格 | 'print' 打印单色（扁平、省墨）
//  vars     CSS 自定义属性，供独立 HTML 的 <style> 使用
//  email    邮件内联样式配色（邮件客户端不支持外部 CSS 变量）
export const THEMES = {
  classic: {
    key: 'classic',
    label: '经典蓝紫',
    mode: 'card',
    vars: {
      '--bg': '#f7f8fa',
      '--text': '#1f2329',
      '--muted': '#b7bcc4',
      '--module-bg': '#ffffff',
      '--module-border': '#eef0f3',
      '--accent': '#26215c',
      '--accent-soft': '#f2f3f7',
      '--label-text': '#7a8190',
      '--block-border': '#f0f1f4',
      '--status': '#3b6d11',
      '--radius': '12px',
      '--body-font': BODY_FONT,
      '--heading-font': BODY_FONT
    },
    email: { accent: '#26215c', border: '#eef0f3', labelBg: '#f2f3f7', labelText: '#7a8190', bg: '#f7f8fa' }
  },
  executive: {
    key: 'executive',
    label: '商务深蓝',
    mode: 'card',
    vars: {
      '--bg': '#f4f6f9',
      '--text': '#16243a',
      '--muted': '#9aa6b5',
      '--module-bg': '#ffffff',
      '--module-border': '#dde6f0',
      '--accent': '#0c447c',
      '--accent-soft': '#e6f1fb',
      '--label-text': '#4f6f96',
      '--block-border': '#e6ecf3',
      '--status': '#0f6e56',
      '--radius': '6px',
      '--body-font': BODY_FONT,
      '--heading-font': BODY_FONT
    },
    email: { accent: '#0c447c', border: '#dde6f0', labelBg: '#e6f1fb', labelText: '#4f6f96', bg: '#f4f6f9' }
  },
  mint: {
    key: 'mint',
    label: '清新青绿',
    mode: 'card',
    vars: {
      '--bg': '#f3f8f6',
      '--text': '#1d2b27',
      '--muted': '#9bb5ac',
      '--module-bg': '#ffffff',
      '--module-border': '#dceee7',
      '--accent': '#0f6e56',
      '--accent-soft': '#e1f5ee',
      '--label-text': '#3d7a6a',
      '--block-border': '#e6f3ee',
      '--status': '#3b6d11',
      '--radius': '14px',
      '--body-font': BODY_FONT,
      '--heading-font': BODY_FONT
    },
    email: { accent: '#0f6e56', border: '#dceee7', labelBg: '#e1f5ee', labelText: '#3d7a6a', bg: '#f3f8f6' }
  },
  amber: {
    key: 'amber',
    label: '暖橙活力',
    mode: 'card',
    vars: {
      '--bg': '#fdf6ec',
      '--text': '#2c2c2a',
      '--muted': '#c2a98a',
      '--module-bg': '#ffffff',
      '--module-border': '#f3e6d3',
      '--accent': '#993c1d',
      '--accent-soft': '#faeedda',
      '--label-text': '#a06a2c',
      '--block-border': '#f6ecdd',
      '--status': '#854f0b',
      '--radius': '12px',
      '--body-font': BODY_FONT,
      '--heading-font': BODY_FONT
    },
    email: { accent: '#993c1d', border: '#f3e6d3', labelBg: '#faeedda', labelText: '#a06a2c', bg: '#fdf6ec' }
  },
  print: {
    key: 'print',
    label: '打印单色',
    mode: 'print',
    vars: {
      '--bg': '#ffffff',
      '--text': '#1a1a1a',
      '--muted': '#888888',
      '--module-bg': '#ffffff',
      '--module-border': '#cccccc',
      '--accent': '#222222',
      '--accent-soft': '#f0f0f0',
      '--label-text': '#555555',
      '--block-border': '#dddddd',
      '--status': '#555555',
      '--radius': '4px',
      '--body-font': BODY_FONT,
      '--heading-font': BODY_FONT
    },
    email: { accent: '#222222', border: '#cccccc', labelBg: '#f0f0f0', labelText: '#555555', bg: '#ffffff' }
  }
};

export const DEFAULT_THEME = 'classic';

export function getTheme(key) {
  return THEMES[key] || THEMES[DEFAULT_THEME];
}

export function themeList() {
  return Object.values(THEMES).map((t) => ({ key: t.key, label: t.label }));
}

// 生成独立 HTML 的 <style> 内容（含主题变量与基础排版）。
export function themeStyle(theme) {
  const t = getTheme(theme);
  const v = t.vars;
  const root = Object.entries(v).map(([k, val]) => `${k}:${val}`).join(';');
  // 打印单色主题：扁平、去填充、用分隔线表现层级，省墨且适配 PDF
  const printOverride = t.mode === 'print'
    ? `.rp-header{background:#fff;color:var(--accent);border-bottom:2px solid var(--module-border);}
.rp-header-bar{display:none;}
.rp-kicker,.rp-subtitle,.rp-meta{color:var(--label-text);}
.rp-badge{background:transparent;border:1px solid var(--module-border);color:var(--text);}
.rp-toc{border:1px solid var(--module-border);border-radius:0;padding:12px 16px;}
.rp-section{border:1px solid var(--module-border);border-radius:0;padding:16px 0;margin-bottom:12px;}
.rp-h1{border-bottom:1px solid var(--block-border);padding-bottom:8px;}
.rp-sp{background:#fff;border:1px solid var(--module-border);border-left:3px solid var(--accent);}
.rp-wi{background:#fff;}
.rp-page{padding:0 16px 24px;}`
    : '';
  return `:root{${root}}
  body{margin:0;padding:0;font-family:${v['--body-font']};color:${v['--text']};background:${v['--bg']};}
  .rp-page{max-width:940px;margin:0 auto;padding:32px 24px 40px;}
  .rp-header{background:${v['--accent']};color:#fff;overflow:hidden;}
  .rp-header-bar{height:5px;background:rgba(255,255,255,.22);}
  .rp-header-inner{padding:26px 30px;}
  .rp-kicker{font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.82;}
  .rp-title{font-size:28px;margin:6px 0 2px;font-weight:700;font-family:${v['--heading-font']};}
  .rp-subtitle{font-size:16px;opacity:.92;}
  .rp-meta{margin-top:12px;font-size:13px;opacity:.9;display:flex;gap:14px;align-items:center;flex-wrap:wrap;}
  .rp-badge{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.4);border-radius:999px;padding:2px 12px;font-size:12px;}
  .rp-toc{background:${v['--module-bg']};border:1px solid ${v['--module-border']};border-radius:${v['--radius']};padding:18px 22px;margin:22px 0;}
  .rp-toc-title{font-size:13px;font-weight:700;color:${v['--label-text']};letter-spacing:1px;margin-bottom:10px;}
  .rp-toc ol{list-style:none;margin:0;padding:0;}
  .rp-toc>ol>li{margin:6px 0;}
  .rp-toc a{color:${v['--text']};text-decoration:none;font-weight:600;font-size:15px;}
  .rp-toc a:hover{color:${v['--accent']};}
  .rp-toc ol ol{margin:4px 0 4px 24px;}
  .rp-toc ol ol li{margin:4px 0;}
  .rp-toc ol ol a{font-weight:500;font-size:14px;color:${v['--label-text']};}
  .rp-section{background:${v['--module-bg']};border:1px solid ${v['--module-border']};border-radius:${v['--radius']};padding:24px 28px;margin-bottom:18px;}
  .rp-h1{font-size:20px;margin:0 0 16px;color:${v['--accent']};display:flex;align-items:center;gap:10px;font-weight:700;font-family:${v['--heading-font']};}
  .rp-num{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;background:${v['--accent']};color:#fff;border-radius:8px;font-size:15px;font-weight:700;flex-shrink:0;}
  .rp-core-list{display:flex;flex-direction:column;}
  .rp-core-item{padding:12px 0;border-top:1px solid ${v['--block-border']};}
  .rp-core-item:first-child{border-top:none;}
  .rp-core-name{font-size:15px;font-weight:700;color:${v['--accent']};margin-bottom:6px;}
  .rp-core-body{font-size:14px;line-height:1.7;}
  .rp-sp-list{display:flex;flex-direction:column;gap:12px;}
  .rp-sp{border:1px solid ${v['--module-border']};border-left:4px solid ${v['--accent']};border-radius:${v['--radius']};padding:14px 18px;background:${v['--accent-soft']};}
  .rp-sp-head{font-size:16px;font-weight:700;color:${v['--accent']};display:flex;align-items:center;gap:8px;margin-bottom:8px;}
  .rp-sp-num{font-size:13px;background:${v['--accent']};color:#fff;border-radius:6px;padding:1px 8px;flex-shrink:0;}
  .rp-sp-body{font-size:14px;line-height:1.7;}
  .rp-dep{margin-top:18px;}
  .rp-dep:first-of-type{margin-top:0;}
  .rp-dep + .rp-dep{border-top:1px dashed ${v['--module-border']};padding-top:18px;}
  .rp-h2{font-size:17px;margin:0 0 12px;color:${v['--text']};display:flex;align-items:center;gap:8px;font-weight:700;font-family:${v['--heading-font']};}
  .rp-num2{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;background:${v['--accent-soft']};color:${v['--accent']};border-radius:6px;font-size:13px;font-weight:700;flex-shrink:0;}
  .rp-wi-list{display:flex;flex-direction:column;gap:12px;}
  .rp-wi{border:1px solid ${v['--module-border']};border-radius:${v['--radius']};padding:14px 18px;background:${v['--module-bg']};}
  .rp-wi-head{font-size:15.5px;font-weight:700;color:${v['--text']};margin-bottom:8px;}
  .rp-wi-block{font-size:14px;line-height:1.7;margin:6px 0;}
  .rp-lbl{display:inline-block;font-size:12px;color:${v['--label-text']};background:${v['--accent-soft']};border-radius:6px;padding:2px 8px;margin-right:8px;}
  .rp-wi-status{font-size:12px;color:${v['--status']};margin-top:6px;}
  .rp-empty{color:${v['--muted']};}
  .rp-muted{color:${v['--muted']};}
  img{max-width:100%;border-radius:${v['--radius']};display:block;margin:8px 0;}
  ${printOverride}`;
}
