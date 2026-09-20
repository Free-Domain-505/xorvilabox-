import React, { useState } from 'react';
import { Box, HardDrive, Settings, FolderClosed, LogIn, LogOut, Menu, X, ArrowUpDown } from 'lucide-react';
import { type User } from '../types.js';
import { useTransfers } from '../context/TransferContext.js';

interface NavbarProps {
  currentTab: 'files' | 'storage' | 'settings';
  setCurrentTab: (tab: 'files' | 'storage' | 'settings') => void;
  user: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  user,
  onOpenLogin,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { activeTransfers, transfers, openManager } = useTransfers();

  return (
    <header className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <div 
          onClick={() => { setCurrentTab('files'); setMobileMenuOpen(false); }}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/20 group-hover:bg-orange-500 transition-colors">
            <Box className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
              Xorvila<span className="text-orange-500">Box</span>
            </span>
            <span className="hidden sm:block text-[10px] text-zinc-400 uppercase tracking-widest font-mono -mt-1">
              Anime Storage & Hosting
            </span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <button
            onClick={() => setCurrentTab('files')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'files'
                ? 'bg-zinc-800 text-orange-400 shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <FolderClosed className="w-4 h-4" />
            <span>Files</span>
          </button>

          <button
            onClick={() => setCurrentTab('storage')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'storage'
                ? 'bg-zinc-800 text-orange-400 shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Storage</span>
          </button>

          <button
            onClick={() => setCurrentTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'settings'
                ? 'bg-zinc-800 text-orange-400 shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </nav>

        {/* User Auth Section & Transfers Button */}
        <div className="hidden md:flex items-center gap-3">
          {/* Transfers Manager Trigger Button */}
          <button
            onClick={() => openManager()}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              activeTransfers.length > 0
                ? 'bg-orange-950/40 border-orange-500/40 text-orange-400 shadow-sm'
                : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-300 hover:text-white hover:bg-zinc-750'
            }`}
            title="Open Transfers Manager"
          >
            <ArrowUpDown className={`w-3.5 h-3.5 ${activeTransfers.length > 0 ? 'animate-bounce text-orange-400' : ''}`} />
            <span>Transfers</span>
            {activeTransfers.length > 0 ? (
              <span className="bg-orange-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                {activeTransfers.length}
              </span>
            ) : transfers.length > 0 ? (
              <span className="bg-zinc-700 text-zinc-300 text-[10px] font-semibold px-1.5 py-0.2 rounded-full">
                {transfers.length}
              </span>
            ) : null}
          </button>

          {user ? (
            <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700/60 rounded-full pl-3 pr-1.5 py-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-zinc-200">{user.username}</span>
              <span className="text-[10px] bg-orange-600/20 text-orange-400 font-semibold px-1.5 py-0.5 rounded">
                Admin
              </span>
              <button
                onClick={onLogout}
                title="Log out"
                className="p-1 rounded-full text-zinc-400 hover:text-rose-400 hover:bg-zinc-700/50 transition-colors ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-md shadow-orange-600/20 transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Admin Login</span>
            </button>
          )}
        </div>

        {/* Mobile menu toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => openManager()}
            className="p-2 rounded-lg bg-zinc-800 text-zinc-300 relative"
            title="Transfers"
          >
            <ArrowUpDown className="w-4 h-4" />
            {activeTransfers.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping" />
            )}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-zinc-900 border-b border-zinc-800 px-4 pt-2 pb-4 space-y-2">
          <button
            onClick={() => { setCurrentTab('files'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentTab === 'files' ? 'bg-orange-600/20 text-orange-400' : 'text-zinc-300'
            }`}
          >
            <FolderClosed className="w-4 h-4" />
            <span>Files</span>
          </button>
          <button
            onClick={() => { setCurrentTab('storage'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentTab === 'storage' ? 'bg-orange-600/20 text-orange-400' : 'text-zinc-300'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Storage</span>
          </button>
          <button
            onClick={() => { setCurrentTab('settings'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentTab === 'settings' ? 'bg-orange-600/20 text-orange-400' : 'text-zinc-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button
            onClick={() => { openManager(); setMobileMenuOpen(false); }}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-orange-400 bg-orange-950/20 border border-orange-500/20"
          >
            <div className="flex items-center gap-3">
              <ArrowUpDown className="w-4 h-4" />
              <span>Transfers Manager</span>
            </div>
            {activeTransfers.length > 0 && (
              <span className="text-xs bg-orange-600 text-white font-bold px-2 py-0.5 rounded-full">
                {activeTransfers.length}
              </span>
            )}
          </button>

          <div className="pt-2 border-t border-zinc-800">
            {user ? (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium text-zinc-200">{user.username} (Admin)</span>
                </div>
                <button
                  onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => { onOpenLogin(); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-semibold"
              >
                <LogIn className="w-4 h-4" />
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
