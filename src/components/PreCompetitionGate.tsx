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
  Key,
} from 'lucide-react';
import { playSuccessChime, playCyberBlip, playErrorBuzz } from '../utils/audio.ts';
import { requestAppFullscreen, isAppFullscreen } from '../utils/fullscreen.ts';

interface PreCompetitionGateProps {
  teamName?: string;
  members?: string[];
  totalChallengesCount: number;
  totalPointsPool: number;
  remainingSeconds: number;
  competitionStatus?: 'running' | 'paused' | 'ended';
  hasStarted?: boolean;
  onConfirmReady?: () => Promise<void> | void;
  onNavigateToChallenges?: () => void;
  onOpenAuthModal?: () => void;
}

export const PreCompetitionGate: React.FC<PreCompetitionGateProps> = ({
  teamName,
  members = [],
  totalChallengesCount,
  totalPointsPool,
  remainingSeconds,
  competitionStatus = 'paused',
  hasStarted = false,
  onConfirmReady,
  onNavigateToChallenges,
  onOpenAuthModal,
}) => {
  const [isActivating, setIsActivating] = useState(false);
  const [showAdminWaitModal, setShowAdminWaitModal] = useState(false);

  const isTimerRunning = competitionStatus === 'running';

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    if (!teamName) {
      playCyberBlip(750);
      if (onOpenAuthModal) onOpenAuthModal();
      else if (onNavigateToChallenges) onNavigateToChallenges();
      return;
    }

    // REQUIREMENT: Timer only starts when Admin clicks Start Timer.
    // If admin has NOT started timer, notify the user immediately and do not start.
    if (!isTimerRunning) {
      playErrorBuzz();
      setShowAdminWaitModal(true);
      return;
    }

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
        <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent ${
          isTimerRunning ? 'via-[#00ff66]' : 'via-amber-400'
        } to-transparent animate-pulse`} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-[#080b12] border flex items-center justify-center shadow-[0_0_20px_rgba(0,255,102,0.3)] shrink-0 ${
              isTimerRunning ? 'border-[#00ff66]/60 text-[#00ff66]' : 'border-amber-500/60 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
            }`}>
              <Terminal className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className={`text-[11px] font-bold tracking-widest uppercase flex items-center gap-2 ${
                isTimerRunning ? 'text-[#00ff66]' : 'text-amber-400'
              }`}>
                <span className={`w-2 h-2 rounded-full animate-ping ${isTimerRunning ? 'bg-[#00ff66]' : 'bg-amber-400'}`} />
                <span>{isTimerRunning ? 'TOURNAMENT LIVE // RULES' : 'TOURNAMENT STANDBY // WAITING FOR ADMIN'}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                PLEASE READ THE RULES BEFORE BEGINNING
              </h2>
            </div>
          </div>

          <div className="bg-[#080b12] px-3.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2 shrink-0">
            <Clock className={`w-4 h-4 ${isTimerRunning ? 'text-[#00ff66]' : 'text-amber-400'}`} />
            <span className="text-xs text-slate-400">
              {isTimerRunning ? 'TIME REMAINING:' : 'TOURNAMENT CLOCK:'}
            </span>
            <span className={`text-sm font-bold tabular-nums ${isTimerRunning ? 'text-[#00ff66]' : 'text-amber-400'}`}>
              {formatTime(remainingSeconds)}
            </span>
            {!isTimerRunning && (
              <span className="text-[10px] text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40 uppercase font-black">
                PAUSED
              </span>
            )}
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
              <span className={`text-[10px] text-black px-2 py-0.5 rounded font-black ${
                isTimerRunning
                  ? 'bg-[#00ff66]'
                  : 'bg-amber-400 animate-pulse'
              }`}>
                {isTimerRunning ? 'COMPETITION ACTIVE' : 'WAITING FOR ADMIN TIMER'}
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
            <span>TEAM MEMBERS ({members.length}/3):</span>
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
                All teams share the exact same official timer started by the administrator.
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
                Clicking the start button will automatically enter Fullscreen mode for your session once the tournament begins.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#080b12] border border-amber-500/40 sm:col-span-2 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <div className="text-amber-400 font-bold flex items-center gap-1.5 mb-1">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>5. IMPORTANT: NOTE DOWN YOUR GMAIL ID &amp; PASSWORD ON PAPER</span>
              </div>
              <p className="text-[11px] text-slate-200 font-sans leading-relaxed">
                Please remember your registered <span className="text-amber-300 font-bold">Gmail ID and Password</span> or note them down on your paper right now. If your browser closes, tab reloads, or device restarts, you will need the exact same credentials to log back in without losing your team score.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button: START COMPETITION / RESUME CHALLENGES */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col items-center text-center">
          
          {/* Real-Time Admin Standby Notification Banner */}
          {teamName && !isTimerRunning && (
            <div className="w-full mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/60 via-[#18120a]/90 to-amber-950/60 border-2 border-amber-500/70 text-amber-200 text-xs shadow-[0_0_30px_rgba(245,158,11,0.25)] flex items-start gap-3.5 text-left animate-fadeIn">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="font-mono font-black text-amber-400 uppercase tracking-wider flex items-center gap-2 text-xs sm:text-sm">
                  <span>TOURNAMENT STANDBY // WAITING FOR ADMIN TIMER</span>
                  <span className="text-[10px] bg-amber-500/25 px-2 py-0.5 rounded border border-amber-500/40 text-amber-300">
                    STATUS: HELD
                  </span>
                </div>
                <p className="text-[12px] text-slate-300 font-sans leading-relaxed">
                  The competition has not started yet. The administrator has not started the timer. All challenges are currently locked so that all squads start at the exact same moment. Please wait for the event coordinators to start the countdown.
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400 mb-4 max-w-md">
            {!teamName
              ? 'Review the guidelines above. Once ready, register your squad or log in to prepare for the tournament.'
              : !isTimerRunning
              ? 'Your squad is registered and ready. When the administrator starts the timer, you will be able to begin the competition simultaneously with all teams.'
              : hasStarted
              ? 'Your squad is currently participating in the competition. You can review the guidelines above at any time.'
              : 'The competition is live! Click the button below to enter Fullscreen mode and unlock your challenges.'}
          </p>

          <button
            onClick={handleStart}
            disabled={isActivating}
            className={`w-full sm:w-auto px-10 py-4 font-mono font-black text-sm sm:text-base tracking-widest uppercase rounded-xl flex items-center justify-center gap-3 transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer ${
              !teamName
                ? 'bg-[#00ff66] hover:bg-[#00ff66]/85 text-black shadow-[0_0_25px_rgba(0,255,102,0.5)] hover:shadow-[0_0_40px_rgba(0,255,102,0.8)]'
                : !isTimerRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_25px_rgba(245,158,11,0.5)] hover:shadow-[0_0_40px_rgba(245,158,11,0.8)]'
                : hasStarted
                ? 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-[0_0_25px_rgba(6,182,212,0.5)] hover:shadow-[0_0_40px_rgba(6,182,212,0.8)]'
                : 'bg-[#00ff66] hover:bg-[#00ff66]/85 text-black shadow-[0_0_25px_rgba(0,255,102,0.5)] hover:shadow-[0_0_40px_rgba(0,255,102,0.8)]'
            }`}
          >
            {!teamName ? (
              <>
                <Key className="w-5 h-5 text-black" />
                <span>SIGN UP / LOG IN TO COMPETE</span>
              </>
            ) : !isTimerRunning ? (
              <>
                <Clock className="w-5 h-5 text-black animate-pulse" />
                <span>START CHALLENGE (WAITING FOR ADMIN)</span>
              </>
            ) : hasStarted ? (
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

      {/* Interactive Modal when user clicks Start Challenge before Admin starts the timer */}
      {showAdminWaitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="max-w-md w-full rounded-2xl bg-[#0c101a] border-2 border-amber-500/80 p-6 sm:p-8 font-mono text-center shadow-[0_0_60px_rgba(245,158,11,0.4)] relative">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border-2 border-amber-500/60 flex items-center justify-center text-amber-400 mb-4 shadow-[0_0_25px_rgba(245,158,11,0.3)]">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>

            <div className="inline-block px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-2">
              TOURNAMENT PROTOCOL
            </div>

            <h3 className="text-xl font-black text-white uppercase tracking-wide">
              ADMIN HAS NOT STARTED THE TIMER
            </h3>

            <p className="mt-3 text-xs text-slate-300 font-sans leading-relaxed">
              The competition has not started yet. The administrator has not started the timer. All challenges are currently locked to guarantee complete fairness and ensure every team gets the exact same amount of time.
            </p>

            <div className="mt-5 p-3 rounded-xl bg-[#060910] border border-slate-800 text-[11px] text-slate-400 flex items-center justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span className="text-amber-300 font-bold">Standing by for tournament coordinator to start timer...</span>
            </div>

            <button
              type="button"
              onClick={() => {
                playCyberBlip(700);
                setShowAdminWaitModal(false);
              }}
              className="mt-6 w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs tracking-wider uppercase transition-all shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:shadow-[0_0_35px_rgba(245,158,11,0.7)] cursor-pointer"
            >
              UNDERSTOOD / STAND BY
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
