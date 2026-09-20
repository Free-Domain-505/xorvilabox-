import React, { useState, useEffect } from 'react';
import { HardDrive, Server, Folder, File, RefreshCw, Database, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { type StorageStats } from '../types.js';
import { formatBytes } from '../utils/format.js';

interface StorageViewProps {
  onShowToast: (msg: string) => void;
}

export const StorageView: React.FC<StorageViewProps> = ({ onShowToast }) => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      let res = await fetch('/api/stats');
      if (!res.ok) {
        res = await fetch('/api/storage/stats');
      }
      if (!res.ok) throw new Error('Failed to fetch storage stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
      onShowToast('Could not refresh VPS storage stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const disk = stats?.disk;
  const platform = stats?.platform;

  // Real calculation
  const totalBytes = disk?.totalDiskBytes || 1;
  const usedBytes = disk?.usedDiskBytes || 0;
  const freeBytes = disk?.freeDiskBytes || 0;
  const xorvilaBytes = platform?.xorvilaBoxBytes || 0;

  const usedPercent = Math.min(100, Math.round((usedBytes / totalBytes) * 100));
  const xorvilaPercent = Math.min(100, Math.round((xorvilaBytes / totalBytes) * 100));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <HardDrive className="w-7 h-7 text-orange-500" />
            <span>Ubuntu VPS Storage Analytics</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real filesystem capacity, volume utilization, and indexed metadata
          </p>
        </div>

        <button
          onClick={fetchStats}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold border border-zinc-800 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-500' : 'text-zinc-400'}`} />
          <span>Refresh Disk Stats</span>
        </button>
      </div>

      {/* Visual Storage Bar (Section 19) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-300 mb-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">VPS Mount Point:</span>
            <span className="font-mono text-orange-400">{disk?.storagePath || '/var/lib/xorvilabox/storage'}</span>
          </div>
          <div className="font-mono text-sm">
            <span className="text-orange-500 font-bold">{formatBytes(usedBytes)}</span>
            <span className="text-zinc-500"> / </span>
            <span className="text-zinc-300 font-bold">{formatBytes(totalBytes)}</span>
            <span className="text-zinc-500 text-xs ml-1.5">({usedPercent}% Used)</span>
          </div>
        </div>

        {/* Real Visual Bar: Orange color for used space, Black/gray for remaining space */}
        <div className="w-full h-5 bg-black rounded-full overflow-hidden p-0.5 border border-zinc-800 relative">
          <div
            className="h-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 rounded-full transition-all duration-500 shadow-lg shadow-orange-600/30"
            style={{ width: `${Math.max(1, usedPercent)}%` }}
          />
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-orange-500" />
            <span>Used Disk Space: <strong>{formatBytes(usedBytes)}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-amber-400" />
            <span>XorvilaBox Files: <strong>{formatBytes(xorvilaBytes)}</strong> ({xorvilaPercent}%)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-zinc-800" />
            <span>Free VPS Space: <strong>{formatBytes(freeBytes)}</strong></span>
          </div>
        </div>
      </div>

      {/* 5 Real Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Total Storage */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Total Storage</span>
            <Server className="w-4 h-4 text-zinc-500" />
          </div>
          <p className="text-xl font-black text-white font-mono">{formatBytes(totalBytes)}</p>
          <span className="text-[11px] text-zinc-500 mt-1">VPS block device</span>
        </div>

        {/* Used Storage */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Used Storage</span>
            <HardDrive className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-xl font-black text-orange-400 font-mono">{formatBytes(usedBytes)}</p>
          <span className="text-[11px] text-zinc-500 mt-1">{usedPercent}% allocated</span>
        </div>

        {/* Free Storage */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Free Storage</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-black text-emerald-400 font-mono">{formatBytes(freeBytes)}</p>
          <span className="text-[11px] text-zinc-500 mt-1">Available for anime</span>
        </div>

        {/* Total Files */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Total Files</span>
            <File className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-black text-white font-mono">{platform?.totalFiles || 0}</p>
          <span className="text-[11px] text-zinc-500 mt-1">Videos & subtitles</span>
        </div>

        {/* Total Folders */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Total Folders</span>
            <Folder className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-black text-white font-mono">{platform?.totalFolders || 0}</p>
          <span className="text-[11px] text-zinc-500 mt-1">Anime series & seasons</span>
        </div>

      </div>

      {/* Real Architecture Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Filesystem Integrity */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 text-orange-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Filesystem Security & Guarantees</h3>
              <p className="text-xs text-zinc-400">Strict storage isolation active</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-zinc-300">
            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <div>
                <strong className="text-white">Path Traversal Block:</strong> Every file operation validates that target paths strictly resolve inside <code>{disk?.storagePath}</code> using canonical paths.
              </div>
            </div>

            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <div>
                <strong className="text-white">HTTP 206 Range Seeking:</strong> Large video files are streamed in chunks without RAM buffering, allowing VLC and HTML5 players to seek instantly.
              </div>
            </div>

            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <div>
                <strong className="text-white">Direct Disk I/O:</strong> Uploads and URL downloads stream directly to disk via Node.js pipeline streams.
              </div>
            </div>
          </div>
        </div>

        {/* Database & Metadata Storage */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 text-orange-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">SQLite Index Engine</h3>
              <p className="text-xs text-zinc-400">Fast relational query cache</p>
            </div>
          </div>

          <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800/80 space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-zinc-900">
              <span className="text-zinc-500 font-sans">Engine:</span>
              <span className="text-zinc-200">SQLite (libsql WAL mode)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-900">
              <span className="text-zinc-500 font-sans">Tables:</span>
              <span className="text-zinc-300">users, folders, files, import_jobs</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-900">
              <span className="text-zinc-500 font-sans">Folder Indexing:</span>
              <span className="text-orange-400 font-semibold">Recursive tree support</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-500 font-sans">Episode Auto-Sort:</span>
              <span className="text-emerald-400">Natural numeric ascending</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
