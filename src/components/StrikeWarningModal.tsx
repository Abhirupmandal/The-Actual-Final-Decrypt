import React from 'react';
import { AlertTriangle, ShieldAlert, Check, EyeOff, Terminal, Lock, Flame } from 'lucide-react';
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
  const strikesRemaining = Math.max(0, 10 - strikes);

  return (
    <div className="fixed inset-0 z-[9990] bg-black/92 backdrop-blur-xl flex items-center justify-center p-4 select-none font-mono text-xs animate-fadeIn">
      {/* High-Contrast Glitch Scanlines and Crimson Glowing Modal */}
      <div className="max-w-xl w-full bg-[#0e0202] border-2 border-red-500 rounded-2xl p-6 sm:p-8 shadow-[0_0_30px_rgba(239,68,68,0.4),0_0_60px_rgba(239,68,68,0.6),inset_0_0_30px_rgba(239,68,68,0.15)] text-center space-y-5 relative overflow-hidden scanline-red">
        {/* Top Glitch Warning Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-400 to-red-600 animate-pulse" />

        {/* Pulsing Alarm Icon Badge */}
        <div className="flex justify-center mt-2">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-red-600/20 border-2 border-red-500 flex items-center justify-center text-red-400 shadow-[0_0_35px_rgba(239,68,68,0.7)] animate-pulse">
              <ShieldAlert className="w-9 h-9" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 animate-ping" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
          </div>
        </div>

        <div>
          <div className="text-red-400 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 animate-bounce" />
            <span>[SECURITY ALERT]</span>
          </div>

          <h3 className="text-2xl sm:text-4xl font-black font-mono text-white mt-1.5 tracking-wider drop-shadow-[0_0_15px_rgba(255,51,102,0.85)] animate-glitch">
            WARNING {strikes} OF 10
          </h3>

          <div className="text-[11px] font-mono text-amber-300 font-bold mt-1 tracking-wider uppercase">
            MULTIPLE WARNINGS DETECTED
          </div>
        </div>

        {/* 10-Block Strike Tally Visual Meter */}
        <div className="space-y-1.5 my-3 bg-[#190505] p-3.5 rounded-xl border border-red-900/80">
          <div className="flex items-center justify-between text-[10px] text-slate-300 tracking-wider font-bold mb-1">
            <span>WARNINGS RECORDED:</span>
            <span className="text-red-400 font-mono font-bold">
              {strikes}/10 ISSUED ({strikesRemaining} REMAINING)
            </span>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <div
                key={num}
                className={`h-7 rounded-lg transition-all flex items-center justify-center text-[10px] font-black font-mono ${
                  num <= strikes
                    ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.9)] border border-red-400 animate-pulse'
                    : 'bg-black/80 border border-red-950 text-slate-600'
                }`}
              >
                #{num}
              </div>
            ))}
          </div>
        </div>

        {/* Infraction Telemetry Box */}
        <div className="bg-[#180404]/95 border border-red-800/90 rounded-xl p-4 text-left space-y-2.5 shadow-inner">
          <div className="text-slate-400 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
            <EyeOff className="w-3.5 h-3.5 text-red-400" />
            <span>RECORDED INCIDENT:</span>
          </div>
          <div className="text-red-300 font-mono font-bold break-words bg-black/60 p-2.5 rounded-lg border border-red-900/80 text-xs leading-relaxed">
            {reason}
          </div>
          <div className="pt-1 text-amber-300 font-bold flex items-center gap-1.5 text-xs">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              ATTENTION: INCIDENT #{strikes} RECORDED. INFRACTIONS ARE FLAGGED FOR ADMINISTRATOR ARBITRATION REVIEW.
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 font-sans leading-relaxed max-w-md mx-auto">
          Screenshots and inspection shortcuts are monitored to ensure fairness. Please continue solving challenges without capturing screen images.
        </p>

        <div className="pt-1">
          <button
            onClick={() => {
              playErrorBuzz();
              onAcknowledge();
            }}
            className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-mono font-black tracking-wider uppercase text-xs rounded-xl flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(239,68,68,0.5)] hover:shadow-[0_0_35px_rgba(239,68,68,0.8)] transition-all active:scale-98"
          >
            <Check className="w-4 h-4" />
            <span>I UNDERSTAND &amp; RESUME</span>
          </button>
        </div>
      </div>
    </div>
  );
};
