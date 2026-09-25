import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { File, FileText, Image as ImageIcon, Video, Music, MoreVertical, Link2, Copy, Check, Info, FileEdit, Move, Trash2, Download } from 'lucide-react';
import { type FileItem } from '../types.js';
import { formatBytes, formatDate } from '../utils/format.js';

interface FileCardProps {
  file: FileItem;
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

export const FileCard: React.FC<FileCardProps> = ({
  file,
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
      const dropdownWidth = 176; // w-44 is 176px
      const dropdownHeight = isAuthenticated ? 220 : 120;

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

  const getIcon = () => {
    const ext = file.extension.toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    }
    if (['.mp4', '.mkv', '.webm', '.avi'].includes(ext)) {
      return <Video className="w-5 h-5 text-purple-400" />;
    }
    if (['.mp3', '.flac', '.wav'].includes(ext)) {
      return <Music className="w-5 h-5 text-amber-400" />;
    }
    if (['.txt', '.nfo', '.srt', '.vtt'].includes(ext)) {
      return <FileText className="w-5 h-5 text-blue-400" />;
    }
    return <File className="w-5 h-5 text-zinc-400" />;
  };

  return (
    <div className={`group bg-zinc-950/80 hover:bg-zinc-900 border rounded-xl p-3.5 flex items-center justify-between gap-3 transition-all duration-150 active:scale-[0.99] shadow-sm hover:shadow-lg ${
      isSelected ? 'border-orange-500 bg-orange-950/10 shadow-orange-950/20' : 'border-zinc-800/80 hover:border-zinc-700'
    }`}>
      
      {/* File Info */}
      <div className="flex items-center gap-3 min-w-0">
        
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

        <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
          {getIcon()}
        </div>
        
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-200 group-hover:text-orange-400 truncate transition-colors" title={file.stored_filename}>
            {file.stored_filename}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono mt-0.5">
            <span>{formatBytes(file.file_size)}</span>
            <span>•</span>
            <span>{formatDate(file.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onOpenRawModal(file)}
          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-orange-400 text-xs font-medium border border-zinc-800 hover:border-zinc-700 active:scale-95 flex items-center gap-1 transition-all cursor-pointer"
        >
          <Link2 className="w-3.5 h-3.5 text-orange-400" />
          <span className="hidden sm:inline">Raw</span>
        </button>

        <button
          onClick={handleCopy}
          title="Copy Raw URL"
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        <a
          href={`${file.raw_url}&dl=1`}
          download={file.stored_filename}
          title="Download file"
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
        </a>

        {/* More Menu */}
        <div className="relative" ref={menuRef}>
          <button
            ref={triggerRef}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
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
                width: '176px',
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl shadow-black/90 z-[9999] py-1 text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                onClick={() => { setMenuOpen(false); onDetails(file); }}
                className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Info className="w-3.5 h-3.5 text-zinc-400" />
                <span>Details</span>
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
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>,
            document.body
          )}
        </div>
      </div>

    </div>
  );
};
