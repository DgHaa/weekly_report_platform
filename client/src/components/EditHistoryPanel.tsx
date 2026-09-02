import { useState, useEffect } from 'react';
import { api } from '../api';

// 字段/操作的中文标签，把 edit_history 的原始枚举转成可读文案
const FIELD_LABEL: any = {
  report: '周报',
  work_item: '工作项',
  special_progress: '专项进展',
  department: '部门'
};
const ACTION_LABEL: any = {
  create: '新增',
  update: '修改',
  copy: '复制',
  delete: '删除'
};
function actionLabel(a: string): string {
  if (a.startsWith('publish:')) {
    const to = a.split(':')[1];
    return to === 'published' ? '发布' : to === 'collecting' ? '开始收集' : a;
  }
  return ACTION_LABEL[a] || a;
}
// 操作类型 → 配色类（发布单独配色）
function actionClass(a: string): string {
  if (a.startsWith('publish')) return 'h-publish';
  return 'h-' + a;
}

export default function EditHistoryPanel({ reportId }: { reportId: any }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [field, setField] = useState('');
  const [action, setAction] = useState('');

  const load = () => {
    const q: any = {};
    if (field) q.field = field;
    if (action) q.action = action;
    setLoading(true);
    api.getHistory(reportId, q)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [reportId, field, action]);

  return (
    <div className="history-panel">
      <div className="filters" style={{ marginBottom: 10 }}>
        <select value={field} onChange={(e) => setField(e.target.value)} aria-label="按对象筛选">
          <option value="">全部对象</option>
          <option value="report">周报</option>
          <option value="department">部门</option>
          <option value="work_item">工作项</option>
          <option value="special_progress">专项进展</option>
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="按操作筛选">
          <option value="">全部操作</option>
          <option value="create">新增</option>
          <option value="update">修改</option>
          <option value="copy">复制</option>
          <option value="delete">删除</option>
          <option value="publish:collecting">开始收集</option>
          <option value="publish:published">发布</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>
          共 {rows.length} 条
        </span>
      </div>
      {loading ? (
        <div className="muted-empty">加载中…</div>
      ) : rows.length === 0 ? (
        <div className="muted-empty">暂无编辑记录</div>
      ) : (
        <ul className="history-list">
          {rows.map((h) => (
            <li className="history-item" key={h.id}>
              <span className={`h-act ${actionClass(h.action)}`}>{actionLabel(h.action)}</span>
              <span className="h-field">{FIELD_LABEL[h.field] || h.field}</span>
              {h.summary ? <span className="h-summary" title={h.summary}>{h.summary}</span> : null}
              <span className="h-meta">
                {h.operator_name || h.operator_username || '系统'}
                {h.work_item_id ? ` · #${h.work_item_id}` : ''} · {new Date(h.created_at).toLocaleString('zh-CN', { hour12: false })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
