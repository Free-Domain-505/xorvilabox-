export interface User {
  id: string;
  username: string;
  role: string;
}

export interface Folder {
  id: string;
  parent_id: string | null;
  name: string;
  folder_uid: string;
  file_count?: number;
  subfolder_count?: number;
  created_at: string;
  updated_at: string;
}

export interface FileItem {
  id: string;
  folder_id: string | null;
  random_uid: string;
  original_filename: string;
  stored_filename: string;
  extension: string;
  mime_type: string;
  file_size: number;
  season_number: number | null;
  episode_number: number | null;
  resolution: string | null;
  audio_language: string | null;
  file_status: string;
  is_anime_episode: number;
  raw_url: string;
  created_at: string;
  updated_at: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
  folder_uid: string;
}

export interface ImportJob {
  id: string;
  type: 'url' | 'zip';
  source_url?: string;
  target_folder_id?: string;
  filename: string;
  status: 'pending' | 'downloading' | 'extracting' | 'scanning' | 'detecting' | 'creating_records' | 'completed' | 'failed' | 'cancelled';
  stage?: string;
  downloaded_bytes: number;
  total_bytes: number;
  speed_bps: number;
  extracted_files_count: number;
  total_files_count?: number;
  detected_episodes_count: number;
  current_file?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export type TransferType = 'upload' | 'url' | 'zip';

export type TransferStatus =
  | 'pending'
  | 'uploading'
  | 'downloading'
  | 'extracting'
  | 'scanning'
  | 'detecting'
  | 'creating_records'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TransferItem {
  id: string;
  type: TransferType;
  filename: string;
  fileType?: string;
  status: TransferStatus;
  stage?: string;
  stageNumber?: number;
  totalStages?: number;
  loaded: number;
  total: number;
  speed: number;
  percent: number;
  extracted_files_count?: number;
  total_files_count?: number;
  detected_episodes_count?: number;
  current_file?: string;
  error?: string;
  targetFolderId?: string | null;
  targetFolderName?: string;
  file?: {
    id: string;
    folder_id: string | null;
    random_uid?: string;
    stored_filename: string;
    file_size: number;
    raw_url: string;
    is_anime_episode?: number;
  };
  createdAt: number;
  completedAt?: number;
  canCancel: boolean;
  canRetry: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
}

export interface StorageStats {
  disk: {
    totalDiskBytes: number;
    freeDiskBytes: number;
    usedDiskBytes: number;
    xorvilaBoxBytes: number;
    storagePath: string;
  };
  platform: {
    totalFiles: number;
    totalFolders: number;
    xorvilaBoxBytes: number;
    storagePath: string;
  };
}

export interface DashboardData {
  stats: {
    disk: {
      totalDiskBytes: number;
      freeDiskBytes: number;
      usedDiskBytes: number;
      xorvilaBoxBytes: number;
      storagePath: string;
    };
    totalFiles: number;
    totalFolders: number;
    xorvilaBoxBytes: number;
  };
  recentFiles: FileItem[];
  recentEpisodes: FileItem[];
  recentFolders: Folder[];
  recentJobs: ImportJob[];
}
