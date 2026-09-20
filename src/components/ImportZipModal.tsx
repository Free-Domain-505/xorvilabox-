import React, { useState, useRef } from 'react';
import { X, FileArchive, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Minimize2 } from 'lucide-react';
import { formatBytes, formatSpeed, formatTimeRemaining } from '../utils/format.js';
import { useTransfers } from '../context/TransferContext.js';
import { TransferConfirmCancelModal } from './TransferConfirmCancelModal.js';

interface ImportZipModalProps {
  folderId: string | null;
  folderUid: string | null;
  folderName: string;
  onClose: () => void;
  onSuccess: () => void;
  onShowToast: (msg: string) => void;
}

export const ImportZipModal: React.FC<ImportZipModalProps> = ({
  folderId,
  folderUid,
  folderName,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const { startZipImport, transfers, cancelTransfer } = useTransfers();
  const [selectedZip, setSelectedZip] = useState<File | null>(null);
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Find active transfer in context
  const currentTransfer = activeTransferId
    ? transfers.find((t) => t.id === activeTransferId)
    : null;

  const startZipUpload = async () => {
    if (!selectedZip) return;

    setError(null);
    try {
      const jobId = await startZipImport(selectedZip, folderId, folderUid, folderName);
      setActiveTransferId(jobId);
      onShowToast(`Started ZIP import for ${selectedZip.name}`);
    } catch (err: any) {
      setError(err.message || 'Failed to start ZIP import');
    }
  };

  const handleConfirmCancel = async () => {
    if (activeTransferId) {
      await cancelTransfer(activeTransferId);
      setShowCancelModal(false);
      setActiveTransferId(null);
      onClose();
    }
  };

  // Determine stage number (1 - 6)
  const getStageNumber = () => {
    if (!currentTransfer) return 1;
    if (currentTransfer.status === 'uploading') return 1;
    if (currentTransfer.status === 'extracting') return 2;
    if (currentTransfer.status === 'scanning') return 3;
    if (currentTransfer.status === 'detecting') return 4;
    if (currentTransfer.status === 'creating_records') return 5;
    if (currentTransfer.status === 'completed') return 6;
    return currentTransfer.stageNumber || 2;
  };

  const currentStage = getStageNumber();
  const isActive =
    currentTransfer &&
    currentTransfer.status !== 'completed' &&
    currentTransfer.status !== 'failed' &&
    currentTransfer.status !== 'cancelled';
  const isCompleted = currentTransfer && currentTransfer.status === 'completed';
  const isFailed = (currentTransfer && currentTransfer.status === 'failed') || !!error;

  const timeRemainingStr = currentTransfer
    ? formatTimeRemaining(Math.max(0, currentTransfer.total - currentTransfer.loaded), currentTransfer.speed)
    : '';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-zinc-100">
          
          {/* Close Button */}
          <button
            onClick={() => {
              if (isActive) {
                setShowCancelModal(true);
              } else {
                onClose();
              }
            }}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Title */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <FileArchive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Import ZIP Archive</h3>
              <p className="text-xs text-zinc-400">
                Extracted and indexed directly on VPS into{' '}
                <span className="text-orange-400 font-semibold">{folderName}</span>
              </p>
            </div>
          </div>

          {!currentTransfer ? (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-700 hover:border-orange-500 bg-zinc-950/60 rounded-xl p-6 text-center cursor-pointer transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedZip(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-orange-400">
                  <FileArchive className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-zinc-200">
                  Select Anime ZIP Archive (e.g. Jujutsu-Kaisen-S01.zip)
                </p>
                <p className="text-xs text-zinc-500 mt-1">Multi-gigabyte archives supported</p>
              </div>

              {selectedZip && (
                <div className="mt-4 p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-zinc-200 truncate">{selectedZip.name}</p>
                    <p className="text-[11px] text-zinc-500 font-mono">{formatBytes(selectedZip.size)}</p>
                  </div>
                  <button
                    onClick={() => setSelectedZip(null)}
                    className="text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* VPS Security Hardening Notice */}
              <div className="mt-4 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>VPS Security & Extraction Pipeline</span>
                </div>
                <p>• <strong>Zip Slip Protection:</strong> Path traversal attempts are strictly quarantined.</p>
                <p>• <strong>Smart Unnesting:</strong> Redundant nested root folders inside the archive are automatically unnested.</p>
                <p>• <strong>Real Extraction Stages:</strong> Multi-stage progress is reported live via server events.</p>
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={startZipUpload}
                  disabled={!selectedZip}
                  className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-semibold shadow-md shadow-orange-600/20 flex items-center gap-1.5"
                >
                  <FileArchive className="w-3.5 h-3.5" />
                  <span>Upload & Extract on VPS</span>
                </button>
              </div>
            </div>
          ) : (
            /* Live VPS ZIP Workflow Progress */
            <div className="py-2 space-y-4">
              
              {/* 6 Stage Indicators */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                  <span>Import Pipeline:</span>
                  <span className="text-orange-400 font-bold capitalize">
                    {currentStage === 1 && `Stage 1: Uploading ZIP (${Math.round(currentTransfer.percent)}%)`}
                    {currentStage === 2 && (currentTransfer.stage || 'Stage 2: Extracting ZIP')}
                    {currentStage === 3 && 'Stage 3: Scanning anime files'}
                    {currentStage === 4 && (currentTransfer.stage || 'Stage 4: Detecting episodes')}
                    {currentStage === 5 && (currentTransfer.stage || 'Stage 5: Creating records')}
                    {currentStage === 6 && 'Stage 6: Completed'}
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map((step) => (
                    <div
                      key={step}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        currentStage >= step ? 'bg-orange-500' : 'bg-zinc-800'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                {currentStage === 2 && (!currentTransfer.total_files_count || currentTransfer.total_files_count === 0) ? (
                  <div className="h-full bg-gradient-to-r from-orange-600 to-amber-400 animate-pulse w-full" />
                ) : (
                  <div
                    className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, currentTransfer.percent))}%` }}
                  />
                )}
              </div>

              {/* Real Stats Box */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-500">ZIP File:</span>
                  <span className="text-zinc-200 truncate max-w-[240px]">{currentTransfer.filename}</span>
                </div>

                {currentStage === 1 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Upload Speed:</span>
                      <span className="text-orange-400">{formatSpeed(currentTransfer.speed)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Uploaded:</span>
                      <span className="text-zinc-300">
                        {formatBytes(currentTransfer.loaded)} / {formatBytes(currentTransfer.total)}
                      </span>
                    </div>
                    {currentTransfer.speed > 0 && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Time Left:</span>
                        <span className="text-zinc-300">{timeRemainingStr}</span>
                      </div>
                    )}
                  </>
                )}

                {currentStage >= 2 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Files Extracted:</span>
                      <span className="text-zinc-200 font-bold">
                        {currentTransfer.total_files_count && currentTransfer.total_files_count > 0
                          ? `${currentTransfer.extracted_files_count || 0} / ${currentTransfer.total_files_count}`
                          : `Files extracted: ${currentTransfer.extracted_files_count || 0}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Episodes Detected:</span>
                      <span className="text-orange-400 font-bold">
                        {currentTransfer.detected_episodes_count || 0}
                      </span>
                    </div>
                    {currentTransfer.current_file && (
                      <div className="flex justify-between pt-1 border-t border-zinc-900">
                        <span className="text-zinc-500">Processing:</span>
                        <span className="text-zinc-300 truncate max-w-[220px]">{currentTransfer.current_file}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {isCompleted && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/40">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Successfully imported {currentTransfer.detected_episodes_count || currentTransfer.extracted_files_count} episodes to VPS!
                  </span>
                </div>
              )}

              {isFailed && (
                <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{currentTransfer.error || error || 'ZIP extraction failed'}</span>
                </div>
              )}

              <p className="text-[11px] text-zinc-500 text-center">
                Extraction runs on the VPS disk. You can safely close or minimize this modal.
              </p>

              {/* Action Buttons */}
              <div className="mt-4 flex items-center justify-between border-t border-zinc-800/80 pt-3">
                {isActive ? (
                  <>
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/60 hover:text-rose-400 text-zinc-300 text-xs font-semibold transition-colors"
                    >
                      Cancel Transfer
                    </button>
                    <button
                      onClick={onClose}
                      className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
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
                      className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="w-full flex justify-end">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
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
