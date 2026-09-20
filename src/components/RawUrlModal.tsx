import React, { useState } from 'react';
import { X, Copy, ExternalLink, Check, Link2, ShieldCheck } from 'lucide-react';
import { type FileItem } from '../types.js';

interface RawUrlModalProps {
  file: FileItem | null;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const RawUrlModal: React.FC<RawUrlModalProps> = ({ file, onClose, onShowToast }) => {
  const [copied, setCopied] = useState(false);

  if (!file) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(file.raw_url);
    setCopied(true);
    onShowToast('Raw URL copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-zinc-100">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Public Raw URL</h3>
            <p className="text-xs text-zinc-400">Direct streaming and download link (HTTP Range enabled)</p>
          </div>
        </div>

        {/* File preview */}
        <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 mb-4">
          <p className="text-xs font-semibold text-zinc-300 truncate">{file.stored_filename}</p>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">Random UID: {file.random_uid}</p>
        </div>

        {/* URL Box */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Streaming Endpoint (?raw=1):
          </label>
          <div className="relative">
            <input
              type="text"
              readOnly
              value={file.raw_url}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full bg-black border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-xs font-mono text-orange-400 focus:outline-none focus:border-orange-500 pr-10 selection:bg-orange-500 selection:text-white"
            />
          </div>
        </div>

        {/* Security & External Player Notice */}
        <div className="flex items-start gap-2 text-xs text-zinc-400 bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 mb-6">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            The real VPS storage path is securely hidden behind the UID. Paste this URL directly into <strong>VLC Player</strong> or <strong>MX Player</strong> for hardware-accelerated playback.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
          >
            Close
          </button>

          <a
            href={file.raw_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60 flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Tab</span>
          </a>

          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-md shadow-orange-600/20 flex items-center gap-1.5 transition-all"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy URL'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
