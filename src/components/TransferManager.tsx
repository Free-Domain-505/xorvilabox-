import React, { useState } from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Inbox,
  CheckCircle2,
  AlertCircle,
  Upload,
} from 'lucide-react';
import { useTransfers } from '../context/TransferContext.js';
import { TransferItemCard } from './TransferItemCard.js';
import { TransferConfirmCancelModal } from './TransferConfirmCancelModal.js';
import { type TransferItem } from '../types.js';

interface TransferManagerProps {
  onOpenFolder?: (folderId: string | null) => void;
  onCopyRawUrl?: (url: string) => void;
}

export const TransferManager: React.FC<TransferManagerProps> = ({
  onOpenFolder,
  onCopyRawUrl,
}) => {
  const {
    transfers,
    activeTransfers,
    completedTransfers,
    failedTransfers,
    isManagerOpen,
    closeManager,
    isMinimized,
    toggleMinimize,
    activeTab,
    setActiveTab,
    cancelTransfer,
    retryTransfer,
    removeTransfer,
    clearCompleted,
  } = useTransfers();

  const [cancelPromptItem, setCancelPromptItem] = useState<TransferItem | null>(null);

  if (!isManagerOpen && transfers.length === 0) {
    return null;
  }

  // Determine which list to display
  let currentList: TransferItem[] = [];
  if (activeTab === 'active') currentList = activeTransfers;
  if (activeTab === 'completed') currentList = completedTransfers;
  if (activeTab === 'failed') currentList = failedTransfers;

  const handleConfirmCancel = async () => {
    if (cancelPromptItem) {
      await cancelTransfer(cancelPromptItem.id);
      setCancelPromptItem(null);
    }
  };

  return (
    <>
      {/* Floating Manager Widget */}
      <div
        className={`fixed z-40 transition-all duration-300 ease-in-out
          /* Mobile styling: bottom card full width with safe margin */
          bottom-0 left-0 right-0 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[430px]
          ${!isManagerOpen ? 'translate-y-full sm:translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}
        `}
      >
        <div className="bg-zinc-950 border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden max-h-[85vh] sm:max-h-[580px]">
          
          {/* Top Header Bar */}
          <div
            onClick={toggleMinimize}
            className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 cursor-pointer select-none hover:bg-zinc-850 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
              <h3 className="text-sm font-bold text-white tracking-wide">Transfers</h3>
              {activeTransfers.length > 0 && (
                <span className="text-[11px] font-semibold bg-orange-600/30 text-orange-400 border border-orange-500/40 px-2 py-0.5 rounded-full">
                  {activeTransfers.length} active
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={toggleMinimize}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title={isMinimized ? 'Expand' : 'Minimize'}
                aria-label="Toggle minimize"
              >
                {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={closeManager}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Close Transfer Manager"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Collapsible Content */}
          {!isMinimized && (
            <>
              {/* Filter Tabs Bar */}
              <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 border-b border-zinc-800/80 text-xs">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab('active')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                      activeTab === 'active'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    <span>Active</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        activeTab === 'active' ? 'bg-orange-700 text-white' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {activeTransfers.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('completed')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                      activeTab === 'completed'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    <span>Completed</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        activeTab === 'completed' ? 'bg-orange-700 text-white' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {completedTransfers.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('failed')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                      activeTab === 'failed'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    <span>Failed</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        activeTab === 'failed' ? 'bg-orange-700 text-white' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {failedTransfers.length}
                    </span>
                  </button>
                </div>

                {activeTab === 'completed' && completedTransfers.length > 0 && (
                  <button
                    onClick={clearCompleted}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-rose-400 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
                    title="Clear completed transfers"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Transfers List Area */}
              <div className="p-3 overflow-y-auto space-y-2.5 flex-1 min-h-[220px] max-h-[380px]">
                {currentList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-2">
                      {activeTab === 'active' && <Inbox className="w-5 h-5" />}
                      {activeTab === 'completed' && <CheckCircle2 className="w-5 h-5" />}
                      {activeTab === 'failed' && <AlertCircle className="w-5 h-5" />}
                    </div>
                    <p className="text-xs font-medium text-zinc-300">
                      {activeTab === 'active' && 'No active transfers in progress'}
                      {activeTab === 'completed' && 'No completed transfers yet'}
                      {activeTab === 'failed' && 'No failed transfers'}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
                      {activeTab === 'active' && 'Upload files or import URLs & ZIPs to track their real-time progress here.'}
                      {activeTab === 'completed' && 'Successfully imported files will appear here with direct raw URL access.'}
                      {activeTab === 'failed' && 'Any transfers that encounter errors will appear here for retry.'}
                    </p>
                  </div>
                ) : (
                  currentList.map((item) => (
                    <TransferItemCard
                      key={item.id}
                      item={item}
                      onRequestCancel={(target) => setCancelPromptItem(target)}
                      onRetry={retryTransfer}
                      onRemove={removeTransfer}
                      onOpenFolder={onOpenFolder}
                      onCopyRawUrl={onCopyRawUrl}
                    />
                  ))
                )}
              </div>
            </>
          )}

        </div>
      </div>

      {/* Confirmation Modal when user clicks cancel */}
      {cancelPromptItem && (
        <TransferConfirmCancelModal
          item={cancelPromptItem}
          onConfirm={handleConfirmCancel}
          onDismiss={() => setCancelPromptItem(null)}
        />
      )}
    </>
  );
};
