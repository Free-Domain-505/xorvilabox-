import React, { useState } from 'react';
import { 
  FolderPlus, Upload, Globe, FileArchive, Search, ArrowUpDown, 
  ChevronRight, Home, Film, FileText, AlertTriangle, Loader2 
} from 'lucide-react';
import { type FileItem, type Folder, type BreadcrumbItem } from '../types.js';
import { EpisodeCard } from './EpisodeCard.js';
import { FileCard } from './FileCard.js';
import { FolderCard } from './FolderCard.js';

interface FileManagerProps {
  currentFolder: Folder | null;
  breadcrumbs: BreadcrumbItem[];
  folders: Folder[];
  files: FileItem[];
  loading: boolean;
  onNavigateFolder: (folder: Folder | null) => void;
  onOpenNewFolderModal: () => void;
  onOpenUploadModal: () => void;
  onOpenImportUrlModal: () => void;
  onOpenImportZipModal: () => void;
  onOpenRawModal: (file: FileItem) => void;
  onOpenVideoPlayer: (file: FileItem) => void;
  onCopyRawUrl: (file: FileItem) => void;
  onRenameItem: (item: FileItem | Folder, isFolder: boolean) => void;
  onMoveFile: (file: FileItem) => void;
  onDeleteItem: (item: FileItem | Folder, isFolder: boolean) => void;
  onShowDetails: (item: FileItem | Folder, isFolder: boolean) => void;
  isAuthenticated: boolean;
}

export const FileManager: React.FC<FileManagerProps> = ({
  currentFolder,
  breadcrumbs,
  folders,
  files,
  loading,
  onNavigateFolder,
  onOpenNewFolderModal,
  onOpenUploadModal,
  onOpenImportUrlModal,
  onOpenImportZipModal,
  onOpenRawModal,
  onOpenVideoPlayer,
  onCopyRawUrl,
  onRenameItem,
  onMoveFile,
  onDeleteItem,
  onShowDetails,
  isAuthenticated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'episode' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc' | 'date-desc'>('episode');

  // Filter based on search query
  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFiles = files.filter((f) =>
    f.stored_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Split files into anime episodes and other files
  const episodeFiles = filteredFiles.filter((f) => f.is_anime_episode === 1);
  const otherFiles = filteredFiles.filter((f) => f.is_anime_episode !== 1);

  // Sorting logic
  const sortFiles = (list: FileItem[]) => {
    return [...list].sort((a, b) => {
      if (sortOption === 'episode') {
        const epA = a.episode_number ?? 999999;
        const epB = b.episode_number ?? 999999;
        if (epA !== epB) return epA - epB;
        return a.stored_filename.localeCompare(b.stored_filename, undefined, { numeric: true });
      }
      if (sortOption === 'name-asc') {
        return a.stored_filename.localeCompare(b.stored_filename, undefined, { numeric: true });
      }
      if (sortOption === 'name-desc') {
        return b.stored_filename.localeCompare(a.stored_filename, undefined, { numeric: true });
      }
      if (sortOption === 'size-desc') {
        return b.file_size - a.file_size;
      }
      if (sortOption === 'size-asc') {
        return a.file_size - b.file_size;
      }
      if (sortOption === 'date-desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });
  };

  const sortedEpisodes = sortFiles(episodeFiles);
  const sortedOtherFiles = sortFiles(otherFiles);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Breadcrumbs (Section 12) */}
      <nav className="flex items-center gap-1 text-xs text-zinc-400 overflow-x-auto pb-1 font-medium select-none">
        <button
          onClick={() => onNavigateFolder(null)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0 active:scale-95 ${
            !currentFolder
              ? 'bg-zinc-900 text-orange-400 font-semibold border border-zinc-800 shadow-sm'
              : 'hover:text-white hover:bg-zinc-900/80'
          }`}
        >
          <Home className="w-3.5 h-3.5 text-orange-400" />
          <span>Home</span>
        </button>

        {breadcrumbs.map((bc, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={bc.id}>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <button
                onClick={() => {
                  const target = folders.find((f) => f.id === bc.id) || {
                    id: bc.id,
                    name: bc.name,
                    folder_uid: bc.folder_uid,
                    parent_id: null,
                    created_at: '',
                    updated_at: '',
                  };
                  onNavigateFolder(target);
                }}
                className={`px-2.5 py-1.5 rounded-lg transition-all truncate max-w-[160px] shrink-0 active:scale-95 ${
                  isLast
                    ? 'bg-zinc-900 text-orange-400 font-semibold border border-zinc-800 shadow-sm'
                    : 'hover:text-white hover:bg-zinc-900/80'
                }`}
              >
                {bc.name}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Top Action Bar: Search, Sort, New Folder, Upload, Import, Import ZIP */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-zinc-950/90 border border-zinc-800/90 rounded-2xl p-3.5 shadow-xl shadow-black/40 backdrop-blur-md">
        
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search anime files, episodes, or folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/80 focus:ring-1 focus:ring-orange-500/40 transition-all"
          />
        </div>

        {/* Sort & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Sort Dropdown */}
          <div className="relative flex items-center bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-700 transition-colors">
            <ArrowUpDown className="w-3.5 h-3.5 text-orange-400 mr-1.5 shrink-0" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer py-1 pr-1"
            >
              <option value="episode" className="bg-zinc-950 text-orange-400">Episode Number (Asc)</option>
              <option value="name-asc" className="bg-zinc-950 text-white">Name (A - Z)</option>
              <option value="name-desc" className="bg-zinc-950 text-white">Name (Z - A)</option>
              <option value="size-desc" className="bg-zinc-950 text-white">Size (Largest first)</option>
              <option value="size-asc" className="bg-zinc-950 text-white">Size (Smallest first)</option>
              <option value="date-desc" className="bg-zinc-950 text-white">Date Added (Newest)</option>
            </select>
          </div>

          {/* Action: + New Folder */}
          <button
            onClick={onOpenNewFolderModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-zinc-200 hover:text-white text-xs font-semibold border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all shadow-sm"
          >
            <FolderPlus className="w-3.5 h-3.5 text-orange-400" />
            <span>New Folder</span>
          </button>

          {/* Action: Upload */}
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-950/50 active:scale-95 transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>

          {/* Action: Import from URL */}
          <button
            onClick={onOpenImportUrlModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-zinc-200 hover:text-white text-xs font-semibold border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all shadow-sm"
          >
            <Globe className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">Import URL</span>
            <span className="sm:hidden">URL</span>
          </button>

          {/* Action: Import ZIP (Section 7) */}
          <button
            onClick={onOpenImportZipModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-orange-400 text-xs font-semibold border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all shadow-sm"
          >
            <FileArchive className="w-3.5 h-3.5 text-orange-400" />
            <span>Import ZIP</span>
          </button>

        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-orange-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-xs font-medium text-zinc-400">Loading filesystem contents...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Folders Section */}
          {filteredFolders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <span>Folders ({filteredFolders.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onOpen={onNavigateFolder}
                    onRename={(f) => onRenameItem(f, true)}
                    onDelete={(f) => onDeleteItem(f, true)}
                    onDetails={(f) => onShowDetails(f, true)}
                    isAuthenticated={isAuthenticated}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Anime Episode Cards Section (Section 14 & 15) */}
          {sortedEpisodes.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                  <Film className="w-4 h-4" />
                  <span>Anime Episodes ({sortedEpisodes.length})</span>
                </h3>
                <span className="text-[11px] font-mono text-zinc-500">
                  Automatically sorted by episode number
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sortedEpisodes.map((file) => (
                  <EpisodeCard
                    key={file.id}
                    file={file}
                    onOpenVideo={onOpenVideoPlayer}
                    onOpenRawModal={onOpenRawModal}
                    onCopyRawUrl={onCopyRawUrl}
                    onRename={(f) => onRenameItem(f, false)}
                    onMove={onMoveFile}
                    onDetails={(f) => onShowDetails(f, false)}
                    onDelete={(f) => onDeleteItem(f, false)}
                    isAuthenticated={isAuthenticated}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Other Files Section */}
          {sortedOtherFiles.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Other Files ({sortedOtherFiles.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sortedOtherFiles.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onOpenRawModal={onOpenRawModal}
                    onCopyRawUrl={onCopyRawUrl}
                    onRename={(f) => onRenameItem(f, false)}
                    onMove={onMoveFile}
                    onDetails={(f) => onShowDetails(f, false)}
                    onDelete={(f) => onDeleteItem(f, false)}
                    isAuthenticated={isAuthenticated}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty States (Section 22) */}
          {filteredFolders.length === 0 && filteredFiles.length === 0 && (
            <div className="bg-zinc-950/90 border border-zinc-800/90 rounded-2xl p-12 text-center max-w-md mx-auto my-8 space-y-4 shadow-xl shadow-black/40 backdrop-blur-sm">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 text-orange-400 flex items-center justify-center mx-auto shadow-inner">
                <Film className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {searchQuery ? 'No matching items found' : 'No files in this folder yet'}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {searchQuery
                    ? `No folders or episodes match "${searchQuery}".`
                    : 'Upload anime videos or import archives directly to the Ubuntu VPS.'}
                </p>
              </div>

              {!searchQuery && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    onClick={onOpenUploadModal}
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-950/50 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Files</span>
                  </button>

                  <button
                    onClick={onOpenImportZipModal}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-orange-400 text-xs font-semibold border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <FileArchive className="w-3.5 h-3.5 text-orange-400" />
                    <span>Import ZIP</span>
                  </button>

                  <button
                    onClick={onOpenNewFolderModal}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-zinc-200 hover:text-white text-xs font-semibold border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-orange-400" />
                    <span>+ New Folder</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

    </div>
  );
};
