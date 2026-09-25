import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  isSelected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
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
  isSelected = false,
  onToggleSelect,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownWidth = 192; // 12rem = w-48 is 192px
      const dropdownHeight = isAuthenticated ? 260 : 160;

      let top = rect.bottom + window.scrollY + 4;
      let left = rect.right + window.scrollX - dropdownWidth;

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // If dropdown exceeds viewport bottom, open upward
      if (rect.bottom + dropdownHeight > viewportHeight && rect.top - dropdownHeight > 0) {
        top = rect.top + window.scrollY - dropdownHeight - 4;
      }

      // Keep inside horizontal viewport boundaries
      if (left + dropdownWidth > viewportWidth) {
        left = viewportWidth - dropdownWidth - 8;
      }
      if (left < 8) {
        left = 8;
      }

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [menuOpen, isAuthenticated]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyRawUrl(file);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const episodeBadge = getEpisodeBadge(file.season_number, file.episode_number);

  return (
    <div className={`relative group bg-zinc-950/80 hover:bg-zinc-900 border rounded-xl p-4 transition-all duration-150 active:scale-[0.99] shadow-sm hover:shadow-lg flex flex-col justify-between ${
      isSelected ? 'border-orange-500 bg-orange-950/10 shadow-orange-950/20' : 'border-zinc-800/80 hover:border-zinc-700'
    }`}>
      
      {/* Top Header: Checkbox, Episode Badge & Quick Menu */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          
          {/* Checkbox selector */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(e);
            }}
            className={`w-5 h-5 rounded flex items-center justify-center border transition-all shrink-0 active:scale-90 cursor-pointer ${
              isSelected
                ? 'bg-orange-600 border-orange-500 text-white'
                : 'bg-zinc-900/80 border-zinc-700 text-transparent hover:border-orange-500/50'
            }`}
            title={isSelected ? "Deselect item" : "Select item"}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </button>

          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-orange-400 shrink-0 shadow-inner">
            <Film className="w-4 h-4" />
          </div>
          
          <div className="min-w-0">
            <h4 className="text-sm font-bold tracking-tight text-white group-hover:text-orange-400 transition-colors truncate">
              {episodeBadge || file.stored_filename}
            </h4>
            <p className="text-[11px] text-zinc-400 font-mono truncate max-w-[150px]" title={file.stored_filename}>
              {file.stored_filename}
            </p>
          </div>
        </div>

        {/* Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            ref={triggerRef}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
            title="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && createPortal(
            <div
              ref={dropdownRef}
              style={{
                position: 'absolute',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: '192px',
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl shadow-black/90 z-[9999] py-1 text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                onClick={() => { setMenuOpen(false); onOpenVideo(file); }}
                className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-orange-400" />
                <span>Open in Player</span>
              </button>

              <button
                onClick={(e) => { setMenuOpen(false); handleCopy(e); }}
                className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-orange-400" />}
                <span>Copy Raw URL</span>
              </button>

              <button
                onClick={() => { setMenuOpen(false); onOpenRawModal(file); }}
                className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5 text-orange-400" />
                <span>Show Raw URL</span>
              </button>

              <button
                onClick={() => { setMenuOpen(false); onDetails(file); }}
                className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Info className="w-3.5 h-3.5 text-zinc-400" />
                <span>File Details</span>
              </button>

              {isAuthenticated && (
                <>
                  <div className="my-1 border-t border-zinc-800/80" />
                  <button
                    onClick={() => { setMenuOpen(false); onRename(file); }}
                    className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <FileEdit className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Rename</span>
                  </button>

                  <button
                    onClick={() => { setMenuOpen(false); onMove(file); }}
                    className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Move className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Move</span>
                  </button>

                  <button
                    onClick={() => { setMenuOpen(false); onDelete(file); }}
                    className="w-full px-3 py-2 flex items-center gap-2 text-rose-400 hover:bg-rose-950/40 active:bg-rose-950/60 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Delete File</span>
                  </button>
                </>
              )}
            </div>,
            document.body
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
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 active:bg-orange-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-orange-950/40 transition-all cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>Open</span>
        </button>

        <button
          onClick={() => onOpenRawModal(file)}
          className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 active:scale-95 text-orange-400 text-xs font-semibold border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-1 cursor-pointer"
        >
          <Link2 className="w-3.5 h-3.5 text-orange-400" />
          <span>Raw</span>
        </button>

        <button
          onClick={handleCopy}
          title="Copy direct streaming URL"
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 active:scale-95 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

    </div>
  );
};
