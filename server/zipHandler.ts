import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { spawn, execSync, type ChildProcess } from 'child_process';
import sevenBin from '7zip-bin';
import { getDb } from './db.js';
import { getFolderStoragePath, sanitizeFilename, getMimeType } from './storage.js';
import { parseAnimeFilename } from './animeParser.js';
import { transferManager } from './transferManager.js';

const MAX_ZIP_FILES = 5000;

/**
 * Locate a working 7za or 7z binary.
 * Checks bundled 7zip-bin, system PATH via `which`, and standard Linux locations.
 */
export function get7zBinary(): string | null {
  try {
    if (sevenBin && sevenBin.path7za && fs.existsSync(sevenBin.path7za)) {
      try {
        fs.chmodSync(sevenBin.path7za, 0o755);
      } catch {}
      return sevenBin.path7za;
    }
  } catch {}

  try {
    const which = execSync('which 7z || which 7za || which 7zr || command -v 7z || command -v 7za', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (which && fs.existsSync(which)) {
      return which;
    }
  } catch {}

  for (const bin of [
    '/usr/bin/7z',
    '/usr/bin/7za',
    '/usr/bin/7zr',
    '/usr/local/bin/7z',
    '/usr/local/bin/7za',
    '/bin/7z',
    '/bin/7za',
  ]) {
    try {
      if (fs.existsSync(bin)) return bin;
    } catch {}
  }
  return null;
}

/**
 * Locate system unzip binary.
 */
function getUnzipBinary(): string | null {
  try {
    const which = execSync('which unzip || command -v unzip', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (which && fs.existsSync(which)) {
      return which;
    }
  } catch {}

  for (const bin of ['/usr/bin/unzip', '/usr/local/bin/unzip', '/bin/unzip']) {
    try {
      if (fs.existsSync(bin)) return bin;
    } catch {}
  }
  return null;
}

/**
 * Inspect magic bytes of the archive file.
 */
export function detectArchiveFormat(filePath: string): '7z' | 'zip' | 'rar' | 'tar' | 'unknown' {
  try {
    if (fs.existsSync(filePath)) {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(8);
      const bytesRead = fs.readSync(fd, buffer, 0, 8, 0);
      fs.closeSync(fd);
      if (bytesRead >= 4) {
        // 7-Zip: 7z\xBC\xAF\x27\x1C
        if (buffer[0] === 0x37 && buffer[1] === 0x7a && buffer[2] === 0xbc && buffer[3] === 0xaf) {
          return '7z';
        }
        // ZIP: PK\x03\x04 or PK\x05\x06 or PK\x07\x08
        if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
          return 'zip';
        }
        // RAR: Rar!\x1A\x07
        if (buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21) {
          return 'rar';
        }
      }
    }
  } catch {}
  return 'unknown';
}

/**
 * Recursively collect all files within a directory.
 */
function getAllFilesRecursive(dirPath: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return fileList;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      getAllFilesRecursive(fullPath, fileList);
    } else if (entry.isFile()) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

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
    console.error(`[XorvilaBox Archive Error] Job ${jobId} failed:`, err);
    transferManager.unregisterCancelHandler(jobId);

    const errorMsg = err.message || 'Archive extraction failed';
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

    // Cleanup temporary archive file
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
  const stagingDir = path.join(targetDir, `.staging-${jobId}`);

  let isCancelled = false;
  let activeProcess: ChildProcess | null = null;
  const createdDestPaths: string[] = [];

  transferManager.registerCancelHandler(jobId, () => {
    isCancelled = true;
    if (activeProcess) {
      try { activeProcess.kill('SIGTERM'); } catch {}
    }
    // Clean up created extracted files so far
    for (const f of createdDestPaths) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch {}
      }
    }
    // Clean up staging directory
    if (fs.existsSync(stagingDir)) {
      try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch {}
    }
    // Clean up archive
    if (fs.existsSync(zipFilePath)) {
      try { fs.unlinkSync(zipFilePath); } catch {}
    }
    throw new Error('Transfer cancelled by user');
  });

  try {
    fs.mkdirSync(stagingDir, { recursive: true });
  } catch (err: any) {
    throw new Error(`Failed to create staging directory: ${err.message}`);
  }

  // Detect real archive format from magic bytes (fixes .zip files that are actually 7z or RAR)
  const realFormat = detectArchiveFormat(zipFilePath);
  const sevenBinPath = get7zBinary();
  const unzipBinPath = getUnzipBinary();

  console.log(`[XorvilaBox Archive] Extracting Job ${jobId} (${zipOriginalName}) - detected format: ${realFormat}, 7za: ${sevenBinPath ? 'available' : 'none'}`);

  let extractionSuccess = false;
  let lastExtractionError = '';

  // PRIMARY STRATEGY: 7za extraction (handles .7z, .zip, .rar, zip64, multi-GB streams without RAM bloat)
  if (sevenBinPath && !isCancelled) {
    try {
      await new Promise<void>((resolve, reject) => {
        // -y: answer yes to all prompts
        // -p-: do not prompt for password (fail or proceed as unencrypted)
        // -bd: disable progress indicator
        const proc = spawn(sevenBinPath, ['x', '-y', '-p-', `-o${stagingDir}`, zipFilePath], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        activeProcess = proc;

        let output = '';
        proc.stdout?.on('data', (d) => { output += d.toString(); });
        proc.stderr?.on('data', (d) => { output += d.toString(); });

        proc.on('close', (code) => {
          activeProcess = null;
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`7-Zip exited with code ${code}: ${output.trim() || 'Extraction failed'}`));
          }
        });

        proc.on('error', (err) => {
          activeProcess = null;
          reject(err);
        });
      });
      extractionSuccess = true;
    } catch (err: any) {
      console.warn(`[XorvilaBox Archive] 7za extraction attempt failed:`, err.message);
      lastExtractionError = err.message;
    }
  }

  // SECONDARY STRATEGY: System unzip (if format is zip or 7za wasn't available)
  if (!extractionSuccess && unzipBinPath && !isCancelled && realFormat !== '7z' && realFormat !== 'rar') {
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(unzipBinPath, ['-q', '-o', '-d', stagingDir, zipFilePath], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        activeProcess = proc;

        let output = '';
        proc.stdout?.on('data', (d) => { output += d.toString(); });
        proc.stderr?.on('data', (d) => { output += d.toString(); });

        proc.on('close', (code) => {
          activeProcess = null;
          if (code === 0 || code === 1) { // 1 = warnings in unzip
            resolve();
          } else {
            reject(new Error(`System unzip exited with code ${code}: ${output.trim() || 'Extraction failed'}`));
          }
        });

        proc.on('error', (err) => {
          activeProcess = null;
          reject(err);
        });
      });
      extractionSuccess = true;
    } catch (err: any) {
      console.warn(`[XorvilaBox Archive] unzip extraction attempt failed:`, err.message);
      lastExtractionError = err.message;
    }
  }

  // TERTIARY STRATEGY: AdmZip (pure JavaScript fallback for standard small zip files)
  if (!extractionSuccess && !isCancelled && realFormat !== '7z' && realFormat !== 'rar') {
    try {
      const zip = new AdmZip(zipFilePath);
      zip.extractAllTo(stagingDir, true);
      extractionSuccess = true;
    } catch (err: any) {
      console.warn(`[XorvilaBox Archive] AdmZip extraction attempt failed:`, err.message);
      lastExtractionError = err.message;
    }
  }

  if (!extractionSuccess) {
    // Clean up staging directory
    if (fs.existsSync(stagingDir)) {
      try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch {}
    }
    if (isCancelled) throw new Error('Transfer cancelled by user');

    let errorDetails = lastExtractionError || 'Archive extraction failed.';
    if (errorDetails.includes('No END header found') || errorDetails.includes('Invalid or unsupported zip format')) {
      errorDetails = `Zip archive format unsupported or corrupted (often Zip64 or 7-Zip). Please install 7-Zip on your VPS by running: sudo apt-get update && sudo apt-get install -y p7zip-full unzip`;
    }

    throw new Error(errorDetails);
  }

  if (isCancelled) throw new Error('Transfer cancelled by user');

  // Collect all extracted files from staging directory
  const allStagedFiles = getAllFilesRecursive(stagingDir);

  // Filter out system files, hidden files, and __MACOSX metadata
  const validFiles = allStagedFiles.filter((filePath) => {
    const filename = path.basename(filePath);
    const rel = path.relative(stagingDir, filePath);
    if (filename.startsWith('.') || filename === 'Thumbs.db' || filename === 'desktop.ini') return false;
    if (rel.startsWith('__MACOSX') || rel.includes('/__MACOSX/')) return false;
    return true;
  });

  if (validFiles.length > MAX_ZIP_FILES) {
    if (fs.existsSync(stagingDir)) {
      try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch {}
    }
    throw new Error(`Archive contains too many files (${validFiles.length}). Maximum allowed is ${MAX_ZIP_FILES}`);
  }

  const totalFiles = validFiles.length;
  if (totalFiles === 0) {
    if (fs.existsSync(stagingDir)) {
      try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch {}
    }
    throw new Error('Archive contains no valid media or files to extract.');
  }

  // Detect common folder prefix to unnest single root folders (e.g. "S1 The Shiunji Family Children 1080p 7-12 HD/")
  let commonPrefix = '';
  const relativeFilePaths = validFiles.map((f) => path.relative(stagingDir, f));
  if (relativeFilePaths.length > 0) {
    const firstParts = relativeFilePaths[0].split(path.sep);
    if (firstParts.length > 1) {
      const candidate = firstParts[0] + path.sep;
      const allShare = relativeFilePaths.every((p) => p.startsWith(candidate));
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

  // Stage 2: Moving extracted files into destination folder
  transferManager.emitProgress({
    jobId,
    type: jobType,
    filename: zipOriginalName,
    status: 'extracting',
    stage: 'Stage 2: Processing extracted files...',
    stageNumber: 2,
    totalStages: 6,
    downloaded_bytes: 0,
    total_bytes: totalFiles,
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

  for (let i = 0; i < validFiles.length; i++) {
    if (isCancelled) throw new Error('Transfer cancelled by user');
    const sourceFilePath = validFiles[i];
    let relativeEntryName = path.relative(stagingDir, sourceFilePath);

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

    // Move file from staging to final target directory
    try {
      fs.renameSync(sourceFilePath, destPath);
    } catch {
      // Fallback if crossing partitions
      fs.copyFileSync(sourceFilePath, destPath);
      try { fs.unlinkSync(sourceFilePath); } catch {}
    }
    createdDestPaths.push(destPath);

    const fileSize = fs.existsSync(destPath) ? fs.statSync(destPath).size : 0;

    extractedItems.push({
      safeFileName,
      storedName,
      destPath,
      relativeEntryName,
      ext,
      fileSize,
    });

    // Update extraction progress
    if (i % 3 === 0 || i === validFiles.length - 1) {
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
        stage: `Stage 2: Extracted files (${extractedItems.length} / ${totalFiles})`,
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

  // Cleanup staging directory
  if (fs.existsSync(stagingDir)) {
    try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch {}
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
  const parsedItems = extractedItems.map((item) => {
    const animeMeta = parseAnimeFilename(item.storedName, item.relativeEntryName);
    return {
      ...item,
      animeMeta,
    };
  });

  const episodeCount = parsedItems.filter((p) => p.animeMeta.isAnimeEpisode).length;

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

  // Cleanup archive file on VPS
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
