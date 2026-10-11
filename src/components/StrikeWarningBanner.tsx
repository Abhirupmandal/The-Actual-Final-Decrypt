import React, { useEffect } from 'react';
import { Camera, AlertTriangle, X, ShieldAlert } from 'lucide-react';

interface StrikeWarningBannerProps {
  strikes: number;
  reason: string;
  onDismiss: () => void;
}

export const StrikeWarningBanner: React.FC<StrikeWarningBannerProps> = ({
  strikes,
  reason,
  onDismiss,
}) => {
  useEffect(() => {
    // Non-intrusive auto-dismiss after 7 seconds
    const timer = setTimeout(() => {
      onDismiss();
    }, 7000);
    return () => clearTimeout(timer);
  }, [strikes, onDismiss]);

  return (
    <div className="fixed top-20 right-4 sm:right-8 z-[99999] max-w-md w-full animate-in slide-in-from-top-4 duration-300 font-mono text-xs select-none pointer-events-auto">
      <div className="bg-[#180505]/95 border-2 border-red-500/80 rounded-xl p-3.5 sm:p-4 shadow-[0_0_25px_rgba(239,68,68,0.4),0_10px_30px_rgba(0,0,0,0.9)] backdrop-blur-xl flex items-start justify-between gap-3 relative overflow-hidden">
        {/* Top Glowing Red Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />

        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0 mt-0.5 shadow-[0_0_12px_rgba(239,68,68,0.35)]">
            <Camera className="w-5 h-5 animate-pulse text-red-400" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-red-400 font-black text-xs tracking-wider">
                SCREENSHOT DETECTED
              </span>
              <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.2 rounded border border-red-500/40 font-bold">
                WARNING #{strikes}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 font-sans mt-1 leading-relaxed">
              {reason || 'Taking screenshots during the competition is not allowed. This has been alerted to the coordinators.'}
            </p>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors shrink-0"
          title="Dismiss warning notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
