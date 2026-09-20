import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { type FileItem, type Folder } from '../types.js';

interface DeleteConfirmModalProps {
  item: FileItem | Folder;
  isFolder: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onShowToast: (msg: string) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  item,
  isFolder,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = isFolder ? (item as Folder).name : (item as FileItem).stored_filename;

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = isFolder ? `/api/folders/${item.id}` : `/api/files/${item.id}`;
      const res = await fetch(endpoint, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');

      onShowToast(`Deleted ${isFolder ? 'folder' : 'file'} "${displayName}" from VPS`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Deletion error');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-zinc-100">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Delete {isFolder ? 'Folder' : 'File'}
            </h3>
            <p className="text-xs text-zinc-400">This action cannot be undone</p>
          </div>
        </div>

        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl mb-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to permanently delete:
          </p>
          <p className="font-semibold text-rose-400 font-mono mt-1 truncate" title={displayName}>
            {displayName}
          </p>
          {isFolder && (
            <p className="text-[11px] text-zinc-500 mt-2">
              Warning: All files and subfolders inside this folder on the VPS filesystem will also be permanently deleted.
            </p>
          )}
        </div>

        {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 text-white text-xs font-semibold shadow-md shadow-rose-600/20 flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>Delete Permanently</span>
          </button>
        </div>

      </div>
    </div>
  );
};
