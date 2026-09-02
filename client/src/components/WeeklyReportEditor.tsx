import { useEffect, useState, useRef, useMemo } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { api, downloadExport, getExportHtml } from '../api';
import { useAuth } from '../auth';
import { useDialog } from './Dialog';
import Kanban from './Kanban';
import VersionPanel from './VersionPanel';
import EditHistoryPanel from './EditHistoryPanel';
import RichTextEditor from './RichTextEditor';
import Icon from './icons';

const STATUS_LABEL: any = { blank: '未填写', stale: '未更新', done: '已更新' };
const REPORT_STATUS_LABEL: any = { draft: '草稿', collecting: '收集中', published: '已发布' };

// 把独立导出 HTML 的 :root / body 作用域收敛到 .theme-preview，注入编辑器预览区（保留主题变量与排版）
function transformPreviewHtml(htmlText: string): string {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  const styleEl = doc.querySelector('style');
  let css = styleEl ? styleEl.textContent || '' : '';
  css = css
    .replace(/:root\s*\{/, '.theme-preview{')
    .replace(/\bbody\s*\{/, '.theme-preview{');
  const body = doc.body ? doc.body.innerHTML : '';
  return `<style>${css}</style><div class="theme-preview">${body}</div>`;
}

export default function WeeklyReportEditor({ reportId, onBack, onReportChange }: { reportId: any; onBack: () => void; onReportChange: (id: any) => void }) {
  const { user } = useAuth();
  const dialog = useDialog();
  const [report, setReport] = useState<any>(null);
  const [collab, setCollab] = useState<{ ydoc: Y.Doc; provider: any } | null>(null);
  const [filter, setFilter] = useState('all');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [toast, setToast] = useState<{ id: number; msg: string; kind: 'ok' | 'err' } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<any>(null);
  const [themes, setThemes] = useState<any[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'versions' | 'history'>('versions');
  const [peers, setPeers] = useState<{ name: string; color: string; isSelf: boolean }[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const scrollPos = useRef<Record<string, number>>({});

  useEffect(() => {
    const ydoc = new Y.Doc();
    const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
    const provider = new WebsocketProvider(`${wsProto}://${location.host}/collab`, String(reportId), ydoc);
    ydocRef.current = ydoc;
    providerRef.current = provider;
    setCollab({ ydoc, provider });
    api.getReport(reportId).then(setReport);
    api.listThemes().then(setThemes).catch(() => {});
    return () => { provider.destroy(); ydoc.destroy(); };
  }, [reportId]);

  // 在线协作成员（来自 y-websocket awareness）
  useEffect(() => {
    if (!collab) return;
    const update = () => {
      const aw = collab.provider.awareness;
      const localId = aw.clientID;
      // 按用户名去重；同名时优先保留"自己"这一条
      const byName = new Map<string, { name: string; color: string; isSelf: boolean }>();
      (Array.from(aw.getStates().entries()) as [number, any][]).forEach(([id, s]) => {
        const name = s?.user?.name || '匿名';
        const color = s?.user?.color || '#888780';
        const isSelf = id === localId;
        const existing = byName.get(name);
        if (!existing || (isSelf && !existing.isSelf)) byName.set(name, { name, color, isSelf });
      });
      setPeers(Array.from(byName.values()));
    };
    update();
    collab.provider.awareness.on('change', update);
    return () => collab.provider.awareness.off('change', update);
  }, [collab]);

  // 预览态：拉取真实导出 HTML 并注入预览区（带主题配色与目录锚点），切换风格即时刷新
  useEffect(() => {
    if (mode !== 'preview' || !report) { setPreviewHtml(null); return; }
    let cancelled = false;
    setPreviewHtml(null);
    getExportHtml(report.id, report.theme)
      .then((text) => { if (!cancelled) setPreviewHtml(transformPreviewHtml(text)); })
      .catch(() => { if (!cancelled) setPreviewHtml('<div class="muted-empty">预览生成失败，请重试</div>'); });
    return () => { cancelled = true; };
  }, [mode, report?.theme, reportId]);

  // 编辑↔预览切换：保留各自滚动位置
  useEffect(() => {
    const y = scrollPos.current[mode] || 0;
    const id = window.setTimeout(() => window.scrollTo({ top: y, behavior: 'auto' }), 60);
    return () => window.clearTimeout(id);
  }, [mode]);

  // 点击空白处关闭移动端「更多」菜单
  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: any) => { if (!e.target.closest('.topbar-actions')) setMoreOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [moreOpen]);

  const refresh = () => api.getReport(reportId).then(setReport);

  const showToast = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setToast({ id, msg, kind });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast((t) => (t && t.id === id ? null : t));
    }, 3500);
  };

  const savedLabel = (body: any) => {
    if ('title' in body) return '标题';
    if ('status' in body) return '状态';
    if ('progress_html' in body) return '本周进展';
    if ('plan_html' in body) return '下周计划';
    return '内容';
  };

  const patchWI = async (wid: number, body: any) => {
    const label = savedLabel(body);
    try {
      await api.patchWorkItem(wid, body);
    } catch (e: any) {
      showToast(`保存失败：${e?.message || '请重试'}`, 'err');
      return;
    }
    setReport((r: any) => {
      if (!r) return r;
      const n = { ...r };
      n.departments = r.departments.map((d: any) => ({
        ...d,
        work_items: d.work_items.map((w: any) => {
          if (w.id !== wid) return w;
          const status = body.status !== undefined
            ? body.status
            : body.progress_html !== undefined && (w.status === 'blank' || w.status === 'stale')
              ? 'done'
              : w.status;
          return { ...w, ...body, status };
        })
      }));
      return n;
    });
    showToast(`${label}已保存`);
  };

  const renameWI = (dId: number, wId: number, val: string) => {
    setReport((r: any) => ({
      ...r,
      departments: r.departments.map((dd: any) =>
        dd.id === dId
          ? { ...dd, work_items: dd.work_items.map((ww: any) => (ww.id === wId ? { ...ww, title: val } : ww)) }
          : dd
      ),
    }));
  };

  const saveReportField = async (body: any, label: string) => {
    try {
      await api.patchReport(report.id, body);
    } catch (e: any) {
      showToast(`保存失败：${e?.message || '请重试'}`, 'err');
      return;
    }
    setReport((r: any) => ({ ...r, ...body }));
    showToast(`${label}已保存`);
  };

  const saveDeptField = async (did: number, body: any, label: string) => {
    try {
      await api.patchDept(did, body);
    } catch (e: any) {
      showToast(`保存失败：${e?.message || '请重试'}`, 'err');
      return;
    }
    setReport((r: any) => ({ ...r, departments: r.departments.map((dd: any) => dd.id === did ? { ...dd, ...body } : dd) }));
    showToast(`${label}已保存`);
  };

  const addDept = async () => {
    const n = await dialog.prompt({ title: '新增部门', placeholder: '部门名称', message: '请输入部门名称' });
    if (n === null) return;
    await api.addDept(report.id, n);
    refresh();
  };
  const delDept = async (did: number, name: string) => {
    if (await dialog.confirm({ title: '删除部门', message: `确认删除部门「${name}」及其下所有工作项？此操作不可撤销。`, confirmText: '删除', danger: true })) {
      await api.delDept(report.id, did);
      refresh();
    }
  };
  const addWorkItem = async (did: number) => {
    const t = await dialog.prompt({ title: '新增工作项', placeholder: '工作项标题' });
    if (t === null) return;
    await api.addWorkItem(did, t);
    refresh();
  };
  const delWorkItem = async (wid: number, title: string) => {
    if (await dialog.confirm({ title: '删除工作项', message: `确认删除工作项「${title || '未命名'}」？`, confirmText: '删除', danger: true })) {
      await api.delWorkItem(wid);
      refresh();
    }
  };

  // 关键专项进展：多条，每条一个可编辑框
  const addSpecial = async () => {
    const t = await dialog.prompt({ title: '新增专项进展', placeholder: '专项标题（可留空）', allowEmpty: true });
    if (t === null) return;
    await api.addSpecial(report.id, { title: t });
    refresh();
  };
  const delSpecial = async (sid: number, title: string) => {
    if (await dialog.confirm({ title: '删除专项进展', message: `确认删除专项「${title || '未命名'}」？`, confirmText: '删除', danger: true })) {
      await api.delSpecial(report.id, sid);
      refresh();
    }
  };
  const patchSpecial = async (sid: number, body: any) => {
    try { await api.patchSpecial(report.id, sid, body); }
    catch (e: any) { showToast(`保存失败：${e?.message || '请重试'}`, 'err'); return; }
    setReport((r: any) => ({ ...r, special_progress: (r.special_progress || []).map((s: any) => s.id === sid ? { ...s, ...body } : s) }));
  };
  const moveSpecial = async (sid: number, dir: number) => {
    const list = report.special_progress || [];
    const i = list.findIndex((s: any) => s.id === sid);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    await Promise.all([
      api.patchSpecial(report.id, a.id, { sort_order: b.sort_order }),
      api.patchSpecial(report.id, b.id, { sort_order: a.sort_order }),
    ]);
    refresh();
  };

  const publish = async () => {
    const to = report.status === 'draft' ? 'collecting' : 'published';
    await api.publish(report.id, to);
    try { await api.saveVersion(report.id, `自动快照 · ${REPORT_STATUS_LABEL[to] || to}`); } catch { /* 快照失败不影响发布 */ }
    refresh();
    showToast(`已${REPORT_STATUS_LABEL[to] || to}`);
  };

  const copyLast = async () => {
    const nr = await api.copyLast(report.id, {});
    onReportChange(nr.id);
  };

  const doExport = async (type: 'html' | 'pdf' | 'eml') => {
    try {
      let to: string | undefined;
      if (type === 'eml') {
        const r = await dialog.prompt({ title: '邮件发送', placeholder: '收件人邮箱（可留空）', allowEmpty: true });
        if (r === null) return;
        to = r || undefined;
      }
      await downloadExport(report.id, type, to, report.theme);
      showToast('导出已生成');
    } catch (e: any) { showToast(`导出失败：${e?.message || '请重试'}`, 'err'); }
  };

  // 切换导出风格：持久化到该周报，并即时刷新预览
  const changeTheme = async (key: string) => {
    try {
      await api.patchReport(report.id, { theme: key });
    } catch (e: any) {
      showToast(`保存失败：${e?.message || '请重试'}`, 'err');
      return;
    }
    setReport((r: any) => ({ ...r, theme: key }));
    showToast('导出风格已更新');
  };

  // 关键专项进展：由数据模型（report.special_progress）驱动目录子项，id 稳定为 sec-high-{sp.id}
  const spList = report?.special_progress || [];

  // 左侧目录：三大模块 + 各部门工作展示（含每个工作项作为子项）
  const tocItems = useMemo(() => {
    const items: { id: string; label: string; group?: string; sub?: boolean }[] = [
      { id: 'sec-core', label: '一句话核心进展' },
      { id: 'sec-highlights', label: '关键专项进展' },
    ];
    spList.forEach((s: any) =>
      items.push({ id: `sec-high-${s.id}`, label: s.title || '（未命名专项）', sub: true })
    );
    (report?.departments || []).forEach((d: any) => {
      const wis: any[] = mode === 'preview'
        ? d.work_items
        : (filter === 'all' ? d.work_items : d.work_items.filter((w: any) => w.status === filter));
      const deptVisible = mode === 'preview' || filter === 'all' || wis.length > 0;
      if (!deptVisible) return;
      items.push({ id: `sec-dep-${d.id}`, label: d.name, group: '部门工作展示' });
      wis.forEach((w: any) =>
        items.push({ id: `sec-wi-${w.id}`, label: w.title || '（无标题）', sub: true })
      );
    });
    return items;
  }, [report?.departments, mode, filter, spList]);

  const [activeId, setActiveId] = useState('');
  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  useEffect(() => {
    if (!report) return;
    let obs: IntersectionObserver | null = null;
    const setup = () => {
      obs?.disconnect();
      const els = tocItems
        .map((t) => document.getElementById(t.id))
        .filter(Boolean) as HTMLElement[];
      if (!els.length) return;
      obs = new IntersectionObserver(
        (entries) => {
          const vis = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (vis.length) setActiveId(vis[0].target.id);
        },
        { rootMargin: '-90px 0px -60% 0px', threshold: 0 }
      );
      els.forEach((el) => obs!.observe(el));
    };
    setup();
    const retry = window.setTimeout(setup, 240);
    return () => { obs?.disconnect(); window.clearTimeout(retry); };
  }, [report, tocItems]);

  if (!report) return <div className="container">加载中…</div>;

  const publishLabel = report.status === 'draft' ? '开始收集' : report.status === 'collecting' ? '发布' : '已发布';

  const blurOnEnter = (e: any) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); };

  const switchMode = (next: 'edit' | 'preview') => {
    scrollPos.current[mode] = window.scrollY;
    setMode(next);
  };

  return (
    <div>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">周</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="ghost" onClick={onBack}><Icon name="back" /> 返回</button>
            <input className="title-input" value={report.period_label} onChange={(e) => setReport({ ...report, period_label: e.target.value })} onBlur={() => api.patchReport(report.id, { period_label: report.period_label })} onKeyDown={blurOnEnter} aria-label="周期标识" />
            <input className="title-input grow" value={report.title} placeholder="周报标题" onChange={(e) => setReport({ ...report, title: e.target.value })} onBlur={() => api.patchReport(report.id, { title: report.title })} onKeyDown={blurOnEnter} aria-label="周报标题" />
            <span className={`badge ${report.status}`}>{report.status}</span>
          </div>
        </div>
        <div className="topbar-actions">
          {user.role === 'admin' && report.status !== 'published' && (
            <button className="primary" onClick={publish}><Icon name="send" /> {publishLabel}</button>
          )}
          <div className="presence" title={`${peers.length} 人正在协作`}>
            {peers.slice(0, 5).map((p) => (
              <span key={p.name} className={`avatar ${p.isSelf ? 'is-self' : ''}`} style={{ background: p.color }} title={`${p.name}${p.isSelf ? '（你）' : ''}`}>
                {p.name.slice(0, 1)}
                {p.isSelf && <span className="self-dot" />}
              </span>
            ))}
            {peers.length > 5 && <span className="avatar more">+{peers.length - 5}</span>}
          </div>
          <button className="more-btn" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} aria-label="更多操作">更多 ▾</button>
          <div className={`secondary-actions ${moreOpen ? 'open' : ''}`} onClick={() => setMoreOpen(false)}>
            <label className="theme-pick" title="导出风格（在预览中即时查看，并随报告保存）">
              <Icon name="spark" size={15} />
              <select value={report.theme || 'classic'} onChange={(e) => changeTheme(e.target.value)} aria-label="导出风格">
                {(themes.length ? themes : [{ key: 'classic', label: '经典蓝紫' }]).map((t: any) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </label>
            <button onClick={copyLast} title="复制上一周期内容作为本次底稿"><Icon name="copy" /> 复制上期</button>
            <button onClick={() => doExport('html')}><Icon name="doc" /> HTML</button>
            <button onClick={() => doExport('pdf')}><Icon name="pdf" /> PDF</button>
            <button onClick={() => doExport('eml')}><Icon name="mail" /> 邮件</button>
            <button className={mode === 'preview' ? 'primary' : ''} onClick={() => switchMode(mode === 'preview' ? 'edit' : 'preview')}><Icon name="eye" /> {mode === 'preview' ? '编辑' : '预览'}</button>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="editor-layout">
          <EditorToc items={tocItems} activeId={activeId} onJump={jumpTo} />
          <div className="editor-main">
            {mode === 'preview' ? (
          <div className="preview-report">
            {previewHtml
              ? <div className="theme-preview-wrap" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              : <div className="muted-empty">正在生成预览…</div>}
          </div>
        ) : (
          <>
            <Kanban report={report} />

            <div className="filters" style={{ marginBottom: 12 }}>
              {['all', 'blank', 'stale', 'done'].map((f) => (
                <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                  {f === 'all' ? '全部' : STATUS_LABEL[f]}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>筛选仅作用于下方「工作展示」</span>
            </div>

            {/* 模块一：一句话核心进展（按部门，置顶） */}
            <section className="edit-module" id="sec-core">
              <h2 className="module-title"><span className="dep-icon"><Icon name="bulb" size={18} /></span>一句话核心进展</h2>
              <p className="module-hint">按部门对各当前工作进行一句话描述与梳理</p>
              {report.departments.length === 0 && <p className="muted-empty">暂无部门</p>}
              {report.departments.map((d: any) => (
                <div className="dep" key={d.id}>
                  <div className="dep-head">
                    <h3><span className="dep-icon"><Icon name="layers" size={16} /></span>{d.name}</h3>
                    {user.role === 'admin' && <button className="danger" onClick={() => delDept(d.id, d.name)}><Icon name="trash" /> 删部门</button>}
                  </div>
                  {collab && (
                    <RichTextEditor ydoc={collab.ydoc} provider={collab.provider} field={`dep-${d.id}-core`} workItemId={d.id} weeklyReportId={report.id} initialHTML={d.core_html || ''} userName={user.display_name} onSave={(h) => saveDeptField(d.id, { core_html: h }, '核心进展')} />
                  )}
                </div>
              ))}
              <div style={{ marginTop: 8 }}><button onClick={addDept}><Icon name="plus" /> 部门</button></div>
            </section>

            {/* 模块二：关键专项进展（多条，每条一个可编辑框，可增删/排序） */}
            <section className="edit-module" id="sec-highlights">
              <h2 className="module-title"><span className="dep-icon"><Icon name="star" size={18} /></span>关键专项进展</h2>
              <p className="module-hint">本周最重要的多项关键工作，逐条添加；每条可单独撰写并插入图片</p>
              {report.special_progress.length === 0 && <p className="muted-empty">暂无专项进展，点击下方「专项进展」按钮添加</p>}
              {report.special_progress.map((s: any, idx: number) => (
                <article className="sp" key={s.id} id={`sec-high-${s.id}`}>
                  <div className="sp-head">
                    <input className="sp-title" value={s.title} placeholder="专项标题（如：AI 辅助录单上线）" onChange={(e) => setReport((r: any) => ({ ...r, special_progress: (r.special_progress || []).map((x: any) => x.id === s.id ? { ...x, title: e.target.value } : x) }))} onBlur={() => patchSpecial(s.id, { title: s.title })} />
                    <div className="sp-actions">
                      <button className="ghost" disabled={idx === 0} onClick={() => moveSpecial(s.id, -1)} title="上移">↑</button>
                      <button className="ghost" disabled={idx === report.special_progress.length - 1} onClick={() => moveSpecial(s.id, 1)} title="下移">↓</button>
                      {user.role === 'admin' && <button className="danger" onClick={() => delSpecial(s.id, s.title)}><Icon name="trash" size={14} /> 删</button>}
                    </div>
                  </div>
                  {collab && (
                    <RichTextEditor ydoc={collab.ydoc} provider={collab.provider} field={`sp-${s.id}-content`} workItemId={s.id} weeklyReportId={report.id} initialHTML={s.content_html || ''} userName={user.display_name} onSave={(h) => patchSpecial(s.id, { content_html: h })} />
                  )}
                </article>
              ))}
              <div style={{ marginTop: 8 }}><button onClick={addSpecial}><Icon name="plus" /> 专项进展</button></div>
            </section>

            {/* 模块三：每个部门的工作展示（详细底稿） */}
            {report.departments.map((d: any) => {
              const items = filter === 'all' ? d.work_items : d.work_items.filter((w: any) => w.status === filter);
              if (filter !== 'all' && items.length === 0) return null;
              return (
                <section className="edit-module" key={`edit-wi-${d.id}`} id={`sec-dep-${d.id}`}>
                  <h2 className="module-title"><span className="dep-icon"><Icon name="layers" size={18} /></span>{d.name} · 工作展示</h2>
                  {items.map((w: any) => (
                    <div className="wi" key={w.id} id={`sec-wi-${w.id}`}>
                      <div className="wi-head">
                        <input className="wi-title" value={w.title} onChange={(e) => renameWI(d.id, w.id, e.target.value)} onBlur={() => patchWI(w.id, { title: w.title })} />
                        <select className="status-select" value={w.status} onChange={(e) => patchWI(w.id, { status: e.target.value })}>
                          <option value="blank">未填写</option>
                          <option value="stale">未更新</option>
                          <option value="done">已更新</option>
                        </select>
                        <button className="danger" onClick={() => delWorkItem(w.id, w.title)}>删</button>
                      </div>
                      <div className="lbl" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>本周进展</div>
                      {collab && (
                        <RichTextEditor ydoc={collab.ydoc} provider={collab.provider} field={`wi-${w.id}-progress`} workItemId={w.id} weeklyReportId={report.id} initialHTML={w.progress_html} userName={user.display_name} onSave={(h) => patchWI(w.id, { progress_html: h })} />
                      )}
                      <div className="lbl" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>下周计划</div>
                      {collab && (
                        <RichTextEditor ydoc={collab.ydoc} provider={collab.provider} field={`wi-${w.id}-plan`} workItemId={w.id} weeklyReportId={report.id} initialHTML={w.plan_html} userName={user.display_name} onSave={(h) => patchWI(w.id, { plan_html: h })} />
                      )}
                    </div>
                  ))}
                  <button style={{ marginTop: 8 }} onClick={() => addWorkItem(d.id)}><Icon name="plus" /> 工作项</button>
                </section>
              );
            })}

            <div className="bottom-tabs">
              <div className="btab-head">
                <button className={bottomTab === 'versions' ? 'active' : ''} onClick={() => setBottomTab('versions')}>
                  <Icon name="history" size={15} /> 版本管理
                </button>
                <button className={bottomTab === 'history' ? 'active' : ''} onClick={() => setBottomTab('history')}>
                  <Icon name="clock" size={15} /> 编辑记录
                </button>
              </div>
              {bottomTab === 'versions'
                ? <VersionPanel reportId={report.id} onRestored={refresh} />
                : <EditHistoryPanel reportId={report.id} />}
            </div>
          </>
          )}
          </div>
        </div>
      </div>
      {toast && (
        <div className={`toast ${toast.kind}`} key={toast.id} role="status" aria-live="polite">
          <Icon name={toast.kind === 'ok' ? 'check' : 'warn'} size={16} />
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

/* 左侧固定目录：点击平滑定位到对应章节，并高亮当前可见章节 */
function EditorToc({ items, activeId, onJump }: { items: { id: string; label: string; group?: string; sub?: boolean }[]; activeId: string; onJump: (id: string) => void }) {
  return (
    <nav className="editor-toc" aria-label="章节目录">
      <div className="toc-title">目录</div>
      <ul>
        {items.map((it, i) => {
          const prevNonSub = items.slice(0, i).reverse().find((x) => !x.sub);
          const showGroup = !!it.group && (!prevNonSub || prevNonSub.group !== it.group);
          return (
            <li key={it.id}>
              {showGroup && <span className="toc-group-label">{it.group}</span>}
              <a
                href={`#${it.id}`}
                className={`toc-link ${it.sub ? 'toc-sub' : ''} ${activeId === it.id ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); onJump(it.id); }}
                title={it.label}
              >
                {it.sub && <span className="toc-dot" />}
                <span className="toc-sub-label">{it.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
