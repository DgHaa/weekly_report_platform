import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

// 生产环境必须通过环境变量 JWT_SECRET 提供强密钥；未设置时回退为本次启动随机密钥
// （重启后失效，仅用于本地开发），并打出安全告警，禁止使用可预测的硬编码默认值。
const SECRET = process.env.JWT_SECRET
  || (() => {
    const s = crypto.randomBytes(32).toString('hex');
    console.warn('[SECURITY] 未设置环境变量 JWT_SECRET，已使用随机密钥（进程重启后所有登录态失效）。生产环境请设置强随机 JWT_SECRET。');
    return s;
  })();

export function signToken(user) {
  return jwt.sign({ uid: user.id, role: user.role }, SECRET, { expiresIn: '12h' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}
