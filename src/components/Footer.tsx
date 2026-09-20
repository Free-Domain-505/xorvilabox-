import React from 'react';
import { Box, Server, ShieldCheck, HardDrive } from 'lucide-react';

interface FooterProps {
  onNavigate: (tab: 'files' | 'storage' | 'settings') => void;
  storagePath?: string;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, storagePath }) => {
  return (
    <footer className="bg-black border-t border-zinc-900 text-zinc-400 py-10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Brand & Mission */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-md bg-orange-600 flex items-center justify-center">
                <Box className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-base font-bold text-white tracking-tight">
                Xorvila<span className="text-orange-500">Box</span>
              </span>
            </div>
            <p className="text-xs text-zinc-500 max-w-sm">
              Enterprise-grade anime storage and file hosting platform powered by native Ubuntu VPS storage and HTTP Range video streaming.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-8 text-xs font-medium">
            <button
              onClick={() => onNavigate('files')}
              className="text-zinc-400 hover:text-orange-400 transition-colors"
            >
              Files
            </button>
            <button
              onClick={() => onNavigate('storage')}
              className="text-zinc-400 hover:text-orange-400 transition-colors"
            >
              Storage
            </button>
            <button
              onClick={() => onNavigate('settings')}
              className="text-zinc-400 hover:text-orange-400 transition-colors"
            >
              Documentation
            </button>
            <span className="text-zinc-600">Privacy</span>
          </div>

          {/* Storage Path Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-400">
            <Server className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="text-zinc-500">VPS Storage:</span>
            <span className="text-zinc-300 truncate max-w-[180px]">
              {storagePath || '/var/lib/xorvilabox/storage'}
            </span>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-900/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-600">
          <p>© {new Date().getFullYear()} XorvilaBox. Real Filesystem Architecture.</p>
          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            <span className="flex items-center gap-1 text-emerald-500/80">
              <ShieldCheck className="w-3 h-3" /> Zip Slip Protected
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-orange-400/80">
              <HardDrive className="w-3 h-3" /> HTTP 206 Streaming
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
