import { Router } from 'express';
import { db } from '../db.js';
import { hashPassword, verifyPassword } from '../db.js';
import { signToken } from '../auth.js';
import { authMiddleware, requireAdmin } from '../middleware.js';

const r = Router();

r.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing credentials' });
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!u || !verifyPassword(password, u.salt, u.password_hash)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  res.json({
    token: signToken(u),
    user: { id: u.id, username: u.username, display_name: u.display_name, role: u.role }
  });
});

r.get('/', authMiddleware, requireAdmin, (req, res) => {
  res.json(
    db.prepare('SELECT id,username,display_name,role,created_at FROM users ORDER BY id').all()
  );
});

r.post('/', authMiddleware, requireAdmin, (req, res) => {
  const { username, display_name, password, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing credentials' });
  const { hash, salt } = hashPassword(password);
  try {
    const info = db
      .prepare('INSERT INTO users (username,display_name,role,password_hash,salt,created_at) VALUES (?,?,?,?,?,?)')
      .run(username, display_name || username, role || 'filler', hash, salt, new Date().toISOString());
    res.json({ id: info.lastInsertRowid });
  } catch {
    res.status(409).json({ error: 'username exists' });
  }
});

r.delete('/:id', authMiddleware, requireAdmin, (req, res) => {
  if (Number(req.params.id) === req.user.uid) return res.status(400).json({ error: 'cannot delete self' });
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default r;
