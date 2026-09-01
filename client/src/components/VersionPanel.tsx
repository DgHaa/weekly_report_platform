import { useState, useEffect } from 'react';
import { api } from '../api';
import Icon from './icons';

export default function VersionPanel({ reportId, onRestored }: { reportId: any; onRestored?: () => void }) {
  const [versions, setVersions] = useState<any[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [diff, setDiff] = useState<any>(null);
  const [note, setNote] = useState('');

  const load = () => api.listVersions(reportId).then(setVersions);
  useEffect(() => { load(); }, [reportId]);

  const save = async () => { await api.saveVersion(reportId, note); setNote(''); load(); };
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-2)));
  const compare = async () => {
    if (sel.length !== 2) return;
    const r = await api.compareVersions(reportId, sel[0], sel[1]);
    setDiff(r);
  };
  const restore = async (id: number) => {
    if (!confirm('恢复该版本将覆盖当前内容，确定？')) return;
    await api.restoreVersion(reportId, id);
    setDiff(null); setSel([]); load(); onRestored?.();
  };

  return (
    <div className="version-panel">
      <div className="section-title"><span className="si"><Icon name="history" size={16} /></span>版本管理</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input placeholder="版本备注" value={note} onChange={(e) => setNote(e.target.value)} aria-label="版本备注" />
        <button className="primary" onClick={save}><Icon name="plus" /> 保存快照</button>
        <button onClick={compare} disabled={sel.length !== 2}><Icon name="layers" /> 对比(2)</button>
      </div>
      {versions.map((v) => (
        <div className="version-item" key={v.id}>
          <input type="checkbox" checked={sel.includes(v.id)} onChange={() => toggle(v.id)} aria-label={`选择版本 v${v.version_no}`} />
          <span className="vno">v{v.version_no}</span>
          <span className="vmeta">{v.created_at}</span>
          <span className="vnote">{v.note}</span>
          <button className="danger vrestore" onClick={() => restore(v.id)}><Icon name="history" /> 恢复</button>
        </div>
      ))}
      {diff && (
        <div style={{ marginTop: 8 }}>
          {diff.diffs.length === 0 && <div className="diff">两个版本无差异</div>}
          {diff.diffs.map((d: any, i: number) => (
            <div className="diff" key={i}>
              [{d.department}] {d.work_item} · {d.field}：<br />
              <del>{String(d.from || '').slice(0, 100)}</del> → <ins>{String(d.to || '').slice(0, 100)}</ins>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
