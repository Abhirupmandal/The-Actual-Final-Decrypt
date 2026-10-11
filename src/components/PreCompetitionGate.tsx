import React, { useState } from 'react';
import {
  Shield,
  ShieldAlert,
  Play,
  Users,
  AlertTriangle,
  Lock,
  Terminal,
  FileText,
  Clock,
  Radio,
  ExternalLink,
  Zap,
  Maximize2,
} from 'lucide-react';
import { playSuccessChime, playCyberBlip } from '../utils/audio.ts';
import { requestAppFullscreen, isAppFullscreen } from '../utils/fullscreen.ts';

interface PreCompetitionGateProps {
  teamName?: string;
  members?: string[];
  totalChallengesCount: number;
  totalPointsPool: number;
  remainingSeconds: number;
  hasStarted?: boolean;
  onConfirmReady?: () => Promise<void> | void;
  onNavigateToChallenges?: () => void;
}

export const PreCompetitionGate: React.FC<PreCompetitionGateProps> = ({
  teamName,
  members = [],
  totalChallengesCount,
  totalPointsPool,
  remainingSeconds,
  hasStarted = false,
  onConfirmReady,
  onNavigateToChallenges,
}) => {
  const [isActivating, setIsActivating] = useState(false);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    if (hasStarted) {
      if (onNavigateToChallenges) onNavigateToChallenges();
      return;
    }

    setIsActivating(true);
    playSuccessChime();

    // Automatically attempt to enter fullscreen on click
    try {
      await requestAppFullscreen();
    } catch (err) {
      console.warn('Auto fullscreen request:', err);
    }

    try {
      if (onConfirmReady) {
        await onConfirmReady();
      }
    } catch (e) {
      console.error('Failed to trigger ready state:', e);
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4 font-mono animate-fadeIn">
      <div className="rounded-2xl bg-[#0d111a]/90 backdrop-blur-xl border-2 border-[#00ff66]/40 p-6 sm:p-10 shadow-[0_0_50px_rgba(0,0,0,0.9),inset_0_0_30px_rgba(0,255,102,0.06)] relative overflow-hidden">
        {/* Top Animated Cyber Glow Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-[#00ff66] to-transparent animate-pulse" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#080b12] border border-[#00ff66]/60 flex items-center justify-center text-[#00ff66] shadow-[0_0_20px_rgba(0,255,102,0.3)] shrink-0">
              <Terminal className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="text-[11px] text-[#00ff66] font-bold tracking-widest uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00ff66] animate-ping" />
                <span>WELCOME // COMPETITION GUIDELINES</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                PLEASE READ THE RULES BEFORE BEGINNING
              </h2>
            </div>
          </div>

          <div className="bg-[#080b12] px-3.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2 shrink-0">
            <Clock className="w-4 h-4 text-[#00ff66]" />
            <span className="text-xs text-slate-400">TOTAL TIME:</span>
            <span className="text-sm font-bold text-[#00ff66] tabular-nums">
              {formatTime(remainingSeconds)}
            </span>
          </div>
        </div>

        {/* Team Identity Banner */}
        <div className="mt-6 p-4 rounded-xl bg-[#080b12] border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              {teamName ? 'YOUR REGISTERED TEAM' : 'COMPETITION PROTOCOL'}
            </div>
            <div className="text-lg sm:text-xl font-black text-white flex items-center gap-2 mt-0.5">
              <span className="text-[#00ff66]">&gt;</span>
              <span>{teamName || 'SQUAD RECONNAISSANCE'}</span>
              <span className={`text-[10px] text-black px-2 py-0.5 rounded font-black ${hasStarted ? 'bg-amber-400' : 'bg-[#00ff66]'}`}>
                {hasStarted ? 'COMPETITION ACTIVE' : 'READY TO START'}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
              TOTAL CHALLENGES
            </div>
            <div className="text-sm font-bold text-white mt-0.5">
              <span className="text-[#00ff66]">{totalChallengesCount} CHALLENGES</span> ·{' '}
              <span className="text-amber-300">{totalPointsPool} TOTAL POINTS</span>
            </div>
          </div>
        </div>

        {/* Squad Members List */}
        <div className="mt-4 p-4 rounded-xl bg-[#080b12] border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span>TEAM MEMBERS ({members.length}/4):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {members.map((member, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-lg bg-[#0d111a] border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66]" />
                <span className="font-bold">{member}</span>
                {i === 0 && (
                  <span className="text-[9px] text-[#00ff66] bg-[#00ff66]/15 px-1 rounded font-black">
                    TEAM LEADER
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Rules Section */}
        <div className="mt-6 space-y-3">
          <div className="text-xs font-bold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#00f0ff]" />
            <span>RULES TO BE FOLLOWED:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#080b12] border border-emerald-500/20">
              <div className="text-[#00ff66] font-bold flex items-center gap-1.5 mb-1">
                <Shield className="w-3.5 h-3.5" />
                <span>1. NO SCREENSHOTS OR RECORDINGS</span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                Taking screenshots (using PrintScreen, Snipping Tool, Win+Shift+S, etc.) is strictly monitored
                and alerted directly to event coordinators. Please solve challenges fairly without capturing screen images.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#080b12] border border-amber-500/20">
              <div className="text-amber-400 font-bold flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>2. FAIR PLAY & INTEGRITY</span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                You are welcome to research clues online, view documentation, and inspect challenge files.
                Your official team timer will begin as soon as you click the button below.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#080b12] border border-red-500/20 sm:col-span-2">
              <div className="text-red-400 font-bold flex items-center gap-1.5 mb-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>3. DO NOT TAMPER WITH OR INSPECT CODE</span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                Attempting to open browser Developer Tools (F12, Inspect Element) or modify webpage scripts
                is strictly prohibited and will be flagged for Administrator Arbitration review.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#080b12] border border-cyan-500/20 sm:col-span-2">
              <div className="text-[#00f0ff] font-bold flex items-center gap-1.5 mb-1">
                <Maximize2 className="w-3.5 h-3.5" />
                <span>4. MANDATORY FULLSCREEN MODE</span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                To guarantee competition integrity, <span className="text-cyan-300 font-bold">The Final Decrypt</span> runs in Fullscreen mode.
                Clicking the start button will automatically enter Fullscreen mode for your session.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button: START COMPETITION / RESUME CHALLENGES */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col items-center text-center">
          <p className="text-xs text-slate-400 mb-4 max-w-md">
            {hasStarted
              ? 'Your squad is currently participating in the competition. You can review the guidelines above at any time.'
              : 'Click the button below when your team is ready to begin. The test will automatically enter Fullscreen mode, your timer will start, and all challenges will unlock.'}
          </p>

          <button
            onClick={handleStart}
            disabled={isActivating}
            className={`w-full sm:w-auto px-10 py-4 font-mono font-black text-sm sm:text-base tracking-widest uppercase rounded-xl flex items-center justify-center gap-3 transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer ${
              hasStarted
                ? 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-[0_0_25px_rgba(6,182,212,0.5)] hover:shadow-[0_0_40px_rgba(6,182,212,0.8)]'
                : 'bg-[#00ff66] hover:bg-[#00ff66]/85 text-black shadow-[0_0_25px_rgba(0,255,102,0.5)] hover:shadow-[0_0_40px_rgba(0,255,102,0.8)]'
            }`}
          >
            {hasStarted ? (
              <>
                <Terminal className="w-5 h-5 text-black" />
                <span>RESUME CHALLENGES</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-black text-black" />
                <span>{isActivating ? 'STARTING COMPETITION...' : 'START COMPETITION'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
