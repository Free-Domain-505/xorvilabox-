import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getDb } from './db.js';
import { getFolderStoragePath, sanitizeFilename, getMimeType } from './storage.js';
import { parseAnimeFilename } from './animeParser.js';
import { transferManager } from './transferManager.js';

const MAX_ZIP_FILES = 5000;
const MAX_TOTAL_UNCOMPRESSED_SIZE = 25 * 1024 * 1024 * 1024; // 25 GB safety cap

export async function processZipArchive(
  zipFilePath: string,
  zipOriginalName: string,
  targetFolderId: string | null,
  targetFolderUid: string | null
): Promise<string> {
  const db = getDb();
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO import_jobs (id, type, target_folder_id, filename, status, stage, extracted_files_count, total_files_count, detected_episodes_count, created_at, updated_at)
          VALUES (?, 'zip', ?, ?, 'extracting', 'Stage 2: Extracting files...', 0, 0, 0, ?, ?)`,
    args: [jobId, targetFolderId, zipOriginalName, now, now],
  });

  // Emit initial extraction stage
  transferManager.emitProgress({
    jobId,
    type: 'zip',
    filename: zipOriginalName,
    status: 'extracting',
    stage: 'Extracting files...',
    stageNumber: 2,
    totalStages: 6,
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

  // Run in background
  runZipExtraction(jobId, zipFilePath, zipOriginalName, targetFolderId, targetFolderUid).catch(async (err) => {
    console.error(`[XorvilaBox ZIP Error] Job ${jobId} failed:`, err);
    transferManager.unregisterCancelHandler(jobId);

    const errorMsg = err.message || 'ZIP extraction failed';
    const isCancelled = errorMsg.includes('cancelled');

    await db.execute({
      sql: `UPDATE import_jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?`,
      args: [isCancelled ? 'cancelled' : 'failed', errorMsg, new Date().toISOString(), jobId],
    });

    if (!isCancelled) {
      transferManager.emitProgress({
        jobId,
        type: 'zip',
        filename: zipOriginalName,
        status: 'failed',
        stage: 'Extraction failed',
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

    // Cleanup temporary zip file
    if (fs.existsSync(zipFilePath)) {
      try { fs.unlinkSync(zipFilePath); } catch {}
    }
  });

  return jobId;
}

export async function runZipExtraction(
  jobId: string,
  zipFilePath: string,
  zipOriginalName: string,
  targetFolderId: string | null,
  targetFolderUid: string | null,
  jobType: 'zip' | 'url' = 'zip'
): Promise<void> {
  const db = getDb();
  const targetDir = getFolderStoragePath(targetFolderUid);

  let isCancelled = false;
  const createdDestPaths: string[] = [];

  transferManager.registerCancelHandler(jobId, () => {
    isCancelled = true;
    // Clean up created extracted files so far
    for (const f of createdDestPaths) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch {}
      }
    }
    // Clean up zip
    if (fs.existsSync(zipFilePath)) {
      try { fs.unlinkSync(zipFilePath); } catch {}
    }
    throw new Error('Transfer cancelled by user');
  });

  const zip = new AdmZip(zipFilePath);
  const zipEntries = zip.getEntries();

  // 1. Validation & Zip Slip Prevention & Bomb Detection
  if (zipEntries.length > MAX_ZIP_FILES) {
    throw new Error(`ZIP contains too many files (${zipEntries.length}). Maximum allowed is ${MAX_ZIP_FILES}`);
  }

  let totalUncompressedSize = 0;
  for (const entry of zipEntries) {
    if (isCancelled) throw new Error('Transfer cancelled by user');
    totalUncompressedSize += entry.header.size;
    if (totalUncompressedSize > MAX_TOTAL_UNCOMPRESSED_SIZE) {
      throw new Error(`Uncompressed ZIP size exceeds safe limit of 25GB.`);
    }

    // Zip Slip check
    const normalizedName = path.normalize(entry.entryName).replace(/^(\.\.(\/|\\|$))+/, '');
    const resolvedPath = path.resolve(targetDir, normalizedName);
    if (!resolvedPath.startsWith(path.resolve(targetDir))) {
      throw new Error(`Malicious ZIP entry detected (Zip Slip): ${entry.entryName}`);
    }
  }

  // 2. Intelligent Folder Hierarchy Unnesting
  const validEntries = zipEntries.filter(e => !e.isDirectory && !e.entryName.startsWith('__MACOSX') && !path.basename(e.entryName).startsWith('.'));
  const totalFiles = validEntries.length;

  let commonPrefix = '';
  if (validEntries.length > 0) {
    const firstParts = validEntries[0].entryName.split('/');
    if (firstParts.length > 1) {
      const candidate = firstParts[0] + '/';
      const allShare = validEntries.every(e => e.entryName.startsWith(candidate));
      if (allShare) {
        commonPrefix = candidate;
      }
    }
  }

  // Update total files count in DB
  await db.execute({
    sql: `UPDATE import_jobs SET total_files_count = ?, updated_at = ? WHERE id = ?`,
    args: [totalFiles, new Date().toISOString(), jobId],
  });

  // Stage 2: Extracting files
  transferManager.emitProgress({
    jobId,
    type: jobType,
    filename: zipOriginalName,
    status: 'extracting',
    stage: 'Stage 2: Extracting files...',
    stageNumber: 2,
    totalStages: 6,
    downloaded_bytes: 0,
    total_bytes: 0,
    speed_bps: 0,
    percent: 0,
    extracted_files_count: 0,
    total_files_count: totalFiles,
    detected_episodes_count: 0,
    target_folder_id: targetFolderId,
    updated_at: new Date().toISOString(),
  });

  const extractedItems: Array<{
    safeFileName: string;
    storedName: string;
    destPath: string;
    relativeEntryName: string;
    ext: string;
    fileSize: number;
  }> = [];

  // Perform extraction
  for (let i = 0; i < validEntries.length; i++) {
    if (isCancelled) throw new Error('Transfer cancelled by user');
    const entry = validEntries[i];
    let relativeEntryName = entry.entryName;
    if (commonPrefix && relativeEntryName.startsWith(commonPrefix)) {
      relativeEntryName = relativeEntryName.substring(commonPrefix.length);
    }

    const rawFileName = path.basename(relativeEntryName);
    if (!rawFileName || rawFileName.startsWith('.')) continue;

    const safeFileName = sanitizeFilename(rawFileName);
    const ext = path.extname(safeFileName) || '.mkv';

    let storedName = safeFileName;
    let destPath = path.join(targetDir, storedName);
    let counter = 1;
    const baseWithoutExt = path.basename(safeFileName, ext);
    while (fs.existsSync(destPath)) {
      storedName = `${baseWithoutExt} (${counter})${ext}`;
      destPath = path.join(targetDir, storedName);
      counter++;
    }

    const content = entry.getData();
    fs.writeFileSync(destPath, content);
    createdDestPaths.push(destPath);

    extractedItems.push({
      safeFileName,
      storedName,
      destPath,
      relativeEntryName,
      ext,
      fileSize: content.length,
    });

    // Update extraction progress periodically
    if (i % 3 === 0 || i === validEntries.length - 1) {
      const pct = Math.round(((i + 1) / totalFiles) * 100);
      await db.execute({
        sql: `UPDATE import_jobs SET extracted_files_count = ?, current_file = ?, updated_at = ? WHERE id = ?`,
        args: [extractedItems.length, storedName, new Date().toISOString(), jobId],
      });

      transferManager.emitProgress({
        jobId,
        type: jobType,
        filename: zipOriginalName,
        status: 'extracting',
        stage: `Stage 2: Extracting files (${extractedItems.length} / ${totalFiles})`,
        stageNumber: 2,
        totalStages: 6,
        downloaded_bytes: extractedItems.length,
        total_bytes: totalFiles,
        speed_bps: 0,
        percent: pct,
        extracted_files_count: extractedItems.length,
        total_files_count: totalFiles,
        detected_episodes_count: 0,
        current_file: storedName,
        target_folder_id: targetFolderId,
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Stage 3: Scanning files
  if (isCancelled) throw new Error('Transfer cancelled by user');
  await db.execute({
    sql: `UPDATE import_jobs SET status = 'scanning', stage = 'Stage 3: Scanning anime files...', updated_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), jobId],
  });

  transferManager.emitProgress({
    jobId,
    type: jobType,
    filename: zipOriginalName,
    status: 'scanning',
    stage: 'Stage 3: Scanning anime files...',
    stageNumber: 3,
    totalStages: 6,
    downloaded_bytes: 0,
    total_bytes: totalFiles,
    speed_bps: 0,
    percent: 100,
    extracted_files_count: extractedItems.length,
    total_files_count: totalFiles,
    detected_episodes_count: 0,
    target_folder_id: targetFolderId,
    updated_at: new Date().toISOString(),
  });

  // Stage 4: Detecting episodes
  if (isCancelled) throw new Error('Transfer cancelled by user');
  const parsedItems = extractedItems.map(item => {
    const animeMeta = parseAnimeFilename(item.storedName, item.relativeEntryName);
    return {
      ...item,
      animeMeta,
    };
  });

  const episodeCount = parsedItems.filter(p => p.animeMeta.isAnimeEpisode).length;

  await db.execute({
    sql: `UPDATE import_jobs SET status = 'detecting', stage = 'Stage 4: Detecting episodes...', detected_episodes_count = ?, updated_at = ? WHERE id = ?`,
    args: [episodeCount, new Date().toISOString(), jobId],
  });

  transferManager.emitProgress({
    jobId,
    type: jobType,
    filename: zipOriginalName,
    status: 'detecting',
    stage: `Stage 4: Detecting episodes (${episodeCount} detected)`,
    stageNumber: 4,
    totalStages: 6,
    downloaded_bytes: episodeCount,
    total_bytes: totalFiles,
    speed_bps: 0,
    percent: 100,
    extracted_files_count: extractedItems.length,
    total_files_count: totalFiles,
    detected_episodes_count: episodeCount,
    target_folder_id: targetFolderId,
    updated_at: new Date().toISOString(),
  });

  // Stage 5: Creating file records in database
  if (isCancelled) throw new Error('Transfer cancelled by user');
  let recordsCreated = 0;
  for (const item of parsedItems) {
    if (isCancelled) throw new Error('Transfer cancelled by user');
    const randomUid = crypto.randomBytes(6).toString('hex');
    const fileId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const mimeType = getMimeType(item.ext);

    await db.execute({
      sql: `INSERT INTO files (id, folder_id, random_uid, original_filename, stored_filename, extension, mime_type, file_size, season_number, episode_number, resolution, audio_language, file_status, is_anime_episode, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?)`,
      args: [
        fileId,
        targetFolderId,
        randomUid,
        item.safeFileName,
        item.storedName,
        item.ext,
        mimeType,
        item.fileSize,
        item.animeMeta.seasonNumber,
        item.animeMeta.episodeNumber,
        item.animeMeta.resolution,
        item.animeMeta.audioLanguage,
        item.animeMeta.isAnimeEpisode ? 1 : 0,
        nowIso,
        nowIso,
      ],
    });

    recordsCreated++;
    if (recordsCreated % 5 === 0 || recordsCreated === parsedItems.length) {
      transferManager.emitProgress({
        jobId,
        type: jobType,
        filename: zipOriginalName,
        status: 'creating_records',
        stage: `Stage 5: Creating database records (${recordsCreated} / ${parsedItems.length})`,
        stageNumber: 5,
        totalStages: 6,
        downloaded_bytes: recordsCreated,
        total_bytes: parsedItems.length,
        speed_bps: 0,
        percent: Math.round((recordsCreated / parsedItems.length) * 100),
        extracted_files_count: extractedItems.length,
        total_files_count: totalFiles,
        detected_episodes_count: episodeCount,
        current_file: item.storedName,
        target_folder_id: targetFolderId,
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Cleanup ZIP file on VPS
  if (fs.existsSync(zipFilePath)) {
    try { fs.unlinkSync(zipFilePath); } catch {}
  }

  transferManager.unregisterCancelHandler(jobId);

  // Stage 6: Completed
  await db.execute({
    sql: `UPDATE import_jobs SET status = 'completed', stage = 'Stage 6: Completed', extracted_files_count = ?, detected_episodes_count = ?, updated_at = ? WHERE id = ?`,
    args: [extractedItems.length, episodeCount, new Date().toISOString(), jobId],
  });

  transferManager.emitProgress({
    jobId,
    type: jobType,
    filename: zipOriginalName,
    status: 'completed',
    stage: `Stage 6: Completed - Successfully imported ${episodeCount > 0 ? `${episodeCount} episodes` : `${extractedItems.length} files`}.`,
    stageNumber: 6,
    totalStages: 6,
    downloaded_bytes: parsedItems.length,
    total_bytes: parsedItems.length,
    speed_bps: 0,
    percent: 100,
    extracted_files_count: extractedItems.length,
    total_files_count: totalFiles,
    detected_episodes_count: episodeCount,
    target_folder_id: targetFolderId,
    updated_at: new Date().toISOString(),
  });
}
