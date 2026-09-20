import React, { useState, useRef, useEffect } from 'react';
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
    <div className="group bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 rounded-xl p-3.5 flex items-center justify-between gap-3 transition-all duration-150 active:scale-[0.99] shadow-sm hover:shadow-lg">
      
      {/* File Info */}
      <div className="flex items-center gap-3 min-w-0">
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
          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-orange-400 text-xs font-medium border border-zinc-800 hover:border-zinc-700 active:scale-95 flex items-center gap-1 transition-all"
        >
          <Link2 className="w-3.5 h-3.5 text-orange-400" />
          <span className="hidden sm:inline">Raw</span>
        </button>

        <button
          onClick={handleCopy}
          title="Copy Raw URL"
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        <a
          href={`${file.raw_url}&dl=1`}
          download={file.stored_filename}
          title="Download file"
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 active:scale-95 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
        </a>

        {/* More Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl shadow-black/80 z-20 py-1 text-xs backdrop-blur-md">
              <button
                onClick={() => { setMenuOpen(false); onDetails(file); }}
                className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors"
              >
                <Info className="w-3.5 h-3.5 text-zinc-400" />
                <span>Details</span>
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
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
