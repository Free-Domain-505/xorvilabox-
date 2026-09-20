import path from 'path';
import fs from 'fs';
import { type Request, type Response } from 'express';

export function getStorageRoot(): string {
  const customPath = process.env.STORAGE_PATH;
  if (customPath && customPath.trim()) {
    const resolved = path.resolve(customPath);
    if (!fs.existsSync(resolved)) {
      try {
        fs.mkdirSync(resolved, { recursive: true });
      } catch (err) {
        console.warn(`[XorvilaBox Storage] Could not create ${resolved}, falling back to local data/storage`, err);
        const fallback = path.resolve(process.cwd(), 'data', 'storage');
        if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
        return fallback;
      }
    }
    return resolved;
  }
  const defaultDir = path.resolve(process.cwd(), 'data', 'storage');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  return defaultDir;
}

export function getFolderStoragePath(folderUid?: string | null): string {
  const root = getStorageRoot();
  if (!folderUid || folderUid === 'root' || folderUid === '') {
    const rootFilesDir = path.join(root, 'root_files');
    if (!fs.existsSync(rootFilesDir)) {
      fs.mkdirSync(rootFilesDir, { recursive: true });
    }
    return rootFilesDir;
  }

  // Sanitize folderUid to prevent traversal
  const safeUid = folderUid.replace(/[^a-zA-Z0-9_-]/g, '');
  const folderDir = path.join(root, safeUid);
  if (!fs.existsSync(folderDir)) {
    fs.mkdirSync(folderDir, { recursive: true });
  }
  return folderDir;
}

export function sanitizeFilename(name: string): string {
  // Replace invalid filesystem characters and path traversal indicators
  return name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\.\.+/g, '.').trim() || 'file';
}

export function getMimeType(extension: string): string {
  const ext = extension.toLowerCase().replace(/^\./, '');
  switch (ext) {
    case 'mkv':
      return 'video/x-matroska';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'avi':
      return 'video/x-msvideo';
    case 'mov':
      return 'video/quicktime';
    case 'ts':
      return 'video/mp2t';
    case 'mp3':
      return 'audio/mpeg';
    case 'flac':
      return 'audio/flac';
    case 'wav':
      return 'audio/wav';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'zip':
      return 'application/zip';
    case 'rar':
      return 'application/x-rar-compressed';
    case '7z':
      return 'application/x-7z-compressed';
    case 'txt':
      return 'text/plain';
    case 'nfo':
      return 'text/plain';
    case 'srt':
      return 'text/plain';
    case 'vtt':
      return 'text/vtt';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Streams file with HTTP Range Requests (RFC 7233)
 * Essential for seeking MKV/MP4 in browsers and media players (VLC, MX Player)
 */
export function streamFileWithRange(
  req: Request,
  res: Response,
  filePath: string,
  mimeType: string,
  filename: string,
  asDownload = false
): void {
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found on storage filesystem' });
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const dispositionType = asDownload ? 'attachment' : 'inline';
  const encodedFilename = encodeURIComponent(filename);

  res.setHeader('Content-Disposition', `${dispositionType}; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodedFilename}`);
  res.setHeader('Accept-Ranges', 'bytes');

  if (range) {
    // Parse Range header e.g. "bytes=0-1024" or "bytes=1024-"
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);
    res.setHeader('Content-Type', mimeType);

    fileStream.on('error', (err) => {
      console.error('[XorvilaBox Stream Error]', err);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    fileStream.pipe(res);
  } else {
    // Full file stream
    res.status(200);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Type', mimeType);

    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (err) => {
      console.error('[XorvilaBox Stream Error]', err);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    fileStream.pipe(res);
  }
}

/**
 * Reads actual Ubuntu VPS disk information using fs.statfs
 */
export async function getDiskStatistics(): Promise<{
  totalDiskBytes: number;
  freeDiskBytes: number;
  usedDiskBytes: number;
  xorvilaBoxBytes: number;
  storagePath: string;
}> {
  const storagePath = getStorageRoot();
  let totalDiskBytes = 1000 * 1024 * 1024 * 1024; // 1 TB default
  let freeDiskBytes = 750 * 1024 * 1024 * 1024;
  let usedDiskBytes = 250 * 1024 * 1024 * 1024;

  try {
    if (typeof fs.statfs === 'function') {
      const stats = await new Promise<fs.BigIntStatsFs | fs.StatsFs>((resolve, reject) => {
        fs.statfs(storagePath, (err, s) => {
          if (err) reject(err);
          else resolve(s);
        });
      });

      const bsize = Number(stats.bsize);
      const blocks = Number(stats.blocks);
      const bfree = Number(stats.bavail || stats.bfree);

      totalDiskBytes = blocks * bsize;
      freeDiskBytes = bfree * bsize;
      usedDiskBytes = totalDiskBytes - freeDiskBytes;
    }
  } catch (err) {
    console.warn('[XorvilaBox Storage] statfs warning:', err);
  }

  // Calculate actual XorvilaBox storage directory size
  let xorvilaBoxBytes = 0;
  function calculateDirSize(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) return;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          calculateDirSize(fullPath);
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          xorvilaBoxBytes += stat.size;
        }
      }
    } catch {
      // ignore transient file lock
    }
  }

  calculateDirSize(storagePath);

  return {
    totalDiskBytes,
    freeDiskBytes,
    usedDiskBytes,
    xorvilaBoxBytes,
    storagePath,
  };
}
