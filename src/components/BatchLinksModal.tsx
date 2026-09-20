import React, { useState } from 'react';
import { X, Copy, Check, Film, Download, FileText, ListOrdered } from 'lucide-react';
import { type FileItem } from '../types.js';
import { formatBytes } from '../utils/format.js';

interface BatchLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  episodes: FileItem[];
  folderName?: string;
  onShowToast: (msg: string) => void;
}

type FormatMode = 'raw' | 'titled' | 'm3u';

export const BatchLinksModal: React.FC<BatchLinksModalProps> = ({
  isOpen,
  onClose,
  episodes,
  folderName,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);
  const [formatMode, setFormatMode] = useState<FormatMode>('raw');

  if (!isOpen || episodes.length === 0) return null;

  const totalSize = episodes.reduce((acc, ep) => acc + (ep.file_size || 0), 0);

  // Generate links based on format
  const generateText = (): string => {
    if (formatMode === 'raw') {
      return episodes.map((ep) => ep.raw_url).join('\n');
    }
    if (formatMode === 'titled') {
      return episodes
        .map((ep) => {
          const epLabel = ep.episode_number ? `Episode ${String(ep.episode_number).padStart(2, '0')}` : ep.stored_filename;
          return `${epLabel}: ${ep.raw_url}`;
        })
        .join('\n');
    }
    if (formatMode === 'm3u') {
      const header = '#EXTM3U\n';
      const items = episodes
        .map((ep) => {
          const epLabel = ep.episode_number ? `Episode ${String(ep.episode_number).padStart(2, '0')} - ${ep.stored_filename}` : ep.stored_filename;
          return `#EXTINF:-1,${epLabel}\n${ep.raw_url}`;
        })
        .join('\n');
      return header + items;
    }
    return '';
  };

  const textContent = generateText();

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    onShowToast(`Copied ${episodes.length} link${episodes.length === 1 ? '' : 's'} to clipboard`);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleDownloadTxt = () => {
    const filename = `${folderName || 'anime'}_episode_links.txt`;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(`Downloaded ${filename}`);
  };

  const handleDownloadM3u = () => {
    const filename = `${folderName || 'anime_playlist'}.m3u`;
    const m3uContent = '#EXTM3U\n' + episodes.map((ep) => {
      const epLabel = ep.episode_number ? `Episode ${String(ep.episode_number).padStart(2, '0')}` : ep.stored_filename;
      return `#EXTINF:-1,${epLabel}\n${ep.raw_url}`;
    }).join('\n');
    const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(`Downloaded ${filename} playlist for VLC/MPV`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl shadow-black/90 relative text-zinc-100 flex flex-col max-h-[90vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 active:scale-95 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Batch Episode Links</h3>
              <span className="text-[11px] font-semibold bg-orange-600/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">
                {episodes.length} Episodes
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {folderName ? `Folder: ${folderName}` : 'All episodes in current view'} • Total: {formatBytes(totalSize)}
            </p>
          </div>
        </div>

        {/* Format Selector Tabs */}
        <div className="flex items-center justify-between gap-2 mb-3 bg-zinc-900/80 p-1.5 rounded-xl border border-zinc-800 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFormatMode('raw')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all active:scale-95 flex items-center gap-1.5 ${
                formatMode === 'raw'
                  ? 'bg-orange-600 text-white font-bold shadow-md shadow-orange-950/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Direct URLs</span>
            </button>

            <button
              onClick={() => setFormatMode('titled')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all active:scale-95 flex items-center gap-1.5 ${
                formatMode === 'titled'
                  ? 'bg-orange-600 text-white font-bold shadow-md shadow-orange-950/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Titles + URLs</span>
            </button>

            <button
              onClick={() => setFormatMode('m3u')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all active:scale-95 flex items-center gap-1.5 ${
                formatMode === 'm3u'
                  ? 'bg-orange-600 text-white font-bold shadow-md shadow-orange-950/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>M3U Playlist</span>
            </button>
          </div>

          <span className="text-[11px] text-zinc-500 hidden sm:inline font-mono">
            {formatMode === 'raw' && 'For JDownloader / IDM / wget'}
            {formatMode === 'titled' && 'For documentation / sharing'}
            {formatMode === 'm3u' && 'For VLC / MPV players'}
          </span>
        </div>

        {/* Text Area Preview */}
        <div className="relative mb-4 flex-1 min-h-[180px] max-h-[260px] flex flex-col">
          <textarea
            readOnly
            value={textContent}
            className="w-full h-full p-3 font-mono text-xs bg-zinc-900/80 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-zinc-700 resize-none select-all leading-relaxed"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTxt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-medium transition-all"
              title="Download text file with all URLs"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span>.TXT</span>
            </button>

            <button
              onClick={handleDownloadM3u}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-medium transition-all"
              title="Download M3U playlist file to open directly in VLC or MPV"
            >
              <Film className="w-3.5 h-3.5 text-orange-400" />
              <span>.M3U Playlist</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-zinc-300 text-xs font-medium border border-zinc-800 transition-all"
            >
              Close
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 active:bg-orange-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-orange-950/40 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied All!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy All ({episodes.length}) Links</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
