import React, { useState } from 'react';
import { X, Info, Copy, Check, Link2, ExternalLink } from 'lucide-react';
import { type FileItem, type Folder } from '../types.js';
import { formatBytes, formatDate } from '../utils/format.js';

interface DetailsModalProps {
  item: FileItem | Folder | null;
  isFolder: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const DetailsModal: React.FC<DetailsModalProps> = ({
  item,
  isFolder,
  onClose,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  const file = !isFolder ? (item as FileItem) : null;
  const folder = isFolder ? (item as Folder) : null;

  const handleCopy = () => {
    if (file?.raw_url) {
      navigator.clipboard.writeText(file.raw_url);
      setCopied(true);
      onShowToast('Raw URL copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-zinc-100">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {isFolder ? 'Folder Details' : 'File Metadata'}
            </h3>
            <p className="text-xs text-zinc-400 truncate max-w-[280px]">
              {isFolder ? folder?.name : file?.stored_filename}
            </p>
          </div>
        </div>

        <div className="space-y-2.5 text-xs font-mono bg-zinc-950 p-4 rounded-xl border border-zinc-800/80">
          <div className="flex justify-between py-1 border-b border-zinc-900">
            <span className="text-zinc-500 font-sans">ID:</span>
            <span className="text-zinc-300 select-all">{item.id}</span>
          </div>

          {folder && (
            <>
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500 font-sans">Folder UID:</span>
                <span className="text-orange-400">{folder.folder_uid}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500 font-sans">Files Stored:</span>
                <span className="text-zinc-200">{folder.file_count || 0}</span>
              </div>
            </>
          )}

          {file && (
            <>
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500 font-sans">Random UID:</span>
                <span className="text-orange-400 font-bold select-all">{file.random_uid}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500 font-sans">Original Filename:</span>
                <span className="text-zinc-300 truncate max-w-[240px]" title={file.original_filename}>
                  {file.original_filename}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500 font-sans">Stored VPS Name:</span>
                <span className="text-zinc-200 truncate max-w-[240px]" title={file.stored_filename}>
                  {file.stored_filename}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500 font-sans">File Size:</span>
                <span className="text-zinc-200">{formatBytes(file.file_size)} ({file.file_size.toLocaleString()} bytes)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500 font-sans">MIME Type:</span>
                <span className="text-zinc-300">{file.mime_type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500 font-sans">Season / Episode:</span>
                <span className="text-orange-400">
                  {file.is_anime_episode ? `Season ${file.season_number || 1} • Episode ${file.episode_number}` : 'N/A (Other File)'}
                </span>
              </div>
              {file.resolution && (
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500 font-sans">Detected Resolution:</span>
                  <span className="text-zinc-200">{file.resolution}</span>
                </div>
              )}
              {file.audio_language && (
                <div className="flex justify-between py-1 border-b border-zinc-900">
                  <span className="text-zinc-500 font-sans">Audio Language:</span>
                  <span className="text-zinc-200">{file.audio_language}</span>
                </div>
              )}
            </>
          )}

          <div className="flex justify-between py-1 border-b border-zinc-900">
            <span className="text-zinc-500 font-sans">Created Date:</span>
            <span className="text-zinc-400">{formatDate(item.created_at)}</span>
          </div>

          <div className="flex justify-between py-1">
            <span className="text-zinc-500 font-sans">Modified Date:</span>
            <span className="text-zinc-400">{formatDate(item.updated_at)}</span>
          </div>
        </div>

        {file && (
          <div className="mt-4 flex items-center justify-between gap-2 p-2.5 bg-black rounded-lg border border-zinc-800 text-xs">
            <span className="font-mono text-orange-400 truncate max-w-[280px]">{file.raw_url}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-sans font-medium flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <a
                href={file.raw_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
