import { useState } from 'react';
import { useAuth } from '../auth';

export default function Login() {
  const { login, user } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [err, setErr] = useState('');

  const submit = async (e: any) => {
    e.preventDefault();
    setErr('');
    try {
      await login(username, password);
    } catch (e: any) {
      setErr(e.message || '登录失败');
    }
  };

  if (user) return null;

  return (
    <div className="login-wrap">
      <aside className="login-brand">
        <div className="brand-top">
          <div className="login-orb">周</div>
          <span className="brand-name">周报协作平台</span>
        </div>
        <div className="brand-hero">
          <h1>让每周的进展<br />一目了然</h1>
          <p>多部门在线协作、实时同步、版本留痕。一份周报，从填写到发布，全程从容。</p>
        </div>
        <div className="brand-foot">部门团队 · 多人在线协作 · 内部使用</div>
      </aside>

      <div className="login-side">
        <form className="login-card" onSubmit={submit}>
          <h1>欢迎回来</h1>
          <p className="sub">登录以继续协作</p>
          {err && <div className="err" role="alert">{err}</div>}
          <label htmlFor="username">用户名</label>
          <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          <label htmlFor="password">密码</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <button type="submit" className="primary">登 录</button>
          <p className="hint">默认管理员：admin / admin123</p>
        </form>
      </div>
    </div>
  );
}
