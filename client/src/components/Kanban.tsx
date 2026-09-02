import { useState } from 'react';

const STATUS_LABELS: Record<string, string> = { blank: '未填写', stale: '未更新', done: '已更新' };
const FILTERS = ['all', 'blank', 'stale', 'done'] as const;
type Filter = (typeof FILTERS)[number];

export default function Kanban({ report }: { report: any }) {
  const [filter, setFilter] = useState<Filter>('all');

  // 按筛选条件取某部门下参与统计的工作项
  const pick = (items: any[]) => (filter === 'all' ? items : items.filter((w) => w.status === filter));

  const rows = report.departments.map((d: any) => {
    const vis = pick(d.work_items);
    const total = vis.length;
    const done = vis.filter((w: any) => w.status === 'done').length;
    return { id: d.id, name: d.name, total, done };
  });
  const overallTotal = rows.reduce((s: number, r: any) => s + r.total, 0);
  const overallDone = rows.reduce((s: number, r: any) => s + r.done, 0);

  const pct = (d: number, t: number) => (t ? (d / t) * 100 : 0);

  return (
    <div className="kanban">
      <div className="kb-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`kb-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? '全部' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>
      <div className="kb-row overall">
        <b style={{ width: 120 }}>整体</b>
        <div className="kb-bar"><div className="kb-fill" style={{ width: `${pct(overallDone, overallTotal)}%` }} /></div>
        <span className="kb-count">{overallDone}/{overallTotal}</span>
      </div>
      {rows.map((r: any) => (
        <div className="kb-row" key={r.id}>
          <b style={{ width: 120, fontSize: 13, fontWeight: 400 }}>{r.name}</b>
          <div className="kb-bar"><div className="kb-fill" style={{ width: `${pct(r.done, r.total)}%` }} /></div>
          <span className="kb-count">{r.done}/{r.total}</span>
        </div>
      ))}
      {filter !== 'all' && (
        <div className="kb-hint">当前筛选：{STATUS_LABELS[filter]}（进度条为该状态下 已更新 / 总数）</div>
      )}
    </div>
  );
}
