import React from 'react';
import { Upload, Download, FileArchive, Loader2 } from 'lucide-react';
import { useTransfers } from '../context/TransferContext.js';
import { formatSpeed } from '../utils/format.js';

export const CompactTransferBar: React.FC = () => {
  const { activeTransfers, openManager, isManagerOpen } = useTransfers();

  if (activeTransfers.length === 0 || isManagerOpen) {
    return null;
  }

  const count = activeTransfers.length;
  const first = activeTransfers[0];

  // Calculate combined progress or single progress
  let displayLabel = '';
  let overallPercent = 0;
  let totalSpeed = 0;

  if (count === 1) {
    overallPercent = Math.round(first.percent);
    totalSpeed = first.speed;
    if (first.type === 'zip' && first.status !== 'uploading') {
      displayLabel = first.stage || `Extracting ${first.extracted_files_count || 0} files`;
    } else if (first.status === 'downloading') {
      displayLabel = `Downloading ${first.percent > 0 ? `${overallPercent}%` : ''}`;
    } else {
      displayLabel = `Uploading ${first.percent > 0 ? `${overallPercent}%` : ''}`;
    }
  } else {
    // Multi-transfer summary
    const totalLoaded = activeTransfers.reduce((acc, t) => acc + t.loaded, 0);
    const totalBytes = activeTransfers.reduce((acc, t) => acc + t.total, 0);
    overallPercent = totalBytes > 0 ? Math.round((totalLoaded / totalBytes) * 100) : 0;
    totalSpeed = activeTransfers.reduce((acc, t) => acc + t.speed, 0);
    displayLabel = `${count} transfers active`;
  }

  const renderIcon = () => {
    if (first.type === 'zip') {
      return <FileArchive className="w-4 h-4 text-orange-400" />;
    }
    if (first.type === 'url') {
      return <Download className="w-4 h-4 text-orange-400 animate-bounce" />;
    }
    return <Upload className="w-4 h-4 text-orange-400 animate-pulse" />;
  };

  return (
    <div
      onClick={() => openManager('active')}
      className="fixed bottom-5 right-5 z-30 cursor-pointer group"
      role="button"
      tabIndex={0}
      title="Click to view full Transfer Manager"
    >
      <div className="flex items-center gap-3 bg-zinc-900/95 hover:bg-zinc-850 text-zinc-100 px-4 py-2.5 rounded-full border border-orange-500/40 shadow-xl shadow-orange-950/20 backdrop-blur-md transition-all transform hover:scale-105 select-none">
        
        <div className="flex items-center gap-2">
          {renderIcon()}
          <span className="text-xs font-semibold text-zinc-100">{displayLabel}</span>
        </div>

        {overallPercent > 0 && (
          <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, overallPercent))}%` }}
            />
          </div>
        )}

        {totalSpeed > 0 && (
          <span className="text-[11px] font-mono text-zinc-400">
            {formatSpeed(totalSpeed)}
          </span>
        )}

        <span className="text-[10px] bg-orange-600/30 text-orange-400 border border-orange-500/30 font-bold px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      </div>
    </div>
  );
};
