import http from 'http';
import https from 'https';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from './db.js';
import { getFolderStoragePath, sanitizeFilename, getMimeType } from './storage.js';
import { parseAnimeFilename } from './animeParser.js';
import { transferManager } from './transferManager.js';
import { runZipExtraction } from './zipHandler.js';

// SSRF Protection: check if hostname resolves to private, loopback, or metadata addresses
function isPrivateIp(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return true;
  if (host.startsWith('127.')) return true;
  if (host.startsWith('10.') || host.startsWith('192.168.') || host === '169.254.169.254') return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
  if (host.startsWith('169.254.')) return true; // Link-local / metadata service
  if (host === 'metadata.google.internal') return true;
  if (host.endsWith('.localhost') || host.endsWith('.local')) return true;
  return false;
}

// Inspect downloaded file for ZIP archive format:
// 1. File extension (.zip)
// 2. Content-Type header (application/zip, application/x-zip-compressed, multipart/x-zip, etc.)
// 3. Magic bytes: PK\x03\x04 (0x50 0x4B 0x03 0x04) or PK\x05\x06 (0x50 0x4B 0x05 0x06) or PK\x07\x08 (0x50 0x4B 0x07 0x08)
function checkIsZipArchive(filePath: string, filename: string, contentType?: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.zip') return true;
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (
      ct.includes('application/zip') ||
      ct.includes('application/x-zip-compressed') ||
      ct.includes('multipart/x-zip') ||
      ct.includes('application/x-zip')
    ) {
      return true;
    }
  }

  // Magic bytes check
  try {
    if (fs.existsSync(filePath)) {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(4);
      const bytesRead = fs.readSync(fd, buffer, 0, 4, 0);
      fs.closeSync(fd);
      if (bytesRead >= 4) {
        if (
          buffer[0] === 0x50 &&
          buffer[1] === 0x4b &&
          ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
            (buffer[2] === 0x05 && buffer[3] === 0x06) ||
            (buffer[2] === 0x07 && buffer[3] === 0x08))
        ) {
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('[XorvilaBox URL Import] Could not inspect magic bytes:', err);
  }

  return false;
}

export async function startUrlImportJob(
  sourceUrl: string,
  targetFolderId: string | null,
  targetFolderUid: string | null
): Promise<string> {
  const db = getDb();
  const parsedUrl = new URL(sourceUrl);

  if (isPrivateIp(parsedUrl.hostname) && process.env.NODE_ENV === 'production') {
    throw new Error('SSRF blocked: Requests to private, loopback, or metadata addresses are forbidden.');
  }

  // Extract initial filename from path
  let rawFilename = path.basename(parsedUrl.pathname);
  if (!rawFilename || rawFilename.trim() === '') {
    rawFilename = `imported-stream-${Date.now()}.mkv`;
  }
  rawFilename = decodeURIComponent(rawFilename);

  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO import_jobs (id, type, source_url, target_folder_id, filename, status, stage, downloaded_bytes, total_bytes, speed_bps, created_at, updated_at)
          VALUES (?, 'url', ?, ?, ?, 'downloading', 'Downloading from internet', 0, 0, 0, ?, ?)`,
    args: [jobId, sourceUrl, targetFolderId, rawFilename, now, now],
  });

  // Emit initial state
  transferManager.emitProgress({
    jobId,
    type: 'url',
    filename: rawFilename,
    status: 'downloading',
    stage: 'Downloading from internet',
    downloaded_bytes: 0,
    total_bytes: 0,
    speed_bps: 0,
    percent: 0,
    extracted_files_count: 0,
    total_files_count: 0,
    detected_episodes_count: 0,
    target_folder_id: targetFolderId,
    created_at: now,
    updated_at: now,
  });

  // Start background streaming download directly to VPS storage
  downloadUrlToStorage(jobId, sourceUrl, targetFolderId, targetFolderUid, rawFilename).catch(async (err) => {
    console.error(`[XorvilaBox URL Import] Job ${jobId} failed:`, err);
    transferManager.unregisterCancelHandler(jobId);

    const errorMsg = err.message || 'Download failed';
    const isCancelled = errorMsg.includes('cancelled');

    await db.execute({
      sql: `UPDATE import_jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?`,
      args: [isCancelled ? 'cancelled' : 'failed', errorMsg, new Date().toISOString(), jobId],
    });

    if (!isCancelled) {
      transferManager.emitProgress({
        jobId,
        type: 'url',
        filename: rawFilename,
        status: 'failed',
        stage: 'Import failed',
        error_message: errorMsg,
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bps: 0,
        percent: 0,
        extracted_files_count: 0,
        total_files_count: 0,
        detected_episodes_count: 0,
        target_folder_id: targetFolderId,
        updated_at: new Date().toISOString(),
      });
    }
  });

  return jobId;
}

async function downloadUrlToStorage(
  jobId: string,
  sourceUrl: string,
  targetFolderId: string | null,
  targetFolderUid: string | null,
  initialFilename: string,
  redirectCount = 0
): Promise<void> {
  if (redirectCount > 5) {
    throw new Error('Too many HTTP redirects');
  }

  const db = getDb();
  const parsedUrl = new URL(sourceUrl);
  const client = parsedUrl.protocol === 'https:' ? https : http;

  const targetDir = getFolderStoragePath(targetFolderUid);
  const tempFilePath = path.join(targetDir, `.import-${jobId}.tmp`);

  return new Promise((resolve, reject) => {
    let writeStream: fs.WriteStream | null = null;
    let isCancelled = false;

    const req = client.get(
      sourceUrl,
      {
        headers: {
          'User-Agent': 'XorvilaBox/1.0 (+https://xorvilabox.vps)',
          Accept: '*/*',
        },
      },
      (res) => {
        // Handle Redirects (301, 302, 303, 307, 308)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, sourceUrl).toString();
          res.resume(); // consume stream to free memory
          downloadUrlToStorage(jobId, redirectUrl, targetFolderId, targetFolderUid, initialFilename, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`Remote server responded with HTTP status ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        // Try getting filename from content-disposition header if available
        let finalFilename = initialFilename;
        const disposition = res.headers['content-disposition'];
        if (disposition) {
          const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
          if (match && match[1]) {
            finalFilename = decodeURIComponent(match[1].trim());
          }
        }
        finalFilename = sanitizeFilename(finalFilename);

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        let lastLoggedBytes = 0;
        let lastLogTime = Date.now();
        let smoothedSpeed = 0;

        writeStream = fs.createWriteStream(tempFilePath);

        res.on('data', (chunk: Buffer) => {
          if (isCancelled) return;
          downloadedBytes += chunk.length;

          const now = Date.now();
          const elapsed = (now - lastLogTime) / 1000;
          if (elapsed >= 0.6) {
            const instantSpeed = (downloadedBytes - lastLoggedBytes) / elapsed;
            smoothedSpeed = smoothedSpeed === 0 ? instantSpeed : Math.round(0.35 * instantSpeed + 0.65 * smoothedSpeed);
            lastLoggedBytes = downloadedBytes;
            lastLogTime = now;

            const pct = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 1000) / 10 : 0;

            db.execute({
              sql: `UPDATE import_jobs SET downloaded_bytes = ?, total_bytes = ?, speed_bps = ?, updated_at = ? WHERE id = ?`,
              args: [downloadedBytes, totalBytes, smoothedSpeed, new Date().toISOString(), jobId],
            }).catch(() => {});

            transferManager.emitProgress({
              jobId,
              type: 'url',
              filename: finalFilename,
              status: 'downloading',
              stage: 'Downloading from internet',
              downloaded_bytes: downloadedBytes,
              total_bytes: totalBytes,
              speed_bps: smoothedSpeed,
              percent: pct,
              extracted_files_count: 0,
              total_files_count: 0,
              detected_episodes_count: 0,
              target_folder_id: targetFolderId,
              updated_at: new Date().toISOString(),
            });
          }
        });

        res.pipe(writeStream);

        writeStream.on('finish', async () => {
          if (isCancelled) return;
          try {
            transferManager.unregisterCancelHandler(jobId);

            // Step 7: Inspect downloaded file for ZIP archive format
            const contentType = res.headers['content-type'];
            const isZip = checkIsZipArchive(tempFilePath, finalFilename, contentType);

            if (isZip) {
              console.log(`[XorvilaBox URL Import] Detected ZIP archive for Job ${jobId} (${finalFilename}). Starting VPS extraction pipeline...`);

              // Step 8: Automatically transition into the full ZIP processing pipeline on VPS
              // Stage 1 was Downloading (now 100% complete)
              // Stage 2 will be Extracting files...
              await db.execute({
                sql: `UPDATE import_jobs SET status = 'extracting', stage = 'Stage 2: Extracting files...', updated_at = ? WHERE id = ?`,
                args: [new Date().toISOString(), jobId],
              });

              // Execute VPS extraction, scanning, episode detection, database registration, and cleanup
              await runZipExtraction(
                jobId,
                tempFilePath,
                finalFilename,
                targetFolderId,
                targetFolderUid,
                'url'
              );

              resolve();
              return;
            }

            // Step 9: If NOT a ZIP archive, process as single file import
            const ext = path.extname(finalFilename) || '.mkv';
            let storedName = `${finalFilename}`;
            let destPath = path.join(targetDir, storedName);

            // Handle duplicate filename
            let counter = 1;
            const nameWithoutExt = path.basename(finalFilename, ext);
            while (fs.existsSync(destPath)) {
              storedName = `${nameWithoutExt} (${counter})${ext}`;
              destPath = path.join(targetDir, storedName);
              counter++;
            }

            fs.renameSync(tempFilePath, destPath);
            const finalStat = fs.statSync(destPath);
            const fileSize = finalStat.size;

            // Anime detection
            const animeMeta = parseAnimeFilename(storedName);
            const randomUid = crypto.randomBytes(6).toString('hex');
            const fileId = crypto.randomUUID();
            const nowIso = new Date().toISOString();
            const mimeType = getMimeType(ext);

            await db.execute({
              sql: `INSERT INTO files (id, folder_id, random_uid, original_filename, stored_filename, extension, mime_type, file_size, season_number, episode_number, resolution, audio_language, file_status, is_anime_episode, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?)`,
              args: [
                fileId,
                targetFolderId,
                randomUid,
                finalFilename,
                storedName,
                ext,
                mimeType,
                fileSize,
                animeMeta.seasonNumber,
                animeMeta.episodeNumber,
                animeMeta.resolution,
                animeMeta.audioLanguage,
                animeMeta.isAnimeEpisode ? 1 : 0,
                nowIso,
                nowIso,
              ],
            });

            await db.execute({
              sql: `UPDATE import_jobs SET status = 'completed', stage = 'Stage 6: Completed', downloaded_bytes = ?, total_bytes = ?, speed_bps = 0, current_file = ?, updated_at = ? WHERE id = ?`,
              args: [fileSize, fileSize, storedName, nowIso, jobId],
            });

            const rawUrl = `/r/${randomUid}/${encodeURIComponent(storedName)}?raw=1`;

            transferManager.emitProgress({
              jobId,
              type: 'url',
              filename: storedName,
              status: 'completed',
              stage: 'Uploaded successfully',
              stageNumber: 6,
              totalStages: 6,
              downloaded_bytes: fileSize,
              total_bytes: fileSize,
              speed_bps: 0,
              percent: 100,
              extracted_files_count: 1,
              total_files_count: 1,
              detected_episodes_count: animeMeta.isAnimeEpisode ? 1 : 0,
              target_folder_id: targetFolderId,
              file: {
                id: fileId,
                folder_id: targetFolderId,
                random_uid: randomUid,
                original_filename: finalFilename,
                stored_filename: storedName,
                file_size: fileSize,
                raw_url: rawUrl,
                is_anime_episode: animeMeta.isAnimeEpisode ? 1 : 0,
              },
              updated_at: nowIso,
            });

            resolve();
          } catch (err: any) {
            if (fs.existsSync(tempFilePath)) {
              try { fs.unlinkSync(tempFilePath); } catch {}
            }
            reject(err);
          }
        });

        writeStream.on('error', (err) => {
          if (fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch {}
          }
          reject(err);
        });
      }
    );

    // Register cancel handler for real-time VPS cleanup
    transferManager.registerCancelHandler(jobId, () => {
      isCancelled = true;
      try { req.destroy(new Error('Transfer cancelled by user')); } catch {}
      if (writeStream) {
        try { writeStream.destroy(); } catch {}
      }
      if (fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch {}
      }
      reject(new Error('Transfer cancelled by user'));
    });

    req.on('error', (err) => {
      if (fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch {}
      }
      reject(err);
    });

    req.setTimeout(600000, () => {
      req.destroy();
      reject(new Error('Connection timed out after 10 minutes'));
    });
  });
}
