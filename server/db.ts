import { createClient, type Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';

let dbClient: Client | null = null;

export function getDb(): Client {
  if (!dbClient) {
    const dbUrl = process.env.DATABASE_URL || 'file:./data/xorvilabox.db';
    
    // If it's a file URL, ensure directory exists
    if (dbUrl.startsWith('file:')) {
      const filePath = dbUrl.replace('file:', '');
      const dir = path.dirname(path.resolve(process.cwd(), filePath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    dbClient = createClient({
      url: dbUrl,
    });
  }
  return dbClient;
}

export async function initDb(): Promise<void> {
  const db = getDb();

  // Create users table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );
  `);

  // Create folders table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      parent_id TEXT,
      name TEXT NOT NULL,
      folder_uid TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Create files table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      folder_id TEXT,
      random_uid TEXT UNIQUE NOT NULL,
      original_filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL,
      extension TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      season_number INTEGER,
      episode_number REAL,
      resolution TEXT,
      audio_language TEXT,
      file_status TEXT NOT NULL DEFAULT 'ready',
      is_anime_episode INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE
    );
  `);

  // Create import_jobs table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'url' or 'zip'
      source_url TEXT,
      target_folder_id TEXT,
      filename TEXT NOT NULL,
      status TEXT NOT NULL, -- 'pending', 'downloading', 'extracting', 'scanning', 'detecting', 'creating_records', 'completed', 'failed', 'cancelled'
      stage TEXT,
      downloaded_bytes INTEGER NOT NULL DEFAULT 0,
      total_bytes INTEGER NOT NULL DEFAULT 0,
      speed_bps INTEGER NOT NULL DEFAULT 0,
      extracted_files_count INTEGER NOT NULL DEFAULT 0,
      total_files_count INTEGER NOT NULL DEFAULT 0,
      detected_episodes_count INTEGER NOT NULL DEFAULT 0,
      current_file TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Migrate additional columns if table existed
  try {
    await db.execute(`ALTER TABLE import_jobs ADD COLUMN stage TEXT;`);
  } catch {}
  try {
    await db.execute(`ALTER TABLE import_jobs ADD COLUMN total_files_count INTEGER NOT NULL DEFAULT 0;`);
  } catch {}

  // Indexes for high performance querying
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_files_uid ON files(random_uid);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_files_episode ON files(season_number, episode_number);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON import_jobs(status);`);

  console.log('[XorvilaBox DB] SQLite database tables initialized.');
}
