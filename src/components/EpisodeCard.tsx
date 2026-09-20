import React, { useState, useRef, useEffect } from 'react';
import { Play, Link2, MoreVertical, Film, FileEdit, Move, Trash2, Info, Copy, Check } from 'lucide-react';
import { type FileItem } from '../types.js';
import { formatBytes, getEpisodeBadge } from '../utils/format.js';

interface EpisodeCardProps {
  file: FileItem;
  onOpenVideo: (file: FileItem) => void;
  onOpenRawModal: (file: FileItem) => void;
  onCopyRawUrl: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onMove: (file: FileItem) => void;
  onDetails: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  isAuthenticated: boolean;
}

export const EpisodeCard: React.FC<EpisodeCardProps> = ({
  file,
  onOpenVideo,
  onOpenRawModal,
  onCopyRawUrl,
  onRename,
  onMove,
  onDetails,
  onDelete,
  isAuthenticated,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyRawUrl(file);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const episodeBadge = getEpisodeBadge(file.season_number, file.episode_number);

  return (
    <div className="relative group bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 rounded-xl p-4 transition-all duration-150 active:scale-[0.99] shadow-sm hover:shadow-lg flex flex-col justify-between">
      
      {/* Top Header: Episode Badge & Quick Menu */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-orange-400 shrink-0 shadow-inner">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-tight text-white group-hover:text-orange-400 transition-colors">
              {episodeBadge || file.stored_filename}
            </h4>
            <p className="text-[11px] text-zinc-400 font-mono truncate max-w-[210px]" title={file.stored_filename}>
              {file.stored_filename}
            </p>
          </div>
        </div>

        {/* Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
            title="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl shadow-black/80 z-20 py-1 text-xs backdrop-blur-md">
              <button
                onClick={() => { setMenuOpen(false); onOpenVideo(file); }}
                className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors"
              >
                <Play className="w-3.5 h-3.5 text-orange-400" />
                <span>Open in Player</span>
              </button>

              <button
                onClick={(e) => { setMenuOpen(false); handleCopy(e); }}
                className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-orange-400" />}
                <span>Copy Raw URL</span>
              </button>

              <button
                onClick={() => { setMenuOpen(false); onOpenRawModal(file); }}
                className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors"
              >
                <Link2 className="w-3.5 h-3.5 text-orange-400" />
                <span>Show Raw URL</span>
              </button>

              <button
                onClick={() => { setMenuOpen(false); onDetails(file); }}
                className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors"
              >
                <Info className="w-3.5 h-3.5 text-zinc-400" />
                <span>File Details</span>
              </button>

              {isAuthenticated && (
                <>
                  <div className="my-1 border-t border-zinc-800/80" />
                  <button
                    onClick={() => { setMenuOpen(false); onRename(file); }}
                    className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors"
                  >
                    <FileEdit className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Rename</span>
                  </button>

                  <button
                    onClick={() => { setMenuOpen(false); onMove(file); }}
                    className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors"
                  >
                    <Move className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Move</span>
                  </button>

                  <button
                    onClick={() => { setMenuOpen(false); onDelete(file); }}
                    className="w-full px-3 py-2 flex items-center gap-2 text-rose-400 hover:bg-rose-950/40 active:bg-rose-950/60 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Delete File</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metadata Badges: Resolution, Audio/Language, File Size */}
      <div className="flex flex-wrap items-center gap-1.5 my-3">
        {file.resolution && (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-900 text-orange-400 border border-zinc-800">
            {file.resolution}
          </span>
        )}
        {file.audio_language && (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-900 text-orange-300 border border-zinc-800">
            {file.audio_language}
          </span>
        )}
        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800">
          {formatBytes(file.file_size)}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase text-orange-400/80">
          {file.extension.replace('.', '')}
        </span>
      </div>

      {/* Actions: [ Open ] [ Raw ] [ Copy Link ] */}
      <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-2">
        <button
          onClick={() => onOpenVideo(file)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 active:bg-orange-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-orange-950/40 transition-all"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>Open</span>
        </button>

        <button
          onClick={() => onOpenRawModal(file)}
          className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 active:scale-95 text-orange-400 text-xs font-semibold border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-1"
        >
          <Link2 className="w-3.5 h-3.5 text-orange-400" />
          <span>Raw</span>
        </button>

        <button
          onClick={handleCopy}
          title="Copy direct streaming URL"
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 active:scale-95 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-all"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

    </div>
  );
};
