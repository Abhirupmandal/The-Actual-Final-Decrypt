import React from 'react';
import { Skull, AlertOctagon, ShieldAlert, LogOut, Terminal, Lock } from 'lucide-react';

interface DisqualificationScreenProps {
  teamName?: string;
  reason?: string;
  onLogout: () => void;
}

export const DisqualificationScreen: React.FC<DisqualificationScreenProps> = ({
  teamName = 'TEAM',
  reason = '5-Strike Security Violation Limit Exceeded',
  onLogout,
}) => {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#050000] text-red-500 font-mono flex flex-col items-center justify-center p-6 select-none overflow-hidden animate-fadeIn">
      {/* Glitch CRT Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,0,0.2)_0%,rgba(0,0,0,0.95)_100%)] pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,0,0,0.06)_1px,transparent_1px)] bg-[size:100%_4px]" />

      <div className="relative z-10 max-w-xl w-full border-2 border-red-500 bg-[#0d0202] rounded-2xl p-7 sm:p-9 shadow-[0_0_90px_rgba(255,0,0,0.5),inset_0_0_30px_rgba(255,0,0,0.15)] text-center space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-22 h-22 rounded-2xl bg-red-600/20 border-2 border-red-500 flex items-center justify-center text-red-500 animate-pulse shadow-[0_0_40px_rgba(255,0,0,0.6)]">
              <Skull className="w-12 h-12" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 animate-ping" />
          </div>
        </div>

        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-red-950/90 border border-red-500 text-xs font-black uppercase tracking-widest text-red-400 mb-2 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
            <AlertOctagon className="w-4 h-4 text-red-500 animate-bounce" />
            <span>MAXIMUM WARNING LIMIT REACHED</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]">
            [DISQUALIFIED]
          </h1>
          <p className="text-red-400 font-bold text-sm tracking-widest uppercase mt-1">
            YOUR TEAM HAS BEEN DISQUALIFIED
          </p>
        </div>

        <div className="bg-[#180404] border border-red-900/80 rounded-xl p-5 text-left text-xs space-y-2.5 shadow-inner">
          <div className="flex justify-between border-b border-red-900/50 pb-2">
            <span className="text-slate-400">TEAM NAME:</span>
            <span className="text-white font-bold text-sm">[{teamName}]</span>
          </div>
          <div className="flex justify-between border-b border-red-900/50 pb-2">
            <span className="text-slate-400">WARNINGS:</span>
            <span className="text-red-400 font-bold">10 / 10 (LIMIT REACHED)</span>
          </div>
          <div className="flex justify-between border-b border-red-900/50 pb-2">
            <span className="text-slate-400">REASON:</span>
            <span className="text-amber-400 font-bold break-all">{reason}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-slate-400">STATUS:</span>
            <span className="text-red-500 font-black">RECORDED BY EVENT COORDINATORS</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-md mx-auto">
          Your team has reached the maximum warning threshold or attempted to inspect webpage code. If you have questions regarding this decision, please speak with an event coordinator.
        </p>

        <div className="pt-2">
          <button
            onClick={onLogout}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-mono font-black tracking-widest text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,0,0,0.6)] hover:shadow-[0_0_45px_rgba(255,0,0,0.85)] transition-all active:scale-98"
          >
            <LogOut className="w-4 h-4" />
            <span>EXIT PLATFORM</span>
          </button>
        </div>
      </div>
    </div>
  );
};
