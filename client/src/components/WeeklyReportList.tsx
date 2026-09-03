import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { api, downloadExport } from '../api';
import { useAuth } from '../auth';
import { useDialog } from './Dialog';
import Icon from './icons';
import UserManagement from './UserManagement';

// 编辑器含 Tiptap/Yjs/y-websocket/prosemirror，体积大，按需懒加载以缩减首屏
const WeeklyReportEditor = lazy(() => import('./WeeklyReportEditor'));

const statusText: Record<string, string> = {
  draft: '草稿',
  collecting: '收集中',
  published: '已发布',
};

const statusNext: Record<string, { label: string; to: string }> = {
  draft: { label: '开始收集', to: 'collecting' },
  collecting: { label: '发布周报', to: 'published' },
};

function formatDate(iso?: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readInitialSelected() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('report');
  if (fromUrl) return Number(fromUrl) || null;
  const saved = localStorage.getItem('wr_last_report_id');
  return saved ? Number(saved) || null : null;
}

export default function WeeklyReportList() {
  const { user, logout } = useAuth();
  const dialog = useDialog();
  const [reports, setReports] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(readInitialSelected);
  const [q, setQ] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'collecting' | 'published'>('all');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [showUsers, setShowUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [initialReport, setInitialReport] = useState<any>(null);
  const [themes, setThemes] = useState<Array<{ key: string; label: string }>>([{ key: 'classic', label: '经典蓝紫' }]);
  const [exportTheme, setExportTheme] = useState('classic');

  useEffect(() => {
    api.listReports()
      .then(setReports)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
    api.listThemes().then(setThemes).catch(() => { /* 用默认主题兜底 */ });
  }, []);

  // 打开/返回时同步 URL 与 localStorage，刷新可停留在子页
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected !== null) {
      url.searchParams.set('report', String(selected));
      localStorage.setItem('wr_last_report_id', String(selected));
    } else {
      url.searchParams.delete('report');
      localStorage.removeItem('wr_last_report_id');
    }
    window.history.replaceState({}, '', url);
  }, [selected]);

  // 若 URL/localStorage 里的 report 已不存在（被删除），自动回到列表
  useEffect(() => {
    if (!loading && selected !== null && !reports.some((r) => r.id === selected)) {
      setSelected(null);
    }
  }, [loading, reports, selected]);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const r = await api.createReport({});
      setReports((prev) => [r, ...prev]); // 乐观更新：列表立即出现新周报
      setInitialReport(r);                // 用完整报告作为编辑器首屏数据，跳过等待
      setSelected(r.id);
    } catch (err: any) {
      dialog.confirm({ title: '创建失败', message: err?.message || '请重试', confirmText: '知道了' });
    } finally {
      setCreating(false);
    }
  };
  const copyFrom = async (id: any) => {
    try {
      const nr = await api.copyLast(id, {});
      setSelected(nr.id);
    } catch (err: any) {
      dialog.confirm({ title: '复制失败', message: err?.message || '请重试', confirmText: '知道了' });
    }
  };
  const publish = (r: any) => {
    const next = statusNext[r.status];
    if (!next) return;
    api.publish(r.id, next.to)
      .then(() => api.listReports().then(setReports))
      .catch((e: any) => dialog.confirm({ title: '发布失败', message: e?.message || '请重试', confirmText: '知道了' }));
  };
  const del = async (r: any) => {
    if (await dialog.confirm({ title: '删除周报', message: `确认删除周报「${r.title || r.period_label}」？此操作不可撤销。`, confirmText: '删除', danger: true })) {
      api.deleteReport(r.id).then(() => api.listReports().then(setReports));
    }
  };
  const exp = async (r: any, type: 'html' | 'pdf' | 'eml') => {
    try {
      let to: string | undefined;
      if (type === 'eml') {
        const res = await dialog.prompt({ title: '邮件发送', placeholder: '收件人邮箱（可留空）', allowEmpty: true });
        if (res === null) return;
        to = res || undefined;
      }
      await downloadExport(r.id, type, to, exportTheme);
    } catch (e: any) {
      dialog.confirm({ title: '导出失败', message: e?.message || '请重试', confirmText: '知道了' });
    }
  };

  const stats = useMemo(() => ({
    all: reports.length,
    draft: reports.filter((r) => r.status === 'draft').length,
    collecting: reports.filter((r) => r.status === 'collecting').length,
    published: reports.filter((r) => r.status === 'published').length,
  }), [reports]);

  const shown = useMemo(() => {
    return reports.filter((r) => {
      const matchQ = !q || (r.period_label + r.title).includes(q);
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      return matchQ && matchStatus;
    });
  }, [reports, q, filterStatus]);

  if (selected !== null) {
    return (
      <Suspense fallback={<div className="container loading">加载编辑器…</div>}>
        <WeeklyReportEditor
          reportId={selected}
          initialReport={initialReport}
          onBack={() => { setSelected(null); setInitialReport(null); api.listReports().then(setReports); }}
          onReportChange={(id: any) => setSelected(id)}
        />
      </Suspense>
    );
  }

  const isAdmin = user.role === 'admin';
  const statusKeys: Array<'all' | 'draft' | 'collecting' | 'published'> = ['all', 'draft', 'collecting', 'published'];

  return (
    <div>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">周</div>
          <h2>周报协作平台</h2>
        </div>
        <div className="spacer" />
        <span className="user-chip"><b>{user.display_name}</b> · {user.role}</span>
        {isAdmin && <button className="primary" onClick={create} disabled={creating}><Icon name="plus" size={15} /> {creating ? '创建中…' : '新建周报'}</button>}
        {isAdmin && <button className="ghost" onClick={() => setShowUsers(true)}><Icon name="user" size={15} /> 用户管理</button>}
        <button className="ghost" onClick={logout} aria-label="退出登录"><Icon name="logout" /> 退出</button>
      </div>

      <div className="dashboard">
        <div className="page-header">
          <div>
            <h1>周报列表</h1>
            <p className="subtitle">管理团队周报周期、协作编辑与导出发布</p>
          </div>
        </div>

        {err && <div className="err" role="alert">{err}</div>}

        <div className="stats-bar" role="tablist" aria-label="状态筛选">
          {statusKeys.map((s) => (
            <button
              key={s}
              className={`stat-card ${filterStatus === s ? 'active' : ''}`}
              onClick={() => setFilterStatus(s)}
              aria-pressed={filterStatus === s}
              role="tab"
            >
              <div className="stat-num">{stats[s]}</div>
              <div className="stat-label">{s === 'all' ? '全部周报' : statusText[s]}</div>
            </button>
          ))}
        </div>

        <div className="toolbar-row">
          <div className="search">
            <Icon name="search" size={15} />
            <input placeholder="搜索周期 / 标题" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜索周报" />
          </div>
          <div className="filters">
            {statusKeys.map((s) => (
              <button key={s} className={filterStatus === s ? 'active' : ''} onClick={() => setFilterStatus(s)}>
                {s === 'all' ? '全部' : statusText[s]}
              </button>
            ))}
          </div>
          <label className="theme-pick" title="选择导出（HTML/PDF/邮件）的视觉风格">
            <span>导出风格</span>
            <select value={exportTheme} onChange={(e) => setExportTheme(e.target.value)} aria-label="导出风格">
              {themes.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>

        {loading && (
          <div className="report-list">
            {[1, 2, 3].map((i) => (
              <div className="report-row skeleton-row" key={i}>
                <div className="skeleton" style={{ width: '30%', height: 18 }} />
                <div className="skeleton" style={{ width: '20%', height: 18, marginLeft: 'auto' }} />
              </div>
            ))}
          </div>
        )}

        {!loading && !err && shown.length === 0 && (
          <div className="empty">
            <div className="empty-emoji">📋</div>
            <div><b>没有找到周报</b></div>
            <div style={{ marginTop: 6 }}>{q || filterStatus !== 'all' ? '调整筛选条件或' : '点击右上角「新建周报」开始'}创建第一份协作周报。</div>
          </div>
        )}

        {!loading && shown.length > 0 && (
          <div className="report-list">
            {shown.map((r) => (
              <div className="report-row" key={r.id}>
                <div className="row-main">
                  <div className="row-top">
                    <span className="period">{r.period_label}</span>
                    <span className={`badge ${r.status}`}>{statusText[r.status] || r.status}</span>
                    <span className="row-date" title={r.updated_at}><Icon name="clock" size={13} /> 更新于 {formatDate(r.updated_at)}</span>
                  </div>
                  <div className="row-title">{r.title || '（未填写标题）'}</div>
                </div>
                <div className="row-actions">
                  {isAdmin && r.status !== 'published' && (
                    <button className="secondary" onClick={() => publish(r)}>
                      <Icon name="send" size={14} /> {statusNext[r.status]?.label || '流转'}
                    </button>
                  )}
                  <button className="primary" onClick={() => setSelected(r.id)}>
                    <Icon name="edit" size={14} /> 打开
                  </button>
                  <div className="icon-group">
                    {isAdmin && <button className="icon-btn" title="复制为模板" onClick={() => copyFrom(r.id)} aria-label="复制为模板"><Icon name="copy" size={16} /></button>}
                    <button className="icon-btn" title="导出 HTML" onClick={() => exp(r, 'html')} aria-label="导出 HTML"><Icon name="doc" size={16} /></button>
                    <button className="icon-btn" title="导出 PDF" onClick={() => exp(r, 'pdf')} aria-label="导出 PDF"><Icon name="pdf" size={16} /></button>
                    <button className="icon-btn" title="邮件发送" onClick={() => exp(r, 'eml')} aria-label="邮件发送"><Icon name="mail" size={16} /></button>
                    {isAdmin && <button className="icon-btn danger" title="删除" onClick={() => del(r)} aria-label="删除"><Icon name="trash" size={16} /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showUsers && <UserManagement onClose={() => setShowUsers(false)} />}
    </div>
  );
}
