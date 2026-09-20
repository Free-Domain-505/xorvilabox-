import React, { useState } from 'react';
import { X, FileEdit } from 'lucide-react';
import { type FileItem, type Folder } from '../types.js';

interface RenameModalProps {
  item: FileItem | Folder;
  isFolder: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onShowToast: (msg: string) => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  item,
  isFolder,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const currentName = isFolder ? (item as Folder).name : (item as FileItem).stored_filename;
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === currentName) {
      onClose();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = isFolder ? `/api/folders/${item.id}` : `/api/files/${item.id}`;
      const payload = isFolder ? { name: name.trim() } : { filename: name.trim() };

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename');

      onShowToast(`Renamed to "${name.trim()}"`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
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
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <FileEdit className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Rename {isFolder ? 'Folder' : 'File'}
            </h3>
            <p className="text-xs text-zinc-400 truncate max-w-[280px]">
              Current: {currentName}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              New Name:
            </label>
            <input
              type="text"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-orange-500 font-mono"
            />
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 text-white text-xs font-semibold shadow-md shadow-orange-600/20"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
