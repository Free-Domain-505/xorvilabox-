import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { type TransferItem } from '../types.js';

interface TransferConfirmCancelModalProps {
  item: TransferItem;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const TransferConfirmCancelModal: React.FC<TransferConfirmCancelModalProps> = ({
  item,
  onConfirm,
  onDismiss,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl shadow-black/80 relative text-zinc-100">
        
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 active:scale-95 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Cancel Transfer?</h3>
            <p className="text-xs text-zinc-400">Stop this operation</p>
          </div>
        </div>

        <p className="text-xs text-zinc-300 mb-2">
          Cancel this transfer?
        </p>

        <p className="font-mono text-xs text-zinc-200 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800 truncate mb-4">
          {item.filename}
        </p>

        <p className="text-[11px] text-zinc-500 mb-4">
          Temporary incomplete files will be cleaned up from VPS storage to prevent storage corruption.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-zinc-800 text-zinc-200 text-xs font-medium transition-all"
          >
            Continue Transfer
          </button>
          <button
            onClick={onConfirm}
            className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 active:scale-95 text-white text-xs font-semibold shadow-md shadow-rose-950/40 transition-all"
          >
            Cancel Transfer
          </button>
        </div>

      </div>
    </div>
  );
};
