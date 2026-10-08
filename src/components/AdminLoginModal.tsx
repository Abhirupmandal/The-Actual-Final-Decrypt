import React, { useState } from 'react';
import { Lock, ShieldAlert, Key, X, AlertCircle } from 'lucide-react';
import { playCyberBlip, playSuccessChime, playErrorBuzz } from '../utils/audio.ts';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    playCyberBlip(800);

    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        playSuccessChime();
        localStorage.setItem('ctf_admin_token', data.token);
        onSuccess(data.token);
        onClose();
      } else {
        playErrorBuzz();
        setError(data.error || 'Access denied: Invalid master passkey.');
      }
    } catch (e) {
      playErrorBuzz();
      setError('Connection refused by arbitration server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f1422] border-2 border-amber-500/60 shadow-[0_0_35px_rgba(245,158,11,0.25)] rounded-xl p-6 max-w-sm w-full font-mono text-xs relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-amber-400 mb-1">
          <ShieldAlert className="w-4 h-4 animate-pulse" />
          <span className="font-bold tracking-wider">RESTRICTED ZONE</span>
        </div>
        <h3 className="text-base font-bold text-white mb-2">
          MASTER ADMIN AUTHENTICATION
        </h3>
        <p className="text-slate-400 font-sans text-xs mb-4">
          Authenticate with the master arbitration key to access platform controls, timer management, and telemetry.
        </p>

        {error && (
          <div className="p-2.5 rounded mb-4 bg-red-500/15 border border-red-500/40 text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-slate-300 font-bold block mb-1">
              MASTER PASSKEY
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master admin key..."
                className="w-full bg-[#080b12] border border-slate-700 focus:border-amber-400 rounded pl-8 pr-3 py-2 text-white outline-none"
              />
            </div>
            <div className="mt-1.5 text-[10px] text-slate-500">
              Secured via <code className="text-amber-400/90">ADMIN_PASSWORD</code> environment secret.
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{isLoading ? 'VERIFYING CREDENTIALS...' : 'AUTHENTICATE AS ADMIN'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
