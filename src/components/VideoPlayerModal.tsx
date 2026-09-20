import React, { useState } from 'react';
import { X, Play, AlertCircle, Copy, Check, Download, ExternalLink } from 'lucide-react';
import { type FileItem } from '../types.js';
import { formatBytes } from '../utils/format.js';

interface VideoPlayerModalProps {
  file: FileItem | null;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  file,
  onClose,
  onShowToast,
}) => {
  const [videoError, setVideoError] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!file) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(file.raw_url);
    setCopied(true);
    onShowToast('Raw URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const isMkv = file.extension.toLowerCase() === '.mkv';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 text-orange-400 flex items-center justify-center shrink-0">
              <Play className="w-4 h-4 fill-orange-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate" title={file.stored_filename}>
                {file.stored_filename}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
                <span>{formatBytes(file.file_size)}</span>
                {file.resolution && (
                  <>
                    <span>•</span>
                    <span className="text-orange-400">{file.resolution}</span>
                  </>
                )}
                {file.audio_language && (
                  <>
                    <span>•</span>
                    <span className="text-zinc-300">{file.audio_language}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player Box */}
        <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center overflow-hidden">
          <video
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="w-full max-h-[65vh] object-contain"
            src={file.raw_url}
            onError={() => setVideoError(true)}
          >
            <source src={file.raw_url} type={file.mime_type} />
            Your browser does not support video playback.
          </video>

          {videoError && (
            <div className="absolute inset-0 bg-zinc-950/95 flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">
                Browser Codec Unsupported
              </h4>
              <p className="text-xs text-zinc-400 max-w-md mb-4">
                Web browsers only support standard H.264/AAC. Anime files encoded with 10-bit HEVC, Hi10P, or AC3/E-AC3 audio in MKV containers require dedicated media players like VLC or MX Player.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>Copy Stream URL for VLC</span>
                </button>
                <a
                  href={`${file.raw_url}&dl=1`}
                  download={file.stored_filename}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-zinc-700"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Player Bottom Control & VLC Instruction */}
        <div className="p-4 bg-zinc-900/90 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
            {isMkv && (
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-orange-400 font-mono font-medium">
                MKV Container
              </span>
            )}
            <span>Real-time VPS stream with HTTP Range seeking.</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium border border-zinc-700 flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Stream Link</span>
            </button>

            <a
              href={`${file.raw_url}&dl=1`}
              download={file.stored_filename}
              className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>

            <a
              href={file.raw_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
              title="Open stream in raw tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
