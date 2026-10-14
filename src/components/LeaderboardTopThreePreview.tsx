import React, { useState, useEffect, useRef } from 'react';
import {
  Crown,
  Medal,
  Trophy,
  Users,
  Clock,
  ArrowRight,
  Sparkles,
  Lock,
  Flame,
} from 'lucide-react';
import type { LeaderboardEntry } from '../types.ts';
import { playCyberBlip } from '../utils/audio.ts';

interface LeaderboardTopThreePreviewProps {
  top3: LeaderboardEntry[];
  totalTeams: number;
  onProceedToFeedback: () => void;
}

export const LeaderboardTopThreePreview: React.FC<LeaderboardTopThreePreviewProps> = ({
  top3,
  totalTeams,
  onProceedToFeedback,
}) => {
  const [countdown, setCountdown] = useState<number>(6);
  const onProceedRef = useRef(onProceedToFeedback);
  onProceedRef.current = onProceedToFeedback;
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            onProceedRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  const formatSolveTime = (ts?: number) => {
    if (!ts) return 'Active';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleManualProceed = () => {
    if (!hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      try {
        playCyberBlip(800);
      } catch {}
      onProceedToFeedback();
    }
  };

  return (
    <div className="space-y-6 font-mono animate-fadeIn pb-12">
      {/* Top Banner Alert with Auto-Redirect Notice */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/90 via-[#181105] to-amber-950/90 border-2 border-amber-500/80 p-5 sm:p-7 text-center space-y-4 shadow-[0_0_40px_rgba(245,158,11,0.3)]">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[11px] font-bold uppercase tracking-wider">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>TOURNAMENT CONCLUDED: TOP 3 CHAMPIONS REVEALED</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight">
          TOP 3 CHAMPIONS ON THE LEADERBOARD
        </h2>

        <p className="text-xs sm:text-sm text-amber-200/90 font-sans max-w-2xl mx-auto leading-relaxed">
          Here are the official Top 3 champions across all {totalTeams} squads! To maintain platform integrity and unlock the complete final scoreboard and official writeups, every squad must submit the 1-time post-event feedback debrief.
        </p>

        {/* Live Auto-Redirect Countdown Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black/60 border border-amber-500/50 text-xs sm:text-sm text-amber-300 font-mono shadow-inner animate-pulse">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>
              Redirecting to feedback form in <strong className="text-white font-black">{countdown}s</strong>...
            </span>
          </div>

          <button
            onClick={handleManualProceed}
            className="w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black uppercase text-xs tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.5)] hover:shadow-[0_0_35px_rgba(245,158,11,0.8)] flex items-center justify-center gap-2 transition-all transform hover:scale-105 cursor-pointer"
          >
            <span>CONTINUE TO FEEDBACK FORM ({countdown}s)</span>
            <ArrowRight className="w-4 h-4 text-black" />
          </button>
        </div>
      </div>

      {/* 3-Tier Champions Podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end pt-2">
        {/* 2nd Place: Silver (Left) */}
        <div className="order-2 md:order-1 bg-[#0e1320]/95 border-2 border-slate-300/50 hover:border-slate-300 rounded-2xl p-5 shadow-[0_0_30px_rgba(203,213,225,0.2)] flex flex-col items-center relative overflow-hidden text-center transition-all">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          <div className="w-14 h-14 rounded-full bg-slate-400/20 border-2 border-slate-300 flex items-center justify-center text-slate-200 mb-2 shadow-[0_0_20px_rgba(203,213,225,0.5)]">
            <Medal className="w-7 h-7 text-slate-300" />
          </div>
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
            RUNNER UP · #2
          </span>
          <h3 className="text-lg font-black text-slate-100 truncate max-w-full mb-1">
            {second ? second.teamName : 'No Contestant'}
          </h3>
          {second && second.members.length > 0 && (
            <p className="text-[11px] text-slate-400 font-sans mb-3 line-clamp-1">
              {second.members.join(', ')}
            </p>
          )}
          <div className="w-full pt-3 border-t border-slate-800 flex items-center justify-around text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-sans">FINAL SCORE</span>
              <span className="text-slate-200 font-black text-sm">{second ? second.score : 0} PTS</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-sans">SOLVES</span>
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
        <div className="order-1 md:order-2 bg-gradient-to-b from-[#241a06] via-[#161105] to-[#0c0e18] border-2 border-amber-400 rounded-2xl p-6 sm:p-8 shadow-[0_0_55px_rgba(251,191,36,0.45)] scale-105 relative overflow-hidden text-center transition-all">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500" />
          <div className="relative mb-3">
            <div className="w-18 h-18 mx-auto rounded-full bg-gradient-to-tr from-amber-500/30 via-yellow-400/30 to-amber-500/40 border-2 border-amber-300 flex items-center justify-center text-amber-300 shadow-[0_0_35px_rgba(251,191,36,0.7)] animate-pulse">
              <Crown className="w-10 h-10 text-amber-300" />
            </div>
            <Sparkles className="w-4 h-4 text-amber-300 absolute -top-1 right-1/4 animate-bounce" />
          </div>

          <span className="text-xs text-amber-300 font-black uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            GRAND CHAMPION · #1
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-amber-200 truncate max-w-full mb-1 drop-shadow-md">
            {first ? first.teamName : 'No Contestant'}
          </h3>
          {first && first.members.length > 0 && (
            <p className="text-xs text-amber-200/80 font-sans mb-4 line-clamp-1">
              {first.members.join(', ')}
            </p>
          )}

          <div className="w-full pt-3.5 border-t border-amber-500/40 flex items-center justify-around text-xs">
            <div>
              <span className="text-[10px] text-amber-400/70 block uppercase font-sans">FINAL SCORE</span>
              <span className="text-amber-300 font-black text-xl">{first ? first.score : 0} PTS</span>
            </div>
            <div className="h-8 w-px bg-amber-500/30" />
            <div>
              <span className="text-[10px] text-amber-400/70 block uppercase font-sans">SOLVES</span>
              <span className="text-emerald-400 font-black text-xl">{first ? first.solvesCount : 0}</span>
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
        <div className="order-3 bg-[#0e1320]/95 border-2 border-amber-700/50 hover:border-amber-600 rounded-2xl p-5 shadow-[0_0_30px_rgba(217,119,6,0.2)] flex flex-col items-center relative overflow-hidden text-center transition-all">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-amber-700 to-transparent" />
          <div className="w-14 h-14 rounded-full bg-amber-800/25 border-2 border-amber-600 flex items-center justify-center text-amber-500 mb-2 shadow-[0_0_20px_rgba(217,119,6,0.4)]">
            <Medal className="w-7 h-7 text-amber-500" />
          </div>
          <span className="text-[10px] text-amber-600 font-extrabold uppercase tracking-widest mb-1">
            3RD PLACE · #3
          </span>
          <h3 className="text-lg font-black text-slate-100 truncate max-w-full mb-1">
            {third ? third.teamName : 'No Contestant'}
          </h3>
          {third && third.members.length > 0 && (
            <p className="text-[11px] text-slate-400 font-sans mb-3 line-clamp-1">
              {third.members.join(', ')}
            </p>
          )}
          <div className="w-full pt-3 border-t border-slate-800 flex items-center justify-around text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-sans">FINAL SCORE</span>
              <span className="text-amber-500 font-black text-sm">{third ? third.score : 0} PTS</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-sans">SOLVES</span>
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

      {/* Lock Notice Footer */}
      <div className="rounded-2xl bg-[#080d16]/90 border border-slate-800 p-5 text-center flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Full ranks #{4} to #{totalTeams} and challenge solution writeups will unlock immediately after feedback submission.</span>
        </div>
        <button
          onClick={handleManualProceed}
          className="px-5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
        >
          GO TO FEEDBACK FORM NOW →
        </button>
      </div>
    </div>
  );
};
