import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { db, uploadsDir } from '../db.js';
import { authMiddleware } from '../middleware.js';

const r = Router();

// 图片由 <img> 标签直接引用，浏览器无法携带 Authorization；导出/邮件也需引用，故读取路由公开
r.get('/attachments/:id', (req, res) => {
  const a = db.prepare('SELECT * FROM attachments WHERE id=?').get(req.params.id);
  if (!a || !fs.existsSync(a.path)) return res.status(404).end();
  res.setHeader('Content-Type', a.mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(a.path).pipe(res);
});

r.use(authMiddleware);

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED.includes(file.mimetype);
    cb(ok ? null : new Error('unsupported type'), ok);
  }
});

r.post('/attachments', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const info = db
    .prepare('INSERT INTO attachments (weekly_report_id,filename,path,mime,size,created_at) VALUES (?,?,?,?,?,?)')
    .run(req.body.weekly_report_id ? Number(req.body.weekly_report_id) : 0, req.file.originalname, req.file.path, req.file.mimetype, req.file.size, new Date().toISOString());
  res.json({ id: info.lastInsertRowid, url: `/api/attachments/${info.lastInsertRowid}`, mime: req.file.mimetype });
});

export default r;
