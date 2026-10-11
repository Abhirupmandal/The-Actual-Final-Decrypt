import React from 'react';
import { EyeOff, ShieldAlert, Lock, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAntiScreenshotSecurity } from '../hooks/useAntiScreenshotSecurity.tsx';

interface BlackoutShieldProps {
  teamName?: string;
  sessionId?: string;
}

export const BlackoutShield: React.FC<BlackoutShieldProps> = ({ teamName, sessionId }) => {
  const { isBlackedOut, blackoutReason, countdownSeconds, triggerSource, resumeSession } =
    useAntiScreenshotSecurity();

  if (!isBlackedOut) return null;

  return (
    <div
      id="anti-screenshot-blackout-shield"
      className="fixed inset-0 z-[999999] bg-[#020000] text-[#e2e8f0] select-none flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden animate-in fade-in duration-150"
      style={{
        backdropFilter: 'blur(35px)',
        WebkitBackdropFilter: 'blur(35px)',
      }}
      onClick={(e) => {
        // Prevent clicking through to underlying sensitive questions
        e.stopPropagation();
      }}
    >
      {/* Heavy Glitch Crimson Scanlines Layer */}
      <div className="absolute inset-0 scanline-red pointer-events-none opacity-60" />

      {/* Pulsing Perimeter Emergency Hazard Line */}
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-400 to-red-600 animate-pulse" />
      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-400 to-red-600 animate-pulse" />

      {/* Diagonal Security Watermark Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-10 flex flex-wrap gap-12 p-8 transform -rotate-12 select-none overflow-hidden font-mono text-xs text-red-500">
        {Array.from({ length: 36 }).map((_, i) => (
          <div key={i} className="whitespace-nowrap tracking-widest font-black">
            PROTECTED CTF DATA · {teamName || 'OFFICIAL COMPETITOR'} · {sessionId ? sessionId.slice(0, 8) : 'SECURE'}
          </div>
        ))}
      </div>

      {/* Main Shield Panel Card */}
      <div className="relative z-10 max-w-xl w-full bg-[#0a0202]/95 border-2 border-red-500 rounded-2xl p-6 sm:p-10 shadow-[0_0_80px_rgba(239,68,68,0.7),inset_0_0_35px_rgba(239,68,68,0.25)] text-center space-y-6">
        
        {/* Pulsing Alarm Beacon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-red-600/20 border-2 border-red-500 flex items-center justify-center text-red-400 shadow-[0_0_40px_rgba(239,68,68,0.85)] animate-pulse">
              <EyeOff className="w-10 h-10 animate-bounce text-red-400" />
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 animate-ping" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b]" />
          </div>
        </div>

        {/* Warning Headlines */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-500/60 text-red-300 font-mono text-xs font-black tracking-widest uppercase shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
            <span>SECURITY BLACKOUT SHIELD ACTIVE</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black font-mono text-white tracking-wider drop-shadow-[0_0_20px_rgba(255,51,102,0.9)] animate-glitch">
            SCREEN CAPTURE / BLUR DETECTED
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 font-sans max-w-md mx-auto leading-relaxed">
            The challenge content has been protected by the real-time blackout shield to prevent question leakage and unauthorized screen recording.
          </p>
        </div>

        {/* Reason Telemetry Box */}
        <div className="bg-[#140303] border border-red-900/90 rounded-xl p-4 text-left font-mono text-xs space-y-2 shadow-inner">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>INCIDENT TELEMETRY:</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 font-bold uppercase">
              {triggerSource ? triggerSource.replace('_', ' ') : 'WINDOW BLUR'}
            </span>
          </div>

          <div className="bg-black/60 p-2.5 rounded border border-red-950 text-red-200 text-xs leading-relaxed font-bold">
            {blackoutReason || '⚠️ SECURITY ALERT: Screen capture / Tab switching detected. Return to the challenge window to resume.'}
          </div>

          {teamName && (
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
              <span>COMPETING SQUAD:</span>
              <span className="text-white font-bold">{teamName}</span>
            </div>
          )}
        </div>

        {/* Countdown Flash or Resume Action */}
        <div className="space-y-3 pt-2">
          {typeof countdownSeconds === 'number' && countdownSeconds > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-amber-300 font-mono text-xs font-bold animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>PROTECTIVE BLACKOUT SHIELD ACTIVE FOR {countdownSeconds}s</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-red-500 to-amber-400 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdownSeconds / 4) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                resumeSession();
              }}
              className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black font-mono uppercase tracking-wider text-xs sm:text-sm shadow-[0_0_35px_rgba(239,68,68,0.8)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>CLICK TO RESUME CHALLENGE WINDOW</span>
            </button>
          )}

          <p className="text-[11px] text-slate-500 font-mono">
            Focus the challenge browser window to return to active competition state.
          </p>
        </div>
      </div>
    </div>
  );
};
