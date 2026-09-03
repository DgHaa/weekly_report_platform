import { useState, useEffect } from 'react';
import { api } from '../api';
import Icon from './icons';
import { useDialog } from './Dialog';

export default function VersionPanel({ reportId, onRestored }: { reportId: any; onRestored?: () => void }) {
  const dialog = useDialog();
  const [versions, setVersions] = useState<any[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [diff, setDiff] = useState<any>(null);
  const [note, setNote] = useState('');

  const load = () => api.listVersions(reportId).then(setVersions);
  useEffect(() => { load(); }, [reportId]);

  const save = async () => {
    try {
      await api.saveVersion(reportId, note);
      setNote(''); load();
    } catch (e: any) {
      dialog.confirm({ title: '保存快照失败', message: e?.message || '请重试', confirmText: '知道了' });
    }
  };
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-2)));
  const compare = async () => {
    if (sel.length !== 2) return;
    try {
      const r = await api.compareVersions(reportId, sel[0], sel[1]);
      setDiff(r);
    } catch (e: any) {
      dialog.confirm({ title: '对比失败', message: e?.message || '请重试', confirmText: '知道了' });
    }
  };
  const restore = async (id: number) => {
    if (!await dialog.confirm({ title: '恢复版本', message: '恢复该版本将覆盖当前内容，且会留下一条编辑记录。确定继续？', confirmText: '恢复', danger: true })) return;
    try {
      await api.restoreVersion(reportId, id);
      setDiff(null); setSel([]); load(); onRestored?.();
    } catch (e: any) {
      dialog.confirm({ title: '恢复失败', message: e?.message || '请重试', confirmText: '知道了' });
    }
  };

  return (
    <div className="version-panel">
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
              <div className="diff-head">[{d.department}] {d.work_item} · {d.field}</div>
              <div className="diff-body">
                <del>{String(d.from || '')}</del>
                <span className="diff-arrow">→</span>
                <ins>{String(d.to || '')}</ins>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
