import express from 'express';
import http from 'node:http';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { root } from './db.js';
import authRoutes from './routes/auth.js';
import weeklyRoutes from './routes/weeklyReports.js';
import versionRoutes from './routes/versions.js';
import attachmentRoutes from './routes/attachments.js';
import exportRoutes from './routes/export.js';
import { handleCollabConnection } from './collab.js';

const PORT = process.env.PORT || 8000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/weekly-reports', weeklyRoutes);
app.use('/api/weekly-reports', versionRoutes);
app.use('/api/weekly-reports', exportRoutes);
app.use('/api', attachmentRoutes);

const clientDist = path.join(root, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/collab')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
wss.on('connection', handleCollabConnection);

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';
  if (url.startsWith('/collab')) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  }
});

server.listen(PORT, () => {
  console.log(`[weekly-report] API + collab listening on http://localhost:${PORT}`);
});
