import React from 'react';
import { AlertTriangle, ShieldAlert, Check, EyeOff, Terminal, Lock } from 'lucide-react';
import { playErrorBuzz } from '../utils/audio.ts';

interface StrikeWarningModalProps {
  strikes: number;
  reason: string;
  onAcknowledge: () => void;
}

export const StrikeWarningModal: React.FC<StrikeWarningModalProps> = ({
  strikes,
  reason,
  onAcknowledge,
}) => {
  const strikesRemaining = Math.max(0, 5 - strikes);

  return (
    <div className="fixed inset-0 z-[9990] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 select-none font-mono text-xs animate-fadeIn">
      {/* Glitch CRT Scanline Overlay Backdrop */}
      <div className="max-w-lg w-full bg-[#110505] border-2 border-red-500 rounded-2xl p-6 sm:p-7 shadow-[0_0_60px_rgba(239,68,68,0.5),inset_0_0_30px_rgba(239,68,68,0.1)] text-center space-y-5 relative overflow-hidden">
        {/* Top Glitch Warning Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />

        <div className="flex justify-center mt-1">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.6)] animate-pulse">
              <ShieldAlert className="w-9 h-9" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 animate-ping" />
          </div>
        </div>

        <div>
          <div className="text-red-400 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 animate-bounce" />
            <span>[CRITICAL TELEMETRY ALARM]</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black font-mono text-white mt-1 tracking-wider drop-shadow-[0_0_12px_rgba(255,51,102,0.8)]">
            STRIKE {strikes} OF 5 ISSUED
          </h3>
          <div className="text-[11px] font-mono text-amber-300 mt-0.5">
            ANTI-CHEATING & FOCUS LOSS INTERCEPTION TRIGGERED
          </div>
        </div>

        {/* Visual 5-Block Strike Meter */}
        <div className="space-y-1.5 my-2">
          <div className="text-[10px] text-slate-400 tracking-wider">
            STRIKE ACCUMULATION LEVEL:
          </div>
          <div className="flex justify-center items-center gap-2 sm:gap-3">
            {[1, 2, 3, 4, 5].map((num) => (
              <div key={num} className="flex-1 max-w-[70px]">
                <div
                  className={`h-4 rounded-md transition-all flex items-center justify-center text-[10px] font-black ${
                    num <= strikes
                      ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.8)] border border-red-400'
                      : 'bg-slate-900 border border-slate-800 text-slate-600'
                  }`}
                >
                  #{num}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Infraction Telemetry Box */}
        <div className="bg-[#1c0808]/90 border border-red-800/80 rounded-xl p-4 text-left space-y-2 text-xs shadow-inner">
          <div className="text-slate-400 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
            <EyeOff className="w-3.5 h-3.5 text-red-400" />
            <span>RECORDED INFRACTION REASON:</span>
          </div>
          <div className="text-red-300 font-mono font-bold break-words bg-black/50 p-2.5 rounded border border-red-900/60 text-xs">
            {reason}
          </div>
          <div className="pt-1 text-amber-300 font-bold flex items-center gap-1.5 text-xs">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>
              PENALTY WARNING: {strikesRemaining} {strikesRemaining === 1 ? 'MORE INFRACTION' : 'MORE INFRACTIONS'} BEFORE AUTOMATIC SESSION TERMINATION.
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 font-sans leading-relaxed max-w-md mx-auto">
          Tab switching, window blur, DevTools shortcuts (F12, Ctrl+Shift+I), screen capture attempts, and copy interceptions are logged immutably. Keep active focus on the competition terminal.
        </p>

        <div className="pt-2">
          <button
            onClick={() => {
              playErrorBuzz();
              onAcknowledge();
            }}
            className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-mono font-black tracking-wider uppercase text-xs rounded-xl flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(239,68,68,0.5)] hover:shadow-[0_0_35px_rgba(239,68,68,0.8)] transition-all active:scale-98"
          >
            <Check className="w-4 h-4" />
            <span>ACKNOWLEDGE WARNING & RESUME FOCUS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
