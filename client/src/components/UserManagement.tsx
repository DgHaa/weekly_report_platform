import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Icon from './icons';

const ROLE_LABEL: any = { admin: '管理员', filler: '填报人' };

export default function UserManagement({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ username: '', display_name: '', password: '', role: 'filler' });
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ id: number; msg: string; kind: 'ok' | 'err' } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setToast({ id, msg, kind });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast((t) => (t && t.id === id ? null : t));
    }, 3500);
  };

  const load = () => {
    setLoading(true);
    api.listUsers()
      .then(setUsers)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.username.trim() || !form.password) {
      showToast('用户名和密码不能为空', 'err');
      return;
    }
    setCreating(true);
    try {
      await api.createUser({
        username: form.username.trim(),
        display_name: form.display_name.trim() || form.username.trim(),
        password: form.password,
        role: form.role,
      });
      showToast('用户创建成功');
      setForm({ username: '', display_name: '', password: '', role: 'filler' });
      load();
    } catch (e: any) {
      showToast(`创建失败：${e?.message || '请重试'}`, 'err');
    } finally {
      setCreating(false);
    }
  };

  const del = async (u: any) => {
    if (u.id === user.id) { showToast('不能删除当前登录账号', 'err'); return; }
    if (!confirm(`确认删除用户「${u.display_name}」？该操作不可恢复。`)) return;
    try {
      await api.deleteUser(u.id);
      showToast('用户已删除');
      load();
    } catch (e: any) {
      showToast(`删除失败：${e?.message || '请重试'}`, 'err');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal user-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="用户管理">
        <div className="modal-head">
          <h2><span className="dep-icon"><Icon name="user" size={18} /></span>用户管理</h2>
          <button className="ghost icon-only" onClick={onClose} aria-label="关闭"><Icon name="close" /></button>
        </div>

        <div className="modal-body">
          {err && <div className="err" role="alert">{err}</div>}

          <section className="um-form">
            <div className="um-section-header">
              <span className="um-section-icon"><Icon name="plus" size={16} /></span>
              <h3>新增用户</h3>
            </div>
            <div className="um-grid">
              <label>
                <span>用户名</span>
                <input value={form.username} placeholder="登录账号，如 zhangsan" onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </label>
              <label>
                <span>显示名</span>
                <input value={form.display_name} placeholder="如 张三" onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </label>
              <label>
                <span>初始密码</span>
                <input type="password" value={form.password} placeholder="至少 1 位" onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </label>
              <label>
                <span>角色</span>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="filler">填报人</option>
                  <option value="admin">管理员</option>
                </select>
              </label>
            </div>
            <div className="um-form-actions">
              <button className="primary" disabled={creating} onClick={create}>
                <Icon name="plus" size={15} /> {creating ? '创建中…' : '创建用户'}
              </button>
            </div>
          </section>

          <div className="um-divider" />

          <section className="um-list">
            <div className="um-section-header">
              <span className="um-section-icon"><Icon name="user" size={16} /></span>
              <h3>已有用户（{users.length}）</h3>
            </div>
            {loading ? (
              <div className="muted-empty">加载中…</div>
            ) : users.length === 0 ? (
              <div className="muted-empty">暂无用户</div>
            ) : (
              <table className="um-table">
                <thead>
                  <tr><th>姓名</th><th>用户名</th><th>角色</th><th>创建时间</th><th></th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.display_name}{u.id === user.id && <span className="self-tag">本人</span>}</td>
                      <td>{u.username}</td>
                      <td><span className={`badge ${u.role}`}>{ROLE_LABEL[u.role] || u.role}</span></td>
                      <td className="um-date">{u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '-'}</td>
                      <td>
                        <button className="icon-btn danger" title="删除用户" disabled={u.id === user.id} onClick={() => del(u)} aria-label="删除用户">
                          <Icon name="trash" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        {toast && (
          <div className={`toast ${toast.kind}`} key={toast.id} role="status" aria-live="polite">
            <Icon name={toast.kind === 'ok' ? 'check' : 'warn'} size={16} />
            <span>{toast.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
