import { useState } from 'react';

const STATUS_LABELS: Record<string, string> = { blank: '未填写', stale: '未更新', done: '已更新' };
// 筛选 chip 文案（pending 为组合筛选：未填写 + 未更新）
const CHIP_LABELS: Record<string, string> = {
  all: '全部',
  blank: '未填写',
  stale: '未更新',
  done: '已更新',
  pending: '只看有进展(未填写+未更新)',
};
const FILTERS = ['all', 'blank', 'stale', 'done', 'pending'] as const;
type Filter = (typeof FILTERS)[number];

export default function Kanban({ report }: { report: any }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  // 按筛选条件取工作项集合
  const pick = (items: any[]) => {
    if (filter === 'all') return items;
    if (filter === 'pending') return items.filter((w) => w.status === 'blank' || w.status === 'stale');
    return items.filter((w) => w.status === filter);
  };

  const toggleDept = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allCollapsed = report.departments.length > 0 && report.departments.every((d: any) => collapsed.has(d.id));
  const setAll = (state: boolean) =>
    setCollapsed(state ? new Set(report.departments.map((d: any) => d.id)) : new Set());

  const rows = report.departments.map((d: any) => {
    const vis = pick(d.work_items);
    const total = vis.length;
    const done = vis.filter((w: any) => w.status === 'done').length;
    return { id: d.id, name: d.name, total, done, isCollapsed: collapsed.has(d.id) };
  });
  const overallTotal = rows.reduce((s: number, r: any) => s + r.total, 0);
  const overallDone = rows.reduce((s: number, r: any) => s + r.done, 0);

  const pct = (d: number, t: number) => (t ? (d / t) * 100 : 0);
  const hintLabel = filter === 'pending' ? '未填写 + 未更新' : STATUS_LABELS[filter];

  return (
    <div className="kanban">
      <div className="kb-filters">
        {FILTERS.map((f) => (
          <button key={f} className={`kb-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {CHIP_LABELS[f]}
          </button>
        ))}
      </div>
      <div className="kb-row overall">
        <b style={{ width: 120 }}>整体</b>
        <div className="kb-bar"><div className="kb-fill" style={{ width: `${pct(overallDone, overallTotal)}%` }} /></div>
        <span className="kb-count">{overallDone}/{overallTotal}</span>
      </div>
      {report.departments.length > 0 && (
        <div className="kb-collapse-all">
          <span className="kb-collapse-tip">点部门名或 ▸ 可折叠该行</span>
          <button className="kb-link" onClick={() => setAll(!allCollapsed)}>
            {allCollapsed ? '全部展开' : '全部折叠'}
          </button>
        </div>
      )}
      {rows.map((r: any) => (
        <div className={`kb-row ${r.isCollapsed ? 'is-collapsed' : ''}`} key={r.id}>
          <button className="kb-collapse" onClick={() => toggleDept(r.id)} title={r.isCollapsed ? '展开' : '折叠'} aria-expanded={!r.isCollapsed}>
            {r.isCollapsed ? '▶' : '▼'}
          </button>
          <b className="kb-dept-name" style={{ width: 108, fontSize: 13, fontWeight: 500 }} onClick={() => toggleDept(r.id)}>
            {r.name}
          </b>
          {!r.isCollapsed && (
            <>
              <div className="kb-bar"><div className="kb-fill" style={{ width: `${pct(r.done, r.total)}%` }} /></div>
              <span className="kb-count">{r.done}/{r.total}</span>
            </>
          )}
          {r.isCollapsed && <span className="kb-collapsed-tag">已折叠</span>}
        </div>
      ))}
      {filter !== 'all' && (
        <div className="kb-hint">当前筛选：{hintLabel}（进度条为该状态下 已更新 / 总数）</div>
      )}
    </div>
  );
}
