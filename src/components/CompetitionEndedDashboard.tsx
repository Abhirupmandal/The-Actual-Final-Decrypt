import React, { useState } from 'react';
import {
  Trophy,
  Crown,
  Medal,
  Users,
  CheckCircle2,
  Sparkles,
  Search,
  ShieldCheck,
  BookOpen,
  ArrowRight,
  Flame,
  Award,
  Hash,
  Clock,
  Layers,
} from 'lucide-react';
import type { LeaderboardEntry, Team } from '../types.ts';
import { playCyberBlip } from '../utils/audio.ts';

interface CompetitionEndedDashboardProps {
  leaderboard: LeaderboardEntry[];
  currentTeam?: {
    id: string;
    teamName: string;
    members: string[];
    score: number;
    strikes?: number;
    isDisqualified?: boolean;
  } | null;
  writeupMode: boolean;
  onOpenWriteupPortal?: () => void;
}

export const CompetitionEndedDashboard: React.FC<CompetitionEndedDashboardProps> = ({
  leaderboard,
  currentTeam,
  writeupMode,
  onOpenWriteupPortal,
}) => {
  const [search, setSearch] = useState('');

  const top3 = leaderboard.slice(0, 3);
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  // User's team placement
  const userRankEntry = currentTeam
    ? leaderboard.find((e) => e.teamId === currentTeam.id)
    : null;

  const totalSolves = leaderboard.reduce((acc, t) => acc + (t.solvesCount || 0), 0);
  const totalPoints = leaderboard.reduce((acc, t) => acc + (t.score || 0), 0);

  const filteredLeaderboard = leaderboard.filter(
    (e) =>
      e.teamName.toLowerCase().includes(search.toLowerCase()) ||
      e.members.some((m) => m.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-8 font-mono animate-fadeIn pb-12">
      {/* Hero Banner: Competition Completed */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#0e1424] via-[#090d18] to-[#04060c] border-2 border-amber-500/50 p-6 sm:p-10 shadow-[0_0_60px_rgba(245,158,11,0.25)] text-center">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_20px_#f59e0b]" />

        {/* Decorative background grid */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#00f0ff 1px, transparent 1px), linear-gradient(90deg, #00f0ff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(245,158,11,0.25)]">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>OFFICIAL TOURNAMENT CONCLUSION // ALL SUBMISSIONS LOCKED</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase drop-shadow-md">
            COMPETITION HAS ENDED
          </h1>

          <p className="text-amber-300/90 font-sans text-sm sm:text-base font-medium max-w-xl mx-auto">
            Thank you for participating in The Final Decrypt! All flags and score penalties have been verified with unbiased evaluation.
          </p>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 max-w-lg mx-auto">
            <div className="bg-[#0b0f1a]/80 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase block font-sans">Total Squads</span>
              <span className="text-lg font-black text-white">{leaderboard.length}</span>
            </div>
            <div className="bg-[#0b0f1a]/80 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase block font-sans">Total Decryptions</span>
              <span className="text-lg font-black text-emerald-400">{totalSolves}</span>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-[#0b0f1a]/80 border border-slate-800 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase block font-sans">Points Scored</span>
              <span className="text-lg font-black text-amber-400">{totalPoints} PTS</span>
            </div>
          </div>

          {/* Writeup Mode Banner if unlocked */}
          {writeupMode && onOpenWriteupPortal && (
            <div className="pt-2">
              <button
                onClick={() => {
                  playCyberBlip(800);
                  onOpenWriteupPortal();
                }}
                className="px-6 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 mx-auto transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-cyan-400" />
                <span>OFFICIAL CHALLENGE SOLUTIONS UNLOCKED — VIEW WRITEUPS</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Logged-In User Squad Final Report Card */}
      {userRankEntry && currentTeam && (
        <div className="rounded-2xl bg-gradient-to-r from-[#0d1627] via-[#0b1220] to-[#080d18] border-2 border-cyan-500/60 p-5 sm:p-6 shadow-[0_0_35px_rgba(6,182,212,0.25)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              <span className="text-xl font-black">#{userRankEntry.rank}</span>
            </div>
            <div>
              <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>YOUR SQUAD FINAL STANDINGS</span>
              </div>
              <h2 className="text-xl font-black text-white">{currentTeam.teamName}</h2>
              <p className="text-xs text-slate-400 font-sans">{currentTeam.members.join(', ')}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 bg-[#060a12]/80 px-6 py-3 rounded-xl border border-slate-800 text-center">
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">FINAL SCORE</span>
              <span className="text-lg font-black text-amber-300">{userRankEntry.score} PTS</span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">SOLVES</span>
              <span className="text-lg font-black text-emerald-400">{userRankEntry.solvesCount} / 20</span>
            </div>
          </div>
        </div>
      )}

      {/* TOP 3 CHAMPIONS PODIUM SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-black text-white uppercase tracking-wider">
              TOURNAMENT PODIUM // TOP 3 SQUADS
            </h2>
          </div>
          <span className="text-xs text-amber-400/80 font-bold">VERIFIED RANKS</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end">
          {/* 2nd Place: Silver (Left) */}
          <div className="order-2 md:order-1 bg-[#0d121e]/90 border border-slate-300/40 rounded-2xl p-5 shadow-[0_0_25px_rgba(203,213,225,0.15)] flex flex-col items-center relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-300/60" />
            <div className="w-12 h-12 rounded-full bg-slate-400/20 border border-slate-300 flex items-center justify-center text-slate-200 mb-2 shadow-[0_0_15px_rgba(203,213,225,0.4)]">
              <Medal className="w-6 h-6 text-slate-300" />
            </div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
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
          </div>

          {/* 1st Place: Gold (Center & Tallest) */}
          <div className="order-1 md:order-2 bg-gradient-to-b from-[#1b1506] to-[#0e1422] border-2 border-amber-400 rounded-2xl p-6 sm:p-7 shadow-[0_0_40px_rgba(251,191,36,0.35)] flex flex-col items-center relative scale-105 overflow-hidden text-center">
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
          </div>

          {/* 3rd Place: Bronze (Right) */}
          <div className="order-3 bg-[#0d121e]/90 border border-amber-700/40 rounded-2xl p-5 shadow-[0_0_25px_rgba(217,119,6,0.15)] flex flex-col items-center relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-700/60" />
            <div className="w-12 h-12 rounded-full bg-amber-800/20 border border-amber-600 flex items-center justify-center text-amber-500 mb-2 shadow-[0_0_15px_rgba(217,119,6,0.3)]">
              <Medal className="w-6 h-6 text-amber-500" />
            </div>
            <span className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mb-1">
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
          </div>
        </div>
      </div>

      {/* COMPLETE FINAL LEADERBOARD TABLE */}
      <div className="rounded-2xl bg-[#0a0e17] border border-slate-800 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Medal className="w-4 h-4 text-amber-400" />
              COMPLETE OFFICIAL FINAL STANDINGS
            </h3>
            <p className="text-xs text-slate-400 font-sans">
              All scores certified with zero-bias tie-breakers (Highest Score $\rightarrow$ Earliest Timestamp $\rightarrow$ Fewer Incorrect Attempts).
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team or member..."
              className="w-full bg-[#050811] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                <th className="py-3 px-3 w-16">Rank</th>
                <th className="py-3 px-3">Squad Name</th>
                <th className="py-3 px-3 hidden md:table-cell">Members</th>
                <th className="py-3 px-3 text-center">Solves</th>
                <th className="py-3 px-3 text-right">Final Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLeaderboard.map((entry) => {
                const isUserTeam = currentTeam && currentTeam.id === entry.teamId;

                return (
                  <tr
                    key={entry.teamId}
                    className={`transition-colors ${
                      isUserTeam
                        ? 'bg-cyan-950/30 border-l-2 border-cyan-400'
                        : entry.rank === 1
                        ? 'bg-amber-950/15'
                        : entry.rank === 2
                        ? 'bg-slate-800/20'
                        : entry.rank === 3
                        ? 'bg-amber-900/10'
                        : 'hover:bg-slate-900/40'
                    }`}
                  >
                    <td className="py-3 px-3 font-bold">
                      {entry.rank === 1 ? (
                        <span className="text-amber-400 flex items-center gap-1 font-extrabold">
                          <Crown className="w-3.5 h-3.5" /> #1
                        </span>
                      ) : entry.rank === 2 ? (
                        <span className="text-slate-300 flex items-center gap-1 font-extrabold">
                          <Medal className="w-3.5 h-3.5" /> #2
                        </span>
                      ) : entry.rank === 3 ? (
                        <span className="text-amber-600 flex items-center gap-1 font-extrabold">
                          <Medal className="w-3.5 h-3.5" /> #3
                        </span>
                      ) : (
                        <span className="text-slate-500">#{entry.rank}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-bold text-white">
                      <div className="flex items-center gap-2">
                        <span>{entry.teamName}</span>
                        {isUserTeam && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-sans text-xs hidden md:table-cell">
                      {entry.members.join(', ')}
                    </td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">
                      {entry.solvesCount} / 20
                    </td>
                    <td className="py-3 px-3 text-right font-black text-amber-300 text-sm">
                      {entry.score} PTS
                    </td>
                  </tr>
                );
              })}

              {filteredLeaderboard.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans text-xs">
                    No squads matched search query "{search}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
