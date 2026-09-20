import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initDb, getDb } from './server/db.js';
import { ensureDefaultAdmin } from './server/auth.js';
import { apiRouter } from './server/api.js';
import { getFolderStoragePath, streamFileWithRange } from './server/storage.js';

const PORT = 3000;

async function startServer() {
  const app = express();

  // Basic security and parsing middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  // Initialize SQLite database and default admin
  try {
    await initDb();
    await ensureDefaultAdmin();
  } catch (err) {
    console.error('[XorvilaBox Server] Database initialization error:', err);
  }

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'XorvilaBox',
      timestamp: new Date().toISOString(),
    });
  });

  // API router
  app.use('/api', apiRouter);

  // Raw file streaming handler for /r/:uid/:filename OR /:uid/:filename?raw=1
  async function handleRawStream(req: Request, res: Response) {
    const { uid } = req.params;
    const asDownload = req.query.dl === '1' || req.query.download === '1';

    try {
      const db = getDb();
      const fileResult = await db.execute({
        sql: `SELECT f.*, fo.folder_uid FROM files f LEFT JOIN folders fo ON f.folder_id = fo.id WHERE f.random_uid = ?`,
        args: [uid],
      });

      if (fileResult.rows.length === 0) {
        res.status(404).send('File not found or link has expired.');
        return;
      }

      const file = fileResult.rows[0] as any;
      const folderDir = getFolderStoragePath(file.folder_uid);
      const filePath = path.join(folderDir, file.stored_filename);

      if (!fs.existsSync(filePath)) {
        res.status(404).send('File missing on storage filesystem.');
        return;
      }

      // Stream with HTTP Range Requests
      streamFileWithRange(req, res, filePath, file.mime_type, file.stored_filename, asDownload);
    } catch (err) {
      console.error('[XorvilaBox Raw Stream Error]', err);
      if (!res.headersSent) {
        res.status(500).send('Internal streaming error');
      }
    }
  }

  // Public Raw Streaming routes
  app.get('/r/:uid/:filename', handleRawStream);
  app.get('/r/:uid', handleRawStream);

  // Match /:uid/:filename when ?raw=1
  app.get('/:uid/:filename', (req: Request, res: Response, next) => {
    if (req.query.raw === '1' || req.query.dl === '1') {
      return handleRawStream(req, res);
    }
    next();
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[XorvilaBox] Production server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
