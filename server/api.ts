import express, { type Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { spawn } from 'child_process';
import AdmZip from 'adm-zip';
import { getDb } from './db.js';
import {
  getFolderStoragePath,
  sanitizeFilename,
  getMimeType,
  streamFileWithRange,
  getDiskStatistics,
} from './storage.js';
import { parseAnimeFilename } from './animeParser.js';
import {
  requireAuth,
  hashPassword,
  verifyPassword,
  generateToken,
  type AuthenticatedRequest,
} from './auth.js';
import { startUrlImportJob } from './urlImporter.js';
import { processZipArchive, get7zBinary } from './zipHandler.js';
import { transferManager } from './transferManager.js';

export const apiRouter: Router = express.Router();

// Configure Multer for streaming uploads directly to VPS disk
const uploadStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const folderUid = (req.body.folderUid as string) || (req.query.folderUid as string) || null;
    const destDir = getFolderStoragePath(folderUid);
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const safeName = sanitizeFilename(file.originalname);
    const folderUid = (req.body.folderUid as string) || (req.query.folderUid as string) || null;
    const destDir = getFolderStoragePath(folderUid);

    const ext = path.extname(safeName);
    const base = path.basename(safeName, ext);
    let finalName = safeName;
    let counter = 1;

    // Avoid duplicate overwrites if keep_both requested or duplicate exists
    while (fs.existsSync(path.join(destDir, finalName))) {
      finalName = `${base} (${counter})${ext}`;
      counter++;
    }

    cb(null, finalName);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 15 * 1024 * 1024 * 1024, // 15GB upload limit
  },
});

/* ========================================================
   AUTHENTICATION ENDPOINTS
   ======================================================== */

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const db = getDb();
  const userResult = await db.execute({
    sql: `SELECT id, username, password_hash, role FROM users WHERE username = ?`,
    args: [username],
  });

  if (userResult.rows.length === 0) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const user = userResult.rows[0] as unknown as { id: string; username: string; password_hash: string; role: string };
  const valid = verifyPassword(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const token = generateToken({ id: user.id, username: user.username, role: user.role });

  res.cookie('xorvila_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    user: { id: user.id, username: user.username, role: user.role },
    token,
  });
});

apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('xorvila_session');
  res.json({ success: true });
});

apiRouter.get('/auth/me', (req: AuthenticatedRequest, res: Response) => {
  const token = req.cookies?.xorvila_session || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    res.json({ authenticated: false, user: null });
    return;
  }

  // Attempt verification
  const { verifyToken } = require('./auth.js');
  const payload = verifyToken(token);
  if (!payload) {
    res.json({ authenticated: false, user: null });
    return;
  }

  res.json({ authenticated: true, user: payload });
});

apiRouter.post('/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters' });
    return;
  }

  const db = getDb();
  const userResult = await db.execute({
    sql: `SELECT password_hash FROM users WHERE id = ?`,
    args: [req.user!.id],
  });

  if (userResult.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const currentHash = userResult.rows[0].password_hash as string;
  if (!verifyPassword(currentPassword, currentHash)) {
    res.status(400).json({ error: 'Current password is incorrect' });
    return;
  }

  const newHash = hashPassword(newPassword);
  await db.execute({
    sql: `UPDATE users SET password_hash = ? WHERE id = ?`,
    args: [newHash, req.user!.id],
  });

  res.json({ success: true, message: 'Password updated successfully' });
});

/* ========================================================
   FOLDER MANAGEMENT ENDPOINTS
   ======================================================== */

// List all folders or folders by parent_id
apiRouter.get('/folders', async (req: Request, res: Response) => {
  const parentId = req.query.parentId === 'null' || !req.query.parentId ? null : (req.query.parentId as string);
  const all = req.query.all === 'true';

  const db = getDb();
  let queryResult;

  if (all) {
    queryResult = await db.execute(`
      SELECT f.*, 
        (SELECT COUNT(*) FROM files WHERE folder_id = f.id) AS file_count,
        (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) AS subfolder_count
      FROM folders f
      ORDER BY name ASC
    `);
  } else if (parentId === null) {
    queryResult = await db.execute({
      sql: `
        SELECT f.*, 
          (SELECT COUNT(*) FROM files WHERE folder_id = f.id) AS file_count,
          (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) AS subfolder_count
        FROM folders f
        WHERE parent_id IS NULL OR parent_id = ''
        ORDER BY name ASC
      `,
      args: [],
    });
  } else {
    queryResult = await db.execute({
      sql: `
        SELECT f.*, 
          (SELECT COUNT(*) FROM files WHERE folder_id = f.id) AS file_count,
          (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) AS subfolder_count
        FROM folders f
        WHERE parent_id = ?
        ORDER BY name ASC
      `,
      args: [parentId],
    });
  }

  res.json({ folders: queryResult.rows });
});

// Breadcrumbs for a given folder
apiRouter.get('/folders/:id/breadcrumbs', async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const breadcrumbs: Array<{ id: string; name: string; folder_uid: string }> = [];

  let currentId: string | null = id;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const result = await db.execute({
      sql: `SELECT id, parent_id, name, folder_uid FROM folders WHERE id = ?`,
      args: [currentId],
    });

    if (result.rows.length === 0) break;
    const row = result.rows[0] as unknown as { id: string; parent_id: string | null; name: string; folder_uid: string };
    breadcrumbs.unshift({ id: row.id, name: row.name, folder_uid: row.folder_uid });
    currentId = row.parent_id;
  }

  res.json({ breadcrumbs });
});

// Create new folder
apiRouter.post('/folders', requireAuth, async (req: Request, res: Response) => {
  const { name, parentId } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Folder name is required' });
    return;
  }

  const cleanName = sanitizeFilename(name.trim());
  const folderUid = `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Ensure storage folder directory is created on VPS filesystem
  getFolderStoragePath(folderUid);

  const db = getDb();
  await db.execute({
    sql: `INSERT INTO folders (id, parent_id, name, folder_uid, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, parentId || null, cleanName, folderUid, now, now],
  });

  res.status(201).json({
    folder: {
      id,
      parent_id: parentId || null,
      name: cleanName,
      folder_uid: folderUid,
      created_at: now,
      updated_at: now,
    },
  });
});

// Rename or Move folder
apiRouter.patch('/folders/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, parentId } = req.body;

  const db = getDb();
  const existing = await db.execute({
    sql: `SELECT id, parent_id, name, folder_uid FROM folders WHERE id = ?`,
    args: [id],
  });

  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Folder not found' });
    return;
  }

  const row = existing.rows[0];
  const newName = name ? sanitizeFilename(name.trim()) : (row.name as string);
  const newParentId = parentId !== undefined ? (parentId === 'null' || !parentId ? null : parentId) : row.parent_id;
  const now = new Date().toISOString();

  await db.execute({
    sql: `UPDATE folders SET name = ?, parent_id = ?, updated_at = ? WHERE id = ?`,
    args: [newName, newParentId, now, id],
  });

  res.json({ success: true, folder: { ...row, name: newName, parent_id: newParentId, updated_at: now } });
});

// Delete folder and its files from DB and VPS storage
apiRouter.delete('/folders/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const folderResult = await db.execute({
    sql: `SELECT folder_uid FROM folders WHERE id = ?`,
    args: [id],
  });

  if (folderResult.rows.length === 0) {
    res.status(404).json({ error: 'Folder not found' });
    return;
  }

  const folderUid = folderResult.rows[0].folder_uid as string;

  // Delete physical storage directory from VPS
  const storageDir = getFolderStoragePath(folderUid);
  if (fs.existsSync(storageDir)) {
    try {
      fs.rmSync(storageDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[XorvilaBox] Could not delete folder directory ${storageDir}:`, err);
    }
  }

  // Delete database files and folder
  await db.execute({ sql: `DELETE FROM files WHERE folder_id = ?`, args: [id] });
  await db.execute({ sql: `DELETE FROM folders WHERE id = ?`, args: [id] });

  res.json({ success: true, message: 'Folder and contents deleted from VPS storage and database.' });
});

/* ========================================================
   FILE MANAGEMENT ENDPOINTS
   ======================================================== */

// Check if duplicate file exists in target folder
apiRouter.post('/files/check-duplicate', async (req: Request, res: Response) => {
  const { filename, folderId } = req.body;
  if (!filename) {
    res.status(400).json({ error: 'Filename is required' });
    return;
  }

  const db = getDb();
  const check = await db.execute({
    sql: `SELECT id, stored_filename, file_size FROM files WHERE folder_id IS ? AND stored_filename = ?`,
    args: [folderId || null, filename],
  });

  res.json({
    exists: check.rows.length > 0,
    file: check.rows[0] || null,
  });
});

// List files with search, sorting, and folder filtering
apiRouter.get('/files', async (req: Request, res: Response) => {
  const folderId = req.query.folderId === 'null' || !req.query.folderId ? null : (req.query.folderId as string);
  const search = (req.query.search as string) || '';
  const sortBy = (req.query.sortBy as string) || 'episode'; // episode, name, size, date
  const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const db = getDb();
  let querySql = `SELECT * FROM files WHERE 1=1 `;
  const queryArgs: any[] = [];

  if (search.trim()) {
    querySql += ` AND (original_filename LIKE ? OR stored_filename LIKE ?)`;
    queryArgs.push(`%${search.trim()}%`, `%${search.trim()}%`);
  } else if (folderId !== null) {
    querySql += ` AND folder_id = ?`;
    queryArgs.push(folderId);
  } else {
    querySql += ` AND (folder_id IS NULL OR folder_id = '')`;
  }

  // Sorting logic
  if (sortBy === 'episode') {
    // Numerical episode sorting: anime episodes first sorted numerically, then others
    querySql += ` ORDER BY is_anime_episode DESC, season_number ${sortOrder}, episode_number ${sortOrder}, stored_filename ${sortOrder}`;
  } else if (sortBy === 'size') {
    querySql += ` ORDER BY file_size ${sortOrder}`;
  } else if (sortBy === 'date') {
    querySql += ` ORDER BY created_at ${sortOrder}`;
  } else {
    querySql += ` ORDER BY stored_filename ${sortOrder}`;
  }

  const filesResult = await db.execute({
    sql: querySql,
    args: queryArgs,
  });

  const files = filesResult.rows.map((row: any) => {
    // Generate clean full raw URL
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const baseUrl = process.env.PUBLIC_BASE_URL || `${protocol}://${host}`;
    const rawUrl = `${baseUrl}/r/${row.random_uid}/${encodeURIComponent(row.stored_filename)}?raw=1`;

    return {
      ...row,
      raw_url: rawUrl,
    };
  });

  // Split into Anime Episodes and Other Files
  const animeEpisodes = files.filter(f => f.is_anime_episode === 1);
  const otherFiles = files.filter(f => f.is_anime_episode !== 1);

  res.json({
    files,
    animeEpisodes,
    otherFiles,
    total: files.length,
  });
});

// Single file upload
apiRouter.post('/files/upload', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const folderId = req.body.folderId === 'null' || !req.body.folderId ? null : req.body.folderId;
  const originalFilename = req.file.originalname;
  const storedFilename = req.file.filename;
  const fileSize = req.file.size;
  const ext = path.extname(storedFilename);
  const mimeType = getMimeType(ext);

  const animeMeta = parseAnimeFilename(storedFilename);
  const randomUid = crypto.randomBytes(6).toString('hex');
  const fileId = crypto.randomUUID();
  const now = new Date().toISOString();

  const db = getDb();
  await db.execute({
    sql: `INSERT INTO files (id, folder_id, random_uid, original_filename, stored_filename, extension, mime_type, file_size, season_number, episode_number, resolution, audio_language, file_status, is_anime_episode, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?)`,
    args: [
      fileId,
      folderId,
      randomUid,
      originalFilename,
      storedFilename,
      ext,
      mimeType,
      fileSize,
      animeMeta.seasonNumber,
      animeMeta.episodeNumber,
      animeMeta.resolution,
      animeMeta.audioLanguage,
      animeMeta.isAnimeEpisode ? 1 : 0,
      now,
      now,
    ],
  });

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const baseUrl = process.env.PUBLIC_BASE_URL || `${protocol}://${host}`;
  const rawUrl = `${baseUrl}/r/${randomUid}/${encodeURIComponent(storedFilename)}?raw=1`;

  res.status(201).json({
    success: true,
    file: {
      id: fileId,
      folder_id: folderId,
      random_uid: randomUid,
      original_filename: originalFilename,
      stored_filename: storedFilename,
      extension: ext,
      mime_type: mimeType,
      file_size: fileSize,
      season_number: animeMeta.seasonNumber,
      episode_number: animeMeta.episodeNumber,
      resolution: animeMeta.resolution,
      audio_language: animeMeta.audioLanguage,
      is_anime_episode: animeMeta.isAnimeEpisode ? 1 : 0,
      raw_url: rawUrl,
      created_at: now,
    },
  });
});

// Import file from remote URL
apiRouter.post('/files/import-url', requireAuth, async (req: Request, res: Response) => {
  const { url, folderId, folderUid } = req.body;
  if (!url || !url.trim()) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  try {
    const jobId = await startUrlImportJob(url.trim(), folderId || null, folderUid || null);
    res.status(202).json({
      success: true,
      message: 'Download job initiated on VPS',
      jobId,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to start URL import' });
  }
});

// Import and Extract ZIP file directly on VPS
apiRouter.post('/files/import-zip', requireAuth, upload.single('zipFile'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No ZIP file uploaded' });
    return;
  }

  const folderId = req.body.folderId === 'null' || !req.body.folderId ? null : req.body.folderId;
  const folderUid = req.body.folderUid || null;

  try {
    const jobId = await processZipArchive(req.file.path, req.file.originalname, folderId, folderUid);
    res.status(202).json({
      success: true,
      message: 'ZIP extraction initiated on VPS',
      jobId,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to start ZIP extraction' });
  }
});

// Check status of an import job
apiRouter.get('/jobs/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const cached = transferManager.getJob(id);
  if (cached) {
    res.json({ job: cached });
    return;
  }

  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM import_jobs WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({ job: result.rows[0] });
});

// List recent jobs
apiRouter.get('/jobs', async (_req: Request, res: Response) => {
  const db = getDb();
  const result = await db.execute(`
    SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 10
  `);
  res.json({ jobs: result.rows });
});

/* ========================================================
   TRANSFER PROGRESS & REAL-TIME SSE ENDPOINTS
   ======================================================== */

// SSE Stream for all active transfers
apiRouter.get('/transfers/events', (req: Request, res: Response) => {
  transferManager.addSSEClient(res);
});

// SSE Stream for a specific transfer
apiRouter.get('/transfers/:id/events', (req: Request, res: Response) => {
  const { id } = req.params;
  transferManager.addSSEClient(res, id);
});

// Get current state of a transfer
apiRouter.get('/transfers/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const cached = transferManager.getJob(id);
  if (cached) {
    res.json({ transfer: cached });
    return;
  }

  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM import_jobs WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Transfer not found' });
    return;
  }

  const row = result.rows[0] as any;
  const percent = row.total_bytes > 0 ? Math.min(100, Math.round((row.downloaded_bytes / row.total_bytes) * 1000) / 10) : 0;

  res.json({
    transfer: {
      jobId: row.id,
      type: row.type,
      filename: row.filename,
      status: row.status,
      stage: row.stage || row.status,
      downloaded_bytes: row.downloaded_bytes,
      total_bytes: row.total_bytes,
      speed_bps: row.speed_bps,
      percent,
      extracted_files_count: row.extracted_files_count,
      total_files_count: row.total_files_count || 0,
      detected_episodes_count: row.detected_episodes_count,
      current_file: row.current_file,
      error_message: row.error_message,
      target_folder_id: row.target_folder_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  });
});

// Cancel a running transfer on the VPS
apiRouter.post('/transfers/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const cancelled = await transferManager.cancelJob(id);
    res.json({ success: true, message: 'Transfer cancelled successfully', cancelled });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to cancel transfer' });
  }
});

// Rename or Move file
apiRouter.patch('/files/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { filename, folderId } = req.body;

  const db = getDb();
  const fileResult = await db.execute({
    sql: `SELECT f.*, fo.folder_uid FROM files f LEFT JOIN folders fo ON f.folder_id = fo.id WHERE f.id = ?`,
    args: [id],
  });

  if (fileResult.rows.length === 0) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const currentFile = fileResult.rows[0] as any;
  const currentDir = getFolderStoragePath(currentFile.folder_uid);
  const currentPath = path.join(currentDir, currentFile.stored_filename);

  let newStoredName = currentFile.stored_filename;
  let newFolderId = currentFile.folder_id;
  let targetDir = currentDir;

  // Moving to a different folder
  if (folderId !== undefined && folderId !== currentFile.folder_id) {
    newFolderId = folderId === 'null' || !folderId ? null : folderId;
    let targetFolderUid: string | null = null;
    if (newFolderId) {
      const targetFolderResult = await db.execute({
        sql: `SELECT folder_uid FROM folders WHERE id = ?`,
        args: [newFolderId],
      });
      if (targetFolderResult.rows.length > 0) {
        targetFolderUid = targetFolderResult.rows[0].folder_uid as string;
      }
    }
    targetDir = getFolderStoragePath(targetFolderUid);
  }

  // Renaming
  if (filename && filename.trim() && filename !== currentFile.stored_filename) {
    newStoredName = sanitizeFilename(filename.trim());
  }

  const newPath = path.join(targetDir, newStoredName);

  // Perform physical move/rename on VPS storage
  if (fs.existsSync(currentPath)) {
    // If destination already exists and is different from current, avoid overwrite
    if (newPath !== currentPath && fs.existsSync(newPath)) {
      const ext = path.extname(newStoredName);
      const base = path.basename(newStoredName, ext);
      newStoredName = `${base} (${Date.now()})${ext}`;
    }
    const finalDest = path.join(targetDir, newStoredName);
    fs.renameSync(currentPath, finalDest);
  }

  // Recalculate anime metadata if name changed
  const animeMeta = parseAnimeFilename(newStoredName);
  const now = new Date().toISOString();

  await db.execute({
    sql: `UPDATE files SET folder_id = ?, stored_filename = ?, season_number = ?, episode_number = ?, resolution = ?, audio_language = ?, is_anime_episode = ?, updated_at = ? WHERE id = ?`,
    args: [
      newFolderId,
      newStoredName,
      animeMeta.seasonNumber,
      animeMeta.episodeNumber,
      animeMeta.resolution,
      animeMeta.audioLanguage,
      animeMeta.isAnimeEpisode ? 1 : 0,
      now,
      id,
    ],
  });

  res.json({
    success: true,
    file: {
      ...currentFile,
      folder_id: newFolderId,
      stored_filename: newStoredName,
      season_number: animeMeta.seasonNumber,
      episode_number: animeMeta.episodeNumber,
      is_anime_episode: animeMeta.isAnimeEpisode ? 1 : 0,
    },
  });
});

// Delete file
apiRouter.delete('/files/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const fileResult = await db.execute({
    sql: `SELECT f.*, fo.folder_uid FROM files f LEFT JOIN folders fo ON f.folder_id = fo.id WHERE f.id = ?`,
    args: [id],
  });

  if (fileResult.rows.length === 0) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const file = fileResult.rows[0] as any;
  const folderDir = getFolderStoragePath(file.folder_uid);
  const filePath = path.join(folderDir, file.stored_filename);

  // Delete from real VPS filesystem
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.warn(`[XorvilaBox] Unlink failed for ${filePath}:`, err);
    }
  }

  await db.execute({ sql: `DELETE FROM files WHERE id = ?`, args: [id] });

  res.json({ success: true, message: 'File deleted from VPS storage and database.' });
});

// Bulk delete files
apiRouter.post('/files/bulk-delete', requireAuth, async (req: Request, res: Response) => {
  const { fileIds } = req.body;
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    res.status(400).json({ error: 'Array of fileIds is required' });
    return;
  }

  const db = getDb();
  let deletedCount = 0;

  try {
    for (const id of fileIds) {
      const fileResult = await db.execute({
        sql: `SELECT f.*, fo.folder_uid FROM files f LEFT JOIN folders fo ON f.folder_id = fo.id WHERE f.id = ?`,
        args: [id],
      });

      if (fileResult.rows.length === 0) continue;

      const file = fileResult.rows[0] as any;
      const folderDir = getFolderStoragePath(file.folder_uid);
      const filePath = path.join(folderDir, file.stored_filename);

      // Delete from real VPS filesystem
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.warn(`[XorvilaBox] Unlink failed for ${filePath}:`, err);
        }
      }

      await db.execute({ sql: `DELETE FROM files WHERE id = ?`, args: [id] });
      deletedCount++;
    }

    res.json({ success: true, message: `Successfully deleted ${deletedCount} files from VPS storage and database.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to bulk delete files' });
  }
});

// Bulk move files
apiRouter.post('/files/bulk-move', requireAuth, async (req: Request, res: Response) => {
  const { fileIds, folderId } = req.body;
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    res.status(400).json({ error: 'Array of fileIds is required' });
    return;
  }

  const db = getDb();
  const targetFolderId = folderId === 'null' || !folderId || folderId === 'root' ? null : folderId;

  try {
    let targetFolderUid: string | null = null;
    if (targetFolderId) {
      const targetFolderResult = await db.execute({
        sql: `SELECT folder_uid FROM folders WHERE id = ?`,
        args: [targetFolderId],
      });
      if (targetFolderResult.rows.length === 0) {
        res.status(404).json({ error: 'Destination folder not found' });
        return;
      }
      targetFolderUid = targetFolderResult.rows[0].folder_uid as string;
    }

    const targetDir = getFolderStoragePath(targetFolderUid);
    let movedCount = 0;

    for (const id of fileIds) {
      const fileResult = await db.execute({
        sql: `SELECT f.*, fo.folder_uid FROM files f LEFT JOIN folders fo ON f.folder_id = fo.id WHERE f.id = ?`,
        args: [id],
      });

      if (fileResult.rows.length === 0) continue;

      const currentFile = fileResult.rows[0] as any;
      const currentDir = getFolderStoragePath(currentFile.folder_uid);
      const currentPath = path.join(currentDir, currentFile.stored_filename);

      let newStoredName = currentFile.stored_filename;
      const newPath = path.join(targetDir, newStoredName);

      if (fs.existsSync(currentPath)) {
        if (newPath !== currentPath && fs.existsSync(newPath)) {
          const ext = path.extname(newStoredName);
          const base = path.basename(newStoredName, ext);
          newStoredName = `${base} (${Date.now()})${ext}`;
        }
        const finalDest = path.join(targetDir, newStoredName);
        fs.renameSync(currentPath, finalDest);
      }

      // Recalculate anime metadata if name changed
      const animeMeta = parseAnimeFilename(newStoredName);
      const now = new Date().toISOString();

      await db.execute({
        sql: `UPDATE files SET folder_id = ?, stored_filename = ?, season_number = ?, episode_number = ?, resolution = ?, audio_language = ?, is_anime_episode = ?, updated_at = ? WHERE id = ?`,
        args: [
          targetFolderId,
          newStoredName,
          animeMeta.seasonNumber,
          animeMeta.episodeNumber,
          animeMeta.resolution,
          animeMeta.audioLanguage,
          animeMeta.isAnimeEpisode ? 1 : 0,
          now,
          id,
        ],
      });

      movedCount++;
    }

    res.json({ success: true, message: `Successfully moved ${movedCount} files on VPS.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to bulk move files' });
  }
});

// Bulk download files
apiRouter.get('/files/bulk-download', async (req: Request, res: Response) => {
  const idsParam = req.query.ids as string;
  if (!idsParam) {
    res.status(400).send('No file IDs provided');
    return;
  }

  const fileIds = idsParam.split(',').filter(Boolean);
  if (fileIds.length === 0) {
    res.status(400).send('No file IDs provided');
    return;
  }

  const db = getDb();
  try {
    // Dynamically build SQL with placeholders
    const placeholders = fileIds.map(() => '?').join(',');
    const filesResult = await db.execute({
      sql: `SELECT f.*, fo.folder_uid FROM files f LEFT JOIN folders fo ON f.folder_id = fo.id WHERE f.id IN (${placeholders})`,
      args: fileIds,
    });

    if (filesResult.rows.length === 0) {
      res.status(404).send('No files found for download');
      return;
    }

    const filesToZip: Array<{ path: string; name: string }> = [];
    for (const row of filesResult.rows as any[]) {
      const folderDir = getFolderStoragePath(row.folder_uid);
      const filePath = path.join(folderDir, row.stored_filename);
      if (fs.existsSync(filePath)) {
        filesToZip.push({
          path: filePath,
          name: row.stored_filename,
        });
      }
    }

    if (filesToZip.length === 0) {
      res.status(404).send('No physical files exist for these records');
      return;
    }

    // Generate a temporary zip archive filename in /tmp
    const tempZipName = `bulk_download_${crypto.randomBytes(6).toString('hex')}.zip`;
    const tempZipPath = path.join('/tmp', tempZipName);

    const sevenBinPath = get7zBinary();
    if (sevenBinPath) {
      // Create a zip using native 7z/7za without compression (mx=0) for ultra-fast, zero-overhead zipping
      const filePaths = filesToZip.map((f) => f.path);
      
      const proc = spawn(sevenBinPath, ['a', '-tzip', '-mx=0', tempZipPath, ...filePaths]);
      
      proc.on('close', (code: number | null) => {
        if (code === 0 && fs.existsSync(tempZipPath)) {
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', `attachment; filename="xorvilabox_download.zip"`);
          res.sendFile(tempZipPath, (err?: Error) => {
            try {
              fs.unlinkSync(tempZipPath);
            } catch {}
            if (err) {
              console.error('Error sending bulk zip file:', err);
            }
          });
        } else {
          res.status(500).send('Failed to build native archive for download');
        }
      });

      proc.on('error', (err: Error) => {
        console.error('7z spawn error:', err);
        // Fallback to AdmZip if spawning fails
        try {
          const zip = new AdmZip();
          for (const item of filesToZip) {
            zip.addLocalFile(item.path, '', item.name);
          }
          zip.writeZip(tempZipPath);
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', `attachment; filename="xorvilabox_download.zip"`);
          res.sendFile(tempZipPath, (err?: Error) => {
            try { fs.unlinkSync(tempZipPath); } catch {}
          });
        } catch (zipErr: any) {
          res.status(500).send(`Archive error: ${zipErr.message}`);
        }
      });
    } else {
      // Fallback to JS AdmZip directly
      try {
        const zip = new AdmZip();
        for (const item of filesToZip) {
          zip.addLocalFile(item.path, '', item.name);
        }
        zip.writeZip(tempZipPath);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="xorvilabox_download.zip"`);
        res.sendFile(tempZipPath, (err?: Error) => {
          try { fs.unlinkSync(tempZipPath); } catch {}
        });
      } catch (zipErr: any) {
        res.status(500).send(`Archive error: ${zipErr.message}`);
      }
    }
  } catch (err: any) {
    res.status(500).send(`Failed to initiate bulk download: ${err.message}`);
  }
});

/* ========================================================
   STORAGE & DASHBOARD METRICS
   ======================================================== */

const handleStorageStats = async (_req: Request, res: Response) => {
  const diskStats = await getDiskStatistics();
  const db = getDb();

  const filesCountResult = await db.execute(`SELECT COUNT(*) as count, SUM(file_size) as total_size FROM files;`);
  const foldersCountResult = await db.execute(`SELECT COUNT(*) as count FROM folders;`);

  const totalFiles = (filesCountResult.rows[0].count as number) || 0;
  const dbStorageSize = (filesCountResult.rows[0].total_size as number) || 0;
  const totalFolders = (foldersCountResult.rows[0].count as number) || 0;

  res.json({
    disk: diskStats,
    platform: {
      totalFiles,
      totalFolders,
      xorvilaBoxBytes: Math.max(diskStats.xorvilaBoxBytes, dbStorageSize),
      storagePath: diskStats.storagePath,
    },
  });
};

apiRouter.get('/stats', handleStorageStats);
apiRouter.get('/storage/stats', handleStorageStats);

apiRouter.get('/dashboard', async (req: Request, res: Response) => {
  const diskStats = await getDiskStatistics();
  const db = getDb();

  const filesCount = await db.execute(`SELECT COUNT(*) as count, SUM(file_size) as total_size FROM files;`);
  const foldersCount = await db.execute(`SELECT COUNT(*) as count FROM folders;`);

  // Recent files
  const recentFiles = await db.execute(`
    SELECT * FROM files ORDER BY created_at DESC LIMIT 6;
  `);

  // Recent anime episodes
  const recentEpisodes = await db.execute(`
    SELECT * FROM files WHERE is_anime_episode = 1 ORDER BY created_at DESC LIMIT 6;
  `);

  // Recent folders
  const recentFolders = await db.execute(`
    SELECT f.*, (SELECT COUNT(*) FROM files WHERE folder_id = f.id) AS file_count
    FROM folders f ORDER BY created_at DESC LIMIT 6;
  `);

  // Recent jobs
  const recentJobs = await db.execute(`
    SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 5;
  `);

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const baseUrl = process.env.PUBLIC_BASE_URL || `${protocol}://${host}`;

  const filesWithUrl = recentFiles.rows.map((row: any) => ({
    ...row,
    raw_url: `${baseUrl}/r/${row.random_uid}/${encodeURIComponent(row.stored_filename)}?raw=1`,
  }));

  const episodesWithUrl = recentEpisodes.rows.map((row: any) => ({
    ...row,
    raw_url: `${baseUrl}/r/${row.random_uid}/${encodeURIComponent(row.stored_filename)}?raw=1`,
  }));

  res.json({
    stats: {
      disk: diskStats,
      totalFiles: (filesCount.rows[0].count as number) || 0,
      totalFolders: (foldersCount.rows[0].count as number) || 0,
      xorvilaBoxBytes: (filesCount.rows[0].total_size as number) || diskStats.xorvilaBoxBytes,
    },
    recentFiles: filesWithUrl,
    recentEpisodes: episodesWithUrl,
    recentFolders: recentFolders.rows,
    recentJobs: recentJobs.rows,
  });
});
