import React, { useState } from 'react';
import { X, Globe, Download, AlertCircle, CheckCircle2, Minimize2 } from 'lucide-react';
import { formatBytes, formatSpeed, formatTimeRemaining } from '../utils/format.js';
import { useTransfers } from '../context/TransferContext.js';
import { TransferConfirmCancelModal } from './TransferConfirmCancelModal.js';

interface ImportUrlModalProps {
  folderId: string | null;
  folderUid: string | null;
  folderName: string;
  onClose: () => void;
  onSuccess: () => void;
  onShowToast: (msg: string) => void;
}

export const ImportUrlModal: React.FC<ImportUrlModalProps> = ({
  folderId,
  folderUid,
  folderName,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const { startUrlImport, transfers, cancelTransfer } = useTransfers();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Find active transfer in context
  const currentTransfer = activeJobId
    ? transfers.find((t) => t.id === activeJobId)
    : null;

  const startImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const jobId = await startUrlImport(
        url.trim(),
        folderId,
        folderUid,
        folderName
      );
      setActiveJobId(jobId);
      onShowToast('Direct VPS URL download started');
    } catch (err: any) {
      setError(err.message || 'Error occurred');
      setLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (activeJobId) {
      await cancelTransfer(activeJobId);
      setShowCancelModal(false);
      setActiveJobId(null);
      onClose();
    }
  };

  const isDownloading = currentTransfer && currentTransfer.status === 'downloading';
  const isProcessingZip =
    currentTransfer &&
    (currentTransfer.status === 'extracting' ||
      currentTransfer.status === 'scanning' ||
      currentTransfer.status === 'detecting' ||
      currentTransfer.status === 'creating_records');
  const isActive = isDownloading || isProcessingZip;
  const isCompleted = currentTransfer && currentTransfer.status === 'completed';
  const isFailed = (currentTransfer && currentTransfer.status === 'failed') || !!error;

  const remainingBytes = currentTransfer ? Math.max(0, currentTransfer.total - currentTransfer.loaded) : 0;
  const timeRemainingStr = currentTransfer
    ? formatTimeRemaining(remainingBytes, currentTransfer.speed)
    : '';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl shadow-black/80 relative text-zinc-100">
          
          {/* Close Button */}
          <button
            onClick={() => {
              if (isActive) {
                setShowCancelModal(true);
              } else {
                onClose();
              }
            }}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Title */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-orange-400 shadow-inner">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Import File or ZIP from URL</h3>
              <p className="text-xs text-zinc-400">
                Downloaded directly by VPS storage into{' '}
                <span className="text-orange-400 font-semibold">{folderName}</span>
              </p>
            </div>
          </div>

          {!currentTransfer ? (
            <form onSubmit={startImport} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Direct Download Link (HTTP / HTTPS):
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/anime/Season01.zip or episode.mkv"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-black/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40 placeholder:text-zinc-600 font-mono transition-all"
                />
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  Supports ZIP archives (auto-extracted on VPS with anime episode detection) and direct media files (MKV, MP4, etc.).
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-zinc-300 text-xs font-semibold border border-zinc-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !url.trim()}
                  className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 active:bg-orange-700 active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-bold shadow-md shadow-orange-950/40 transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download to VPS</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300 truncate max-w-[280px]">
                  {currentTransfer.filename}
                </span>
                <span className="font-mono text-orange-400 font-bold">
                  {isProcessingZip
                    ? `${Math.round(currentTransfer.percent)}%`
                    : currentTransfer.total > 0
                    ? `${Math.round(currentTransfer.percent)}%`
                    : 'Streaming...'}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                {currentTransfer.total === 0 && !isProcessingZip ? (
                  <div className="h-full bg-gradient-to-r from-orange-600 to-amber-400 animate-pulse w-full" />
                ) : (
                  <div
                    className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, currentTransfer.percent))}%` }}
                  />
                )}
              </div>

              {/* Real Stats Grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
                {isProcessingZip ? (
                  <>
                    <div>
                      <span className="text-zinc-500">Stage: </span>
                      <span className="text-orange-400 font-semibold">
                        {currentTransfer.stageNumber ? `${currentTransfer.stageNumber}/6` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Files: </span>
                      <span className="text-zinc-200">
                        {currentTransfer.extracted_files_count || 0} / {currentTransfer.total_files_count || 0}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-zinc-500">Status: </span>
                      <span className="text-zinc-200 truncate">
                        {currentTransfer.stage || currentTransfer.status}
                      </span>
                    </div>
                    {currentTransfer.detected_episodes_count !== undefined && currentTransfer.detected_episodes_count > 0 && (
                      <div className="col-span-2">
                        <span className="text-zinc-500">Episodes Detected: </span>
                        <span className="text-emerald-400 font-semibold">
                          {currentTransfer.detected_episodes_count}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-zinc-500">Downloaded: </span>
                      <span className="text-zinc-300">
                        {formatBytes(currentTransfer.loaded)}
                        {currentTransfer.total > 0 && ` / ${formatBytes(currentTransfer.total)}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Speed: </span>
                      <span className="text-orange-400 font-semibold">
                        {currentTransfer.speed > 0 ? formatSpeed(currentTransfer.speed) : 'Calculating...'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Status: </span>
                      <span className="text-zinc-200 capitalize">
                        {currentTransfer.stage || currentTransfer.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Time Left: </span>
                      <span className="text-zinc-300 truncate">
                        {currentTransfer.speed > 0 && currentTransfer.total > 0
                          ? timeRemainingStr
                          : 'Calculating...'}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {isCompleted && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/40">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {currentTransfer.stage || 'Import completed and processed successfully on VPS!'}
                  </span>
                </div>
              )}

              {isFailed && (
                <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{currentTransfer.error || error || 'Download failed'}</span>
                </div>
              )}

              <p className="text-[11px] text-zinc-500 text-center">
                This transfer is running in the background on the VPS. You can safely minimize or close this modal.
              </p>

              {/* Buttons */}
              <div className="flex items-center justify-between border-t border-zinc-800/80 pt-4">
                {isActive ? (
                  <>
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/60 hover:text-rose-400 active:scale-95 text-zinc-300 text-xs font-semibold border border-zinc-800 transition-all"
                    >
                      Cancel Transfer
                    </button>
                    <button
                      onClick={onClose}
                      className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-zinc-200 text-xs font-semibold border border-zinc-800 transition-all flex items-center gap-1.5"
                    >
                      <Minimize2 className="w-3.5 h-3.5 text-orange-400" />
                      <span>Run in Background</span>
                    </button>
                  </>
                ) : isCompleted ? (
                  <div className="w-full flex justify-end">
                    <button
                      onClick={() => {
                        onSuccess();
                        onClose();
                      }}
                      className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold transition-all shadow-md"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="w-full flex justify-end">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-zinc-300 text-xs font-semibold border border-zinc-800 transition-all"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {showCancelModal && currentTransfer && (
        <TransferConfirmCancelModal
          item={currentTransfer}
          onConfirm={handleConfirmCancel}
          onDismiss={() => setShowCancelModal(false)}
        />
      )}
    </>
  );
};
