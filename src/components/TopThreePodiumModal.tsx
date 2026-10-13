import React, { useEffect } from 'react';
import {
  Crown,
  Medal,
  Trophy,
  Users,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Flame,
  Award,
  X,
  Clock,
} from 'lucide-react';
import type { LeaderboardEntry } from '../types.ts';
import { playSuccessChime, playCyberBlip } from '../utils/audio.ts';

interface TopThreePodiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  top3: LeaderboardEntry[];
  totalTeams: number;
  hasSubmittedFeedback?: boolean;
  onViewDashboard: () => void;
}

export const TopThreePodiumModal: React.FC<TopThreePodiumModalProps> = ({
  isOpen,
  onClose,
  top3,
  totalTeams,
  hasSubmittedFeedback,
  onViewDashboard,
}) => {
  const [countdown, setCountdown] = React.useState(5);
  const onViewDashboardRef = React.useRef(onViewDashboard);
  onViewDashboardRef.current = onViewDashboard;
  const hasTriggeredRef = React.useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(5);
      hasTriggeredRef.current = false;
      return;
    }

    playSuccessChime();
    setCountdown(5);
    hasTriggeredRef.current = false;

    let remaining = 5;
    const interval = setInterval(() => {
      remaining -= 1;
      setCountdown(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(interval);
        if (!hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          onViewDashboardRef.current();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hasTriggeredRef.current = true;
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  const formatSolveTime = (ts?: number) => {
    if (!ts) return 'Active';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleDismiss = (e?: React.MouseEvent) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
      e.stopPropagation();
    }
    hasTriggeredRef.current = true;
    try {
      playCyberBlip(750);
    } catch {}
    onClose();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss(e);
      }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-xl animate-fadeIn overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-gradient-to-b from-[#0d121f] via-[#090d16] to-[#04060b] border-2 border-amber-500/60 rounded-3xl p-6 sm:p-10 shadow-[0_0_80px_rgba(245,158,11,0.35)] text-center font-mono my-auto">
        {/* Top Glowing Beam */}
        <div className="absolute top-0 left-1/4 right-1/4 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_20px_#f59e0b]" />

        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-900/80 hover:bg-slate-800 transition-colors cursor-pointer"
          title="Dismiss podium popup (Esc)"
          aria-label="Dismiss podium popup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-widest mb-3 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          <span>VICTORY CEREMONY // TOURNAMENT COMPLETE</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-2 uppercase drop-shadow-md">
          CHAMPIONS OF THE ARENA
        </h2>
        <p className="text-slate-300 font-sans text-xs sm:text-sm max-w-xl mx-auto mb-8">
          The competition has officially concluded! All submissions are locked, final score penalties have been calculated, and the champions have been verified across all {totalTeams} squads.
        </p>

        {/* 3-Tier Podium Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end mb-8">
          {/* 2nd Place: Silver (Left) */}
          <div className="order-2 md:order-1 bg-[#0e1320]/90 border border-slate-300/40 rounded-2xl p-5 shadow-[0_0_25px_rgba(203,213,225,0.15)] flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-300/60" />
            <div className="w-12 h-12 rounded-full bg-slate-400/20 border border-slate-300 flex items-center justify-center text-slate-200 mb-2 shadow-[0_0_15px_rgba(203,213,225,0.4)]">
              <Medal className="w-6 h-6 text-slate-300" />
            </div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">RUNNER UP · #2</span>
            <h3 className="text-lg font-black text-slate-100 truncate max-w-full mb-1">
              {second ? second.teamName : 'No Contestant'}
            </h3>
            {second && second.members.length > 0 && (
              <p className="text-[11px] text-slate-400 font-sans mb-3 line-clamp-1">
                {second.members.join(', ')}
              </p>
            )}
            <div className="w-full pt-3 border-t border-slate-800/80 flex items-center justify-around text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block">FINAL SCORE</span>
                <span className="text-slate-200 font-black text-sm">{second ? second.score : 0} PTS</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">SOLVES</span>
                <span className="text-emerald-400 font-bold">{second ? second.solvesCount : 0}</span>
              </div>
            </div>
            <div className="w-full pt-2 mt-2 border-t border-slate-800/60 text-[10px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1 text-slate-500">
                <Clock className="w-3 h-3 text-slate-400" />
                TIME:
              </span>
              <span className="font-mono text-slate-300 font-bold">{formatSolveTime(second?.lastSolveTime)}</span>
            </div>
          </div>

          {/* 1st Place: Gold (Center & Tallest) */}
          <div className="order-1 md:order-2 bg-gradient-to-b from-[#1a1505] to-[#0e1320] border-2 border-amber-400 rounded-2xl p-6 sm:p-7 shadow-[0_0_40px_rgba(251,191,36,0.35)] flex flex-col items-center relative scale-105 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500" />
            <div className="w-16 h-16 rounded-full bg-amber-400/25 border-2 border-amber-400 flex items-center justify-center text-amber-300 mb-2 shadow-[0_0_25px_rgba(251,191,36,0.6)] animate-pulse">
              <Crown className="w-9 h-9 text-amber-300" />
            </div>
            <span className="text-[11px] text-amber-400 font-extrabold uppercase tracking-widest mb-1 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              CHAMPION · #1
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-amber-300 truncate max-w-full mb-1">
              {first ? first.teamName : 'No Contestant'}
            </h3>
            {first && first.members.length > 0 && (
              <p className="text-xs text-amber-200/70 font-sans mb-3 line-clamp-1">
                {first.members.join(', ')}
              </p>
            )}
            <div className="w-full pt-3 border-t border-amber-500/30 flex items-center justify-around text-xs">
              <div>
                <span className="text-[10px] text-amber-400/60 block">FINAL SCORE</span>
                <span className="text-amber-300 font-black text-lg">{first ? first.score : 0} PTS</span>
              </div>
              <div>
                <span className="text-[10px] text-amber-400/60 block">SOLVES</span>
                <span className="text-emerald-400 font-extrabold text-base">{first ? first.solvesCount : 0}</span>
              </div>
            </div>
            <div className="w-full pt-2 mt-2 border-t border-amber-500/20 text-[10px] text-amber-400/80 flex items-center justify-between">
              <span className="flex items-center gap-1 text-amber-400/60">
                <Clock className="w-3 h-3 text-amber-400" />
                TIME:
              </span>
              <span className="font-mono text-amber-300 font-bold">{formatSolveTime(first?.lastSolveTime)}</span>
            </div>
          </div>

          {/* 3rd Place: Bronze (Right) */}
          <div className="order-3 bg-[#0e1320]/90 border border-amber-700/40 rounded-2xl p-5 shadow-[0_0_25px_rgba(217,119,6,0.15)] flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-700/60" />
            <div className="w-12 h-12 rounded-full bg-amber-800/20 border border-amber-600 flex items-center justify-center text-amber-500 mb-2 shadow-[0_0_15px_rgba(217,119,6,0.3)]">
              <Medal className="w-6 h-6 text-amber-500" />
            </div>
            <span className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mb-1">3RD PLACE · #3</span>
            <h3 className="text-lg font-black text-slate-100 truncate max-w-full mb-1">
              {third ? third.teamName : 'No Contestant'}
            </h3>
            {third && third.members.length > 0 && (
              <p className="text-[11px] text-slate-400 font-sans mb-3 line-clamp-1">
                {third.members.join(', ')}
              </p>
            )}
            <div className="w-full pt-3 border-t border-slate-800/80 flex items-center justify-around text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block">FINAL SCORE</span>
                <span className="text-amber-500 font-black text-sm">{third ? third.score : 0} PTS</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">SOLVES</span>
                <span className="text-emerald-400 font-bold">{third ? third.solvesCount : 0}</span>
              </div>
            </div>
            <div className="w-full pt-2 mt-2 border-t border-slate-800/60 text-[10px] text-amber-600/80 flex items-center justify-between">
              <span className="flex items-center gap-1 text-amber-600/60">
                <Clock className="w-3 h-3 text-amber-500" />
                TIME:
              </span>
              <span className="font-mono text-amber-400 font-bold">{formatSolveTime(third?.lastSolveTime)}</span>
            </div>
          </div>
        </div>

        {/* Action Button & 5-Second Auto-Redirect Alert */}
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-amber-400 bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/30 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {hasSubmittedFeedback ? (
                <>Redirecting to final leaderboard in <strong className="text-amber-300 font-black">{countdown}s</strong>...</>
              ) : (
                <>Redirecting to mandatory feedback in <strong className="text-amber-300 font-black">{countdown}s</strong>...</>
              )}
            </span>
          </div>

          <button
            onClick={() => {
              playCyberBlip(800);
              onViewDashboard();
            }}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black uppercase tracking-wider text-xs shadow-[0_0_25px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>
              {hasSubmittedFeedback
                ? `VIEW FINAL LEADERBOARD (${countdown}s)`
                : `CONTINUE TO FEEDBACK FORM (${countdown}s)`}
            </span>
            <ArrowRight className="w-4 h-4 text-black" />
          </button>
        </div>
      </div>
    </div>
  );
};
