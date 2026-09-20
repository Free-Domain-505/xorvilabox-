import React, { useState } from 'react';
import { Settings, Lock, Server, ShieldCheck, Check, AlertCircle, Loader2 } from 'lucide-react';
import { type User } from '../types.js';

interface SettingsViewProps {
  user: User | null;
  onShowToast: (msg: string) => void;
  onOpenLogin: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ user, onShowToast, onOpenLogin }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenLogin();
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onShowToast('Password updated successfully on VPS');
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="border-b border-zinc-800/80 pb-5">
        <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-orange-500" />
          <span>Platform & Security Settings</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Manage administrator access, filesystem paths, and VPS runtime configurations
        </p>
      </div>

      {/* Admin Password Change */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Administrator Password</h3>
            <p className="text-xs text-zinc-400">Secure PBKDF2 with SHA-512 cryptographic hashing</p>
          </div>
        </div>

        {user ? (
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Current Password:
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-black border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                New Password:
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-black border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Confirm New Password:
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-black border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-orange-500"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/40">
                <Check className="w-4 h-4 shrink-0" />
                <span>Password changed successfully!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 text-white text-xs font-semibold shadow-md shadow-orange-600/20 flex items-center gap-1.5 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>Update Password</span>
            </button>
          </form>
        ) : (
          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Please sign in as administrator to change access credentials.
            </p>
            <button
              onClick={onOpenLogin}
              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
            >
              Sign In
            </button>
          </div>
        )}
      </div>

      {/* VPS Runtime Information */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Ubuntu VPS Runtime Configuration</h3>
            <p className="text-xs text-zinc-400">Live storage mounts, systemd, and reverse proxy details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 block text-[10px] uppercase tracking-wider mb-1 font-sans">Storage Directory</span>
            <span className="text-orange-400 font-bold">/var/lib/xorvilabox/storage</span>
          </div>

          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 block text-[10px] uppercase tracking-wider mb-1 font-sans">Database Location</span>
            <span className="text-zinc-200">/var/www/xorvilabox/data/xorvilabox.db</span>
          </div>

          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 block text-[10px] uppercase tracking-wider mb-1 font-sans">Systemd Service</span>
            <span className="text-emerald-400">xorvilabox.service (Auto-restart on fail)</span>
          </div>

          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
            <span className="text-zinc-500 block text-[10px] uppercase tracking-wider mb-1 font-sans">Nginx Reverse Proxy</span>
            <span className="text-zinc-200">HTTP/2, Range Header pass-through</span>
          </div>
        </div>
      </div>

    </div>
  );
};
