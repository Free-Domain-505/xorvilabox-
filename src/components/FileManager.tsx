import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, Upload, Globe, FileArchive, Search, ArrowUpDown, 
  ChevronRight, Home, Film, FileText, AlertTriangle, Loader2,
  Copy, Check, ListOrdered, Download, Move, Trash2, X
} from 'lucide-react';
import { type FileItem, type Folder, type BreadcrumbItem } from '../types.js';
import { EpisodeCard } from './EpisodeCard.js';
import { FileCard } from './FileCard.js';
import { FolderCard } from './FolderCard.js';
import { BatchLinksModal } from './BatchLinksModal.js';
import { BulkMoveModal } from './BulkMoveModal.js';

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
  onShowToast?: (msg: string) => void;
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
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'episode' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc' | 'date-desc'>('episode');
  const [copiedAll, setCopiedAll] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Selection state
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

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

  const visibleFiles = [...sortedEpisodes, ...sortedOtherFiles];
  const allVisibleSelected = visibleFiles.length > 0 && visibleFiles.every((f) => selectedFileIds.includes(f.id));

  // Sync selection with current file lists (remove selected files that don't exist anymore)
  useEffect(() => {
    setSelectedFileIds((prev) => prev.filter((id) => files.some((f) => f.id === id)));
  }, [files]);

  // Clear selection on folder navigation
  useEffect(() => {
    setSelectedFileIds([]);
  }, [currentFolder]);

  const handleSelectAll = () => {
    if (visibleFiles.length === 0) return;
    if (allVisibleSelected) {
      // Deselect all visible
      const visibleIds = visibleFiles.map((f) => f.id);
      setSelectedFileIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      // Select all visible
      const newSelection = Array.from(new Set([...selectedFileIds, ...visibleFiles.map((f) => f.id)]));
      setSelectedFileIds(newSelection);
    }
  };

  const handleToggleFileSelection = (fileId: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  const handleBulkDownload = () => {
    if (selectedFileIds.length === 0) return;
    const ids = selectedFileIds.join(',');
    window.location.href = `/api/files/bulk-download?ids=${ids}`;
    if (onShowToast) {
      onShowToast(`Preparing native streaming ZIP archive for ${selectedFileIds.length} files...`);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleteLoading(true);
    setBulkDeleteError(null);
    try {
      const res = await fetch('/api/files/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: selectedFileIds }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to bulk delete files');

      if (onShowToast) {
        onShowToast(`Successfully deleted ${selectedFileIds.length} files from VPS filesystem`);
      }

      setSelectedFileIds([]);
      setShowBulkDeleteConfirm(false);
      onNavigateFolder(currentFolder);
    } catch (err: any) {
      setBulkDeleteError(err.message || 'An error occurred while deleting files');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleCopyAllLinks = (targetEpisodes: FileItem[]) => {
    if (targetEpisodes.length === 0) return;
    const links = targetEpisodes.map((ep) => ep.raw_url).join('\n');
    navigator.clipboard.writeText(links);
    copiedAllHelper(targetEpisodes.length);
  };

  const copiedAllHelper = (count: number) => {
    setCopiedAll(true);
    if (onShowToast) {
      onShowToast(`Copied ${count} episode direct raw link${count === 1 ? '' : 's'} to clipboard`);
    }
    setTimeout(() => setCopiedAll(false), 2200);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative">
      
      {/* Breadcrumbs (Section 12) */}
      <nav className="flex items-center gap-1 text-xs text-zinc-400 overflow-x-auto pb-1 font-medium select-none">
        <button
          onClick={() => onNavigateFolder(null)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0 active:scale-95 cursor-pointer ${
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
                className={`px-2.5 py-1.5 rounded-lg transition-all truncate max-w-[160px] shrink-0 active:scale-95 cursor-pointer ${
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-zinc-200 hover:text-white text-xs font-semibold border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-orange-400" />
            <span>New Folder</span>
          </button>

          {/* Action: Upload */}
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-950/50 active:scale-95 transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>

          {/* Action: Import from URL */}
          <button
            onClick={onOpenImportUrlModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-zinc-200 hover:text-white text-xs font-semibold border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">Import URL</span>
            <span className="sm:hidden">URL</span>
          </button>

          {/* Action: Import ZIP (Section 7) */}
          <button
            onClick={onOpenImportZipModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-orange-400 text-xs font-semibold border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <FileArchive className="w-3.5 h-3.5 text-orange-400" />
            <span>Import ZIP</span>
          </button>

          {/* Action: Copy All Episode Links (if folder contains episodes) */}
          {sortedEpisodes.length > 0 && (
            <button
              onClick={() => handleCopyAllLinks(sortedEpisodes)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/30 text-xs font-semibold active:scale-95 transition-all shadow-sm cursor-pointer"
              title="Copy direct raw URLs for all episodes in this view"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Copied Links!' : `Copy All Links (${sortedEpisodes.length})`}</span>
            </button>
          )}

        </div>
      </div>

      {/* Select All / Deselect All Selection Bar */}
      <div className="flex items-center justify-between bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-300 shadow-sm">
        <div className="flex items-center gap-3">
          {visibleFiles.length === 0 ? (
            <button
              disabled
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-600 font-semibold text-xs"
            >
              No files to select
            </button>
          ) : (
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all text-orange-400 font-semibold cursor-pointer text-xs"
            >
              {allVisibleSelected ? 'Deselect All' : 'Select All'}
            </button>
          )}
          <span className="font-mono text-zinc-400 font-medium">
            {selectedFileIds.length > 0 
              ? `Selected: ${selectedFileIds.length} file${selectedFileIds.length === 1 ? '' : 's'}` 
              : 'No files selected'}
          </span>
        </div>
        <div className="text-zinc-500 font-mono text-[11px] hidden sm:block">
          {visibleFiles.length === 0 ? 'Empty folder view' : `${visibleFiles.length} files available in folder`}
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

          {/* Anime Episode Cards Section */}
          {sortedEpisodes.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0 shadow-inner">
                    <Film className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                      <span>Anime Episodes ({sortedEpisodes.length})</span>
                    </h3>
                    <p className="text-[11px] font-mono text-zinc-500">
                      Direct streaming & download endpoints ready
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyAllLinks(sortedEpisodes)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-950/40 active:scale-95 transition-all cursor-pointer"
                    title="Copy all direct raw URLs to clipboard (1 URL per line)"
                  >
                    {copiedAll ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Copied {sortedEpisodes.length} Links!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy All Links</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowBatchModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-medium transition-all cursor-pointer"
                    title="View all URLs, export M3U playlist or download TXT list"
                  >
                    <ListOrdered className="w-3.5 h-3.5 text-orange-400" />
                    <span>Options / Playlist</span>
                  </button>
                </div>
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
                    isSelected={selectedFileIds.includes(file.id)}
                    onToggleSelect={() => handleToggleFileSelection(file.id)}
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
                    isSelected={selectedFileIds.includes(file.id)}
                    onToggleSelect={() => handleToggleFileSelection(file.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty States */}
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
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-950/50 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Files</span>
                  </button>

                  <button
                    onClick={onOpenImportZipModal}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-orange-400 text-xs font-semibold border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileArchive className="w-3.5 h-3.5 text-orange-400" />
                    <span>Import ZIP</span>
                  </button>

                  <button
                    onClick={onOpenNewFolderModal}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-zinc-200 hover:text-white text-xs font-semibold border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
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

      {/* Batch Links Export Modal */}
      <BatchLinksModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        episodes={sortedEpisodes}
        folderName={currentFolder?.name}
        onShowToast={onShowToast || (() => {})}
      />

      {/* Bulk Action Sticky/Fixed Toolbar */}
      {selectedFileIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-zinc-950 border border-orange-500/30 shadow-2xl shadow-black/90 px-5 py-3 rounded-2xl flex flex-col sm:flex-row items-center gap-4 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200 text-zinc-100 max-w-[90vw] sm:max-w-none">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shadow shadow-orange-500/50" />
            <span className="text-xs font-extrabold text-white whitespace-nowrap font-mono">
              {selectedFileIds.length} item{selectedFileIds.length === 1 ? '' : 's'} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
            {/* Bulk Download */}
            <button
              onClick={handleBulkDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600/15 hover:bg-orange-600/25 text-orange-400 border border-orange-500/25 text-xs font-bold active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              title="Download selected items as a ZIP"
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              <span>Download ZIP</span>
            </button>

            {/* Bulk Move */}
            {isAuthenticated && (
              <button
                onClick={() => setShowBulkMoveModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 text-xs font-bold active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                title="Move selected items to another folder"
              >
                <Move className="w-3.5 h-3.5 text-zinc-400" />
                <span>Move</span>
              </button>
            )}

            {/* Bulk Delete */}
            {isAuthenticated && (
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 text-rose-400 border border-rose-500/25 text-xs font-bold active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                title="Delete selected items from VPS and DB"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}

            {/* Cancel Selection */}
            <button
              onClick={() => setSelectedFileIds([])}
              className="px-3 py-1.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800/50 text-xs font-semibold active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bulk Move Modal */}
      {showBulkMoveModal && (
        <BulkMoveModal
          fileIds={selectedFileIds}
          folders={folders}
          onClose={() => setShowBulkMoveModal(false)}
          onSuccess={() => {
            setSelectedFileIds([]);
            onNavigateFolder(currentFolder);
          }}
          onShowToast={onShowToast || (() => {})}
        />
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-black/80 relative text-zinc-100">
            <button
              onClick={() => setShowBulkDeleteConfirm(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete {selectedFileIds.length} files?</h3>
                <p className="text-xs text-zinc-400">
                  This action cannot be undone and will delete files permanently from the VPS storage.
                </p>
              </div>
            </div>

            {bulkDeleteError && (
              <p className="text-xs text-rose-400 mb-3 bg-rose-950/20 border border-rose-500/20 p-2.5 rounded-lg">
                {bulkDeleteError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800/80">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkDeleteLoading}
                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-zinc-300 text-xs font-semibold border border-zinc-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteLoading}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 active:scale-95 disabled:bg-zinc-800 text-white text-xs font-bold shadow-md shadow-orange-950/40 transition-all"
              >
                {bulkDeleteLoading ? 'Deleting...' : 'Delete Files'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
