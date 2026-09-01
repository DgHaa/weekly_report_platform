export default function Kanban({ report }: { report: any }) {
  const total = report.departments.reduce((s: number, d: any) => s + d.work_items.length, 0);
  const done = report.departments.reduce((s: number, d: any) => s + d.work_items.filter((w: any) => w.status === 'done').length, 0);
  return (
    <div className="kanban">
      <div className="kb-row overall">
        <b style={{ width: 120 }}>整体</b>
        <div className="kb-bar"><div className="kb-fill" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
        <span className="kb-count">{done}/{total}</span>
      </div>
      {report.departments.map((d: any) => {
        const t = d.work_items.length;
        const dn = d.work_items.filter((w: any) => w.status === 'done').length;
        return (
          <div className="kb-row" key={d.id}>
            <b style={{ width: 120, fontSize: 13, fontWeight: 400 }}>{d.name}</b>
            <div className="kb-bar"><div className="kb-fill" style={{ width: `${t ? (dn / t) * 100 : 0}%` }} /></div>
            <span className="kb-count">{dn}/{t}</span>
          </div>
        );
      })}
    </div>
  );
}
