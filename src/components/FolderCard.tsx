import React, { useState, useRef, useEffect } from 'react';
import { Folder, MoreVertical, FolderOpen, FileEdit, Trash2, Info } from 'lucide-react';
import { type Folder as FolderType } from '../types.js';

interface FolderCardProps {
  folder: FolderType;
  onOpen: (folder: FolderType) => void;
  onRename: (folder: FolderType) => void;
  onDelete: (folder: FolderType) => void;
  onDetails: (folder: FolderType) => void;
  isAuthenticated: boolean;
}

export const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  onOpen,
  onRename,
  onDelete,
  onDetails,
  isAuthenticated,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
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

  const totalItems = (folder.file_count || 0) + (folder.subfolder_count || 0);

  return (
    <div
      onClick={() => onOpen(folder)}
      className="group bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 rounded-xl p-4 cursor-pointer transition-all duration-150 active:scale-[0.98] shadow-sm hover:shadow-lg flex items-center justify-between gap-3 select-none"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-orange-400 group-hover:scale-105 group-hover:bg-orange-500/10 group-hover:border-orange-500/30 transition-all shrink-0 shadow-inner">
          <Folder className="w-5 h-5 fill-orange-500/20 text-orange-400" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-orange-400 transition-colors truncate">
            {folder.name}
          </h4>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">
            {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </p>
        </div>
      </div>

      <div className="relative shrink-0" ref={menuRef} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-40 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl shadow-black/80 z-20 py-1 text-xs backdrop-blur-md">
            <button
              onClick={() => { setMenuOpen(false); onOpen(folder); }}
              className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5 text-orange-400" />
              <span>Open</span>
            </button>

            <button
              onClick={() => { setMenuOpen(false); onDetails(folder); }}
              className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors"
            >
              <Info className="w-3.5 h-3.5 text-zinc-400" />
              <span>Details</span>
            </button>

            {isAuthenticated && (
              <>
                <div className="my-1 border-t border-zinc-800/80" />
                <button
                  onClick={() => { setMenuOpen(false); onRename(folder); }}
                  className="w-full px-3 py-2 flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-850 active:bg-zinc-800 transition-colors"
                >
                  <FileEdit className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Rename</span>
                </button>

                <button
                  onClick={() => { setMenuOpen(false); onDelete(folder); }}
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
  );
};
