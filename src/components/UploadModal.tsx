import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, File, Loader2, Minimize2 } from 'lucide-react';
import { formatBytes, formatSpeed, formatTimeRemaining } from '../utils/format.js';
import { useTransfers } from '../context/TransferContext.js';
import { TransferConfirmCancelModal } from './TransferConfirmCancelModal.js';

interface UploadModalProps {
  folderId: string | null;
  folderUid: string | null;
  folderName: string;
  onClose: () => void;
  onSuccess: () => void;
  onShowToast: (msg: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  folderId,
  folderUid,
  folderName,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const { startUpload, transfers, cancelTransfer } = useTransfers();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [duplicateFileExists, setDuplicateFileExists] = useState(false);
  const [duplicateResolvedMode, setDuplicateResolvedMode] = useState<'replace' | 'keep_both' | null>(null);
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Find active transfer in context
  const currentTransfer = activeTransferId
    ? transfers.find((t) => t.id === activeTransferId)
    : null;

  const checkDuplicate = async (file: File) => {
    try {
      const res = await fetch('/api/files/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, folderId }),
      });
      const data = await res.json();
      if (data.exists) {
        setDuplicateFileExists(true);
      } else {
        setDuplicateFileExists(false);
      }
    } catch {
      setDuplicateFileExists(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setDuplicateResolvedMode(null);
    checkDuplicate(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleStartUpload = () => {
    if (!selectedFile) return;

    const id = startUpload(
      selectedFile,
      folderId,
      folderUid,
      folderName,
      duplicateResolvedMode
    );
    setActiveTransferId(id);
    onShowToast(`Started uploading ${selectedFile.name}`);
  };

  const handleConfirmCancel = async () => {
    if (activeTransferId) {
      await cancelTransfer(activeTransferId);
      setShowCancelModal(false);
      setActiveTransferId(null);
      onClose();
    }
  };

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
              if (currentTransfer && currentTransfer.status === 'uploading') {
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
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Upload to VPS Storage</h3>
              <p className="text-xs text-zinc-400">
                Target destination: <span className="text-orange-400 font-semibold">{folderName}</span>
              </p>
            </div>
          </div>

          {/* Initial Selection Form */}
          {!currentTransfer && (
            <>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-orange-500 bg-orange-950/20'
                    : 'border-zinc-700/80 hover:border-zinc-500 bg-zinc-950/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                  <Upload className="w-6 h-6 text-orange-500" />
                </div>
                <p className="text-sm font-medium text-zinc-200">
                  Drag and drop your anime or video files here
                </p>
                <p className="text-xs text-zinc-500 mt-1">or click to browse your computer (MKV, MP4, WEBM, etc.)</p>
              </div>

              {selectedFile && (
                <div className="mt-4 p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <File className="w-4 h-4 text-orange-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{selectedFile.name}</p>
                      <p className="text-[11px] text-zinc-500 font-mono">{formatBytes(selectedFile.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedFile(null); setDuplicateFileExists(false); }}
                    className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1"
                  >
                    Change
                  </button>
                </div>
              )}

              {duplicateFileExists && !duplicateResolvedMode && (
                <div className="mt-4 p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold mb-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>This file already exists in this folder.</span>
                  </div>
                  <p className="text-zinc-400 mb-3">
                    A file named &quot;{selectedFile?.name}&quot; is already stored on the VPS. How would you like to proceed?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDuplicateResolvedMode('replace')}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium"
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => setDuplicateResolvedMode('keep_both')}
                      className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium"
                    >
                      Keep Both (Rename)
                    </button>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="px-3 py-1.5 rounded-lg bg-transparent text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {duplicateResolvedMode && (
                <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Option selected: {duplicateResolvedMode === 'keep_both' ? 'Keep Both' : 'Replace existing'}</span>
                </div>
              )}
            </>
          )}

          {/* Live Progress Display */}
          {currentTransfer && (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300 truncate max-w-[280px]">
                  {currentTransfer.filename}
                </span>
                <span className="font-mono text-orange-400 font-bold">
                  {Math.round(currentTransfer.percent)}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, currentTransfer.percent))}%` }}
                />
              </div>

              {/* Real Stats */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">
                <div>
                  <span className="text-zinc-500">Uploaded: </span>
                  <span className="text-zinc-300">
                    {formatBytes(currentTransfer.loaded)} / {formatBytes(currentTransfer.total)}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Speed: </span>
                  <span className="text-orange-400">
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
                    {currentTransfer.speed > 0 ? timeRemainingStr : 'Estimating...'}
                  </span>
                </div>
              </div>

              {currentTransfer.status === 'processing' && (
                <div className="flex items-center justify-center gap-2 text-xs text-orange-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Finalizing file on VPS and detecting anime metadata...</span>
                </div>
              )}

              {currentTransfer.status === 'completed' && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/40">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Upload completed successfully! File is stored on VPS.</span>
                </div>
              )}

              {currentTransfer.status === 'failed' && currentTransfer.error && (
                <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{currentTransfer.error}</span>
                </div>
              )}

              <p className="text-[11px] text-zinc-500 text-center">
                You can safely close this modal. The transfer will continue running in the background Transfer Manager.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
            {currentTransfer && currentTransfer.status === 'uploading' ? (
              <>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/60 hover:text-rose-400 text-zinc-300 text-xs font-semibold transition-colors"
                >
                  Cancel Upload
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-orange-400" />
                  <span>Run in Background</span>
                </button>
              </>
            ) : currentTransfer && currentTransfer.status === 'completed' ? (
              <div className="w-full flex justify-end">
                <button
                  onClick={() => {
                    onSuccess();
                    onClose();
                  }}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>

                <button
                  onClick={handleStartUpload}
                  disabled={!selectedFile || (duplicateFileExists && !duplicateResolvedMode)}
                  className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-semibold shadow-md shadow-orange-600/20 transition-all flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                </button>
              </>
            )}
          </div>

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
