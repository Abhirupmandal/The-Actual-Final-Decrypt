import React from 'react';
import { Camera, AlertTriangle, ShieldAlert, X, EyeOff, Lock } from 'lucide-react';
import { playErrorBuzz } from '../utils/audio.ts';

interface ScreenshotWarningModalProps {
  isOpen: boolean;
  triggerKey: string;
  details?: string;
  strikes?: number;
  teamName?: string;
  onAcknowledge: () => void;
}

export const ScreenshotWarningModal: React.FC<ScreenshotWarningModalProps> = ({
  isOpen,
  triggerKey,
  details,
  strikes = 1,
  teamName,
  onAcknowledge,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 select-none font-mono text-xs animate-in fade-in duration-200">
      {/* High-Contrast Glitch Scanlines & Crimson Glowing Emergency Modal */}
      <div className="max-w-lg w-full bg-[#0d0202] border-2 border-red-500 rounded-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(239,68,68,0.65),inset_0_0_30px_rgba(239,68,68,0.2)] text-center space-y-5 relative overflow-hidden scanline-red">
        {/* Top Glitch Warning Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-400 to-red-600 animate-pulse" />

        {/* Pulsing Camera & Alarm Icon */}
        <div className="flex justify-center mt-2">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-red-600/25 border-2 border-red-500 flex items-center justify-center text-red-400 shadow-[0_0_35px_rgba(239,68,68,0.8)] animate-pulse">
              <Camera className="w-8 h-8 text-red-400 animate-bounce" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 animate-ping" />
            <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
          </div>
        </div>

        <div>
          <div className="text-red-400 font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
            <span>[ANTI-CHEAT PROCTORING ALERT]</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-black font-mono text-white mt-1.5 tracking-wider drop-shadow-[0_0_15px_rgba(255,51,102,0.85)] animate-glitch">
            SCREENSHOT DETECTED!
          </h3>

          <div className="text-[11px] font-mono text-amber-300 font-bold mt-1 tracking-wider uppercase">
            SCREEN CAPTURE IS STRICTLY PROHIBITED
          </div>
        </div>

        {/* Infraction Telemetry Box */}
        <div className="bg-[#180404]/95 border border-red-800/90 rounded-xl p-4 text-left space-y-2.5 shadow-inner">
          <div className="text-slate-400 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
            <div className="flex items-center gap-1.5 text-red-400">
              <EyeOff className="w-3.5 h-3.5" />
              <span>RECORDED VIOLATION TELEMETRY</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-bold">
              STRIKE #{strikes} OF 10
            </span>
          </div>

          <div className="bg-black/70 p-3 rounded-lg border border-red-900/80 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">TRIGGER KEY / TOOL:</span>
              <span className="text-red-300 font-bold font-mono px-2 py-0.5 rounded bg-red-950/80 border border-red-500/50">
                {triggerKey || 'PrintScreen'}
              </span>
            </div>
            {teamName && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">COMPETING SQUAD:</span>
                <span className="text-white font-bold">{teamName}</span>
              </div>
            )}
            <div className="text-slate-300 text-[11px] pt-1 border-t border-slate-800 leading-relaxed">
              {details || 'Screen capture shortcut triggered. Full incident details have been timestamped and transmitted to the Administrator Arbitration console.'}
            </div>
          </div>

          <div className="text-amber-300 font-bold flex items-center gap-1.5 text-[11px]">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              All screen recording, Snipping Tool, and capture shortcuts are monitored. Repeated violations will result in competition disqualification.
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 font-sans leading-relaxed max-w-sm mx-auto">
          Please continue solving challenges without capturing or sharing screen images to maintain fair play.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              playErrorBuzz();
              onAcknowledge();
            }}
            className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-wider text-xs shadow-[0_0_25px_rgba(239,68,68,0.7)] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>I UNDERSTAND · RETURN TO COMPETITION</span>
          </button>
        </div>
      </div>
    </div>
  );
};
