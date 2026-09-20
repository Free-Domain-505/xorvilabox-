import React, { useState } from 'react';
import { X, Move, Folder } from 'lucide-react';
import { type FileItem, type Folder as FolderType } from '../types.js';

interface MoveModalProps {
  file: FileItem;
  folders: FolderType[];
  onClose: () => void;
  onSuccess: () => void;
  onShowToast: (msg: string) => void;
}

export const MoveModal: React.FC<MoveModalProps> = ({
  file,
  folders,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const [targetFolderId, setTargetFolderId] = useState<string>(file.folder_id || 'root');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMove = async () => {
    setLoading(true);
    setError(null);

    const folderId = targetFolderId === 'root' ? null : targetFolderId;

    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to move file');

      onShowToast(`File moved successfully on VPS storage`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to move');
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
            <Move className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Move File</h3>
            <p className="text-xs text-zinc-400 truncate max-w-[280px]">
              {file.stored_filename}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2">
              Select Destination Folder on VPS:
            </label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              
              <div
                onClick={() => setTargetFolderId('root')}
                className={`p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer text-xs transition-colors ${
                  targetFolderId === 'root'
                    ? 'bg-orange-600/20 border-orange-500 text-orange-400'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <Folder className="w-4 h-4 text-orange-400" />
                <span className="font-semibold">Root / Home</span>
              </div>

              {folders.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setTargetFolderId(f.id)}
                  className={`p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer text-xs transition-colors ${
                    targetFolderId === f.id
                      ? 'bg-orange-600/20 border-orange-500 text-orange-400'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <Folder className="w-4 h-4 text-orange-400" />
                  <span className="truncate">{f.name}</span>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleMove}
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 text-white text-xs font-semibold shadow-md shadow-orange-600/20"
            >
              {loading ? 'Moving...' : 'Move to Selected'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
