import React from 'react';
import {
  Upload,
  Download,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FolderOpen,
  Copy,
  RotateCcw,
  Trash2,
  Film,
  Loader2,
} from 'lucide-react';
import { type TransferItem } from '../types.js';
import { formatBytes, formatSizeComparison, formatSpeed, formatTimeRemaining } from '../utils/format.js';

interface TransferItemCardProps {
  item: TransferItem;
  onRequestCancel: (item: TransferItem) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onOpenFolder?: (folderId: string | null) => void;
  onCopyRawUrl?: (url: string) => void;
}

export const TransferItemCard: React.FC<TransferItemCardProps> = ({
  item,
  onRequestCancel,
  onRetry,
  onRemove,
  onOpenFolder,
  onCopyRawUrl,
}) => {
  const isActive =
    item.status === 'uploading' ||
    item.status === 'downloading' ||
    item.status === 'extracting' ||
    item.status === 'scanning' ||
    item.status === 'detecting' ||
    item.status === 'creating_records' ||
    item.status === 'processing' ||
    item.status === 'pending';

  const isCompleted = item.status === 'completed';
  const isFailed = item.status === 'failed';
  const isCancelled = item.status === 'cancelled';

  const isZipStage =
    item.status === 'extracting' ||
    item.status === 'scanning' ||
    item.status === 'detecting' ||
    item.status === 'creating_records';

  // Determine Icon & Icon container color
  const renderIcon = () => {
    if (isCompleted) {
      return (
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      );
    }
    if (isFailed || isCancelled) {
      return (
        <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
          <XCircle className="w-4 h-4" />
        </div>
      );
    }
    if (item.type === 'zip' || isZipStage) {
      return (
        <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
          <FileArchive className="w-4 h-4" />
        </div>
      );
    }
    if (item.type === 'url') {
      return (
        <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
          <Download className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
        <Upload className="w-4 h-4" />
      </div>
    );
  };

  // Status Badge
  const renderStatusBadge = () => {
    if (isCompleted) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
          <CheckCircle2 className="w-3 h-3" />
          <span>Complete</span>
        </span>
      );
    }
    if (isFailed) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded-full">
          <AlertCircle className="w-3 h-3" />
          <span>Failed</span>
        </span>
      );
    }
    if (isCancelled) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
          <span>Cancelled</span>
        </span>
      );
    }
    if (item.status === 'uploading') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400 bg-orange-950/40 border border-orange-800/40 px-2 py-0.5 rounded-full">
          <Upload className="w-3 h-3 animate-pulse" />
          <span>Uploading</span>
        </span>
      );
    }
    if (item.status === 'downloading') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400 bg-orange-950/40 border border-orange-800/40 px-2 py-0.5 rounded-full">
          <Download className="w-3 h-3 animate-pulse" />
          <span>Downloading</span>
        </span>
      );
    }
    if (item.status === 'extracting') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-full">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Extracting ZIP</span>
        </span>
      );
    }
    if (item.status === 'scanning' || item.status === 'detecting') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2 py-0.5 rounded-full">
          <Film className="w-3 h-3 animate-pulse" />
          <span>Scanning Anime</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400 bg-orange-950/40 border border-orange-800/40 px-2 py-0.5 rounded-full">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Processing</span>
      </span>
    );
  };

  // Remaining time calculation
  const remainingBytes = Math.max(0, item.total - item.loaded);
  const timeRemainingStr = formatTimeRemaining(remainingBytes, item.speed);

  // Indeterminate progress check for ZIP extraction or stream download if total not yet computable
  const isIndeterminate =
    isActive &&
    ((isZipStage && (!item.total_files_count || item.total_files_count === 0)) ||
      (item.type === 'zip' && item.status !== 'uploading' && (!item.total_files_count || item.total_files_count === 0)) ||
      (item.type === 'url' && item.status === 'downloading' && item.total === 0));

  return (
    <div className="bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 transition-all text-zinc-100 shadow-sm">
      
      {/* Header row: Icon, Filename, Status Badge */}
      <div className="flex items-start gap-3 mb-2.5">
        {renderIcon()}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h4
              className="text-xs font-semibold text-zinc-100 truncate font-mono"
              title={item.filename}
            >
              {item.filename}
            </h4>
            {renderStatusBadge()}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            {item.fileType && <span>{item.fileType}</span>}
            {item.targetFolderName && (
              <>
                <span>•</span>
                <span className="truncate">Folder: {item.targetFolderName}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stage details / error description */}
      {item.stage && (
        <p className="text-[11px] text-zinc-300 font-medium mb-2 truncate">
          {item.stage}
        </p>
      )}

      {isFailed && item.error && (
        <div className="bg-rose-950/30 border border-rose-800/40 rounded-lg p-2 text-xs text-rose-300 mb-2.5">
          <p className="font-semibold text-[11px] text-rose-400">Error:</p>
          <p className="text-[11px] mt-0.5 break-words">{item.error}</p>
        </div>
      )}

      {/* Progress Bar for Active Transfers */}
      {isActive && (
        <div className="mb-2.5">
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden relative">
            {isIndeterminate ? (
              <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full animate-pulse w-full" />
            ) : (
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }}
              />
            )}
          </div>

          {/* Transfer stats row: Size, Speed, Percentage */}
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1.5 font-mono">
            <span>
              {(item.type === 'zip' || isZipStage) && item.status !== 'uploading' && item.status !== 'downloading' ? (
                item.total_files_count && item.total_files_count > 0 ? (
                  `${item.extracted_files_count || 0} / ${item.total_files_count} files`
                ) : (
                  `Files extracted: ${item.extracted_files_count || 0}`
                )
              ) : item.total > 0 ? (
                formatSizeComparison(item.loaded, item.total)
              ) : (
                formatBytes(item.loaded)
              )}
            </span>

            <div className="flex items-center gap-2">
              {item.speed > 0 && (
                <span className="text-zinc-300 font-medium">{formatSpeed(item.speed)}</span>
              )}
              <span className="text-orange-400 font-bold">
                {isIndeterminate ? '...' : `${Math.round(item.percent)}%`}
              </span>
            </div>
          </div>

          {/* Time Remaining row */}
          {item.speed > 0 && item.total > 0 && (
            <p className="text-[10px] text-zinc-500 mt-1">
              Estimated time remaining: <span className="text-zinc-400">{timeRemainingStr}</span>
            </p>
          )}
        </div>
      )}

      {/* Completed file size badge */}
      {isCompleted && (
        <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2.5 pt-1 border-t border-zinc-800/60 font-mono">
          <span>{formatBytes(item.total || item.loaded)}</span>
          <span className="text-emerald-400 font-medium">Uploaded successfully</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/60">
        {isActive && item.canCancel && (
          <button
            onClick={() => onRequestCancel(item)}
            className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-rose-950/60 hover:text-rose-400 text-zinc-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
        )}

        {isCompleted && (
          <>
            {onOpenFolder && (
              <button
                onClick={() => onOpenFolder(item.targetFolderId || null)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
              >
                <FolderOpen className="w-3 h-3 text-orange-400" />
                <span>Open Folder</span>
              </button>
            )}
            {item.file?.raw_url && onCopyRawUrl && (
              <button
                onClick={() => onCopyRawUrl(item.file!.raw_url)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 text-xs font-semibold transition-colors border border-orange-500/30"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Raw URL</span>
              </button>
            )}
            <button
              onClick={() => onRemove(item.id)}
              className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="Dismiss"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        {isFailed && (
          <>
            {item.canRetry && (
              <button
                onClick={() => onRetry(item.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors shadow-sm"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
            <button
              onClick={() => onRemove(item.id)}
              className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
            >
              Remove
            </button>
          </>
        )}

        {isCancelled && (
          <button
            onClick={() => onRemove(item.id)}
            className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
          >
            Remove
          </button>
        )}
      </div>

    </div>
  );
};
