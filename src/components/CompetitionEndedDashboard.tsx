import React, { useState, useEffect } from 'react';
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
  Rocket,
  Zap,
} from 'lucide-react';
import type { LeaderboardEntry } from '../types.ts';
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
  onReplayRocketLaunch?: () => void;
}

export const CompetitionEndedDashboard: React.FC<CompetitionEndedDashboardProps> = ({
  leaderboard,
  currentTeam,
  writeupMode,
  onOpenWriteupPortal,
  onReplayRocketLaunch,
}) => {
  const [search, setSearch] = useState('');
  const [showConfetti, setShowConfetti] = useState(true);

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

  const getRankBadgeInfo = (rank: number) => {
    if (rank === 1) return { label: '👑 ARENA GRAND CHAMPION - 1ST PLACE', color: 'text-amber-300 border-amber-400 bg-amber-500/20' };
    if (rank === 2) return { label: '🥈 SILVER MEDALIST - 2ND PLACE', color: 'text-slate-200 border-slate-300 bg-slate-400/20' };
    if (rank === 3) return { label: '🥉 BRONZE MEDALIST - 3RD PLACE', color: 'text-amber-600 border-amber-600 bg-amber-700/20' };
    if (rank <= 10) return { label: '⭐ TOP 10 ELITE DECRYPTOR SQUAD', color: 'text-cyan-300 border-cyan-400 bg-cyan-500/20' };
    return { label: '🛡️ CERTIFIED TOURNAMENT OPERATOR', color: 'text-emerald-400 border-emerald-500/50 bg-emerald-500/20' };
  };

  return (
    <div className="relative space-y-8 font-mono animate-fadeIn pb-16 overflow-hidden">
      {/* Interactive Celebration Confetti & Sparkles Overlay */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          {Array.from({ length: 48 }).map((_, i) => {
            const left = (i * 2.1 + 0.5) % 100;
            const delay = (i % 8) * 0.45;
            const duration = (i % 5) * 1.2 + 4.5;
            const size = (i % 3) * 3 + 5;
            const colors = [
              '#f59e0b', // amber
              '#06b6d4', // cyan
              '#10b981', // emerald
              '#ec4899', // pink
              '#8b5cf6', // purple
              '#fbbf24', // yellow gold
              '#ffffff', // bright white
            ];
            const color = colors[i % colors.length];
            const shape = i % 3 === 0 ? 'rounded-full' : i % 3 === 1 ? 'rounded-sm rotate-45' : 'rounded-none rotate-12';

            return (
              <div
                key={i}
                className={`absolute ${shape} opacity-75`}
                style={{
                  left: `${left}%`,
                  top: '-20px',
                  width: `${size}px`,
                  height: `${size * 1.4}px`,
                  backgroundColor: color,
                  boxShadow: `0 0 10px ${color}`,
                  animation: `confettiFall ${duration}s linear infinite`,
                  animationDelay: `${delay}s`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Hero Banner: Competition Completed */}
      <div className="relative z-10 overflow-hidden rounded-3xl bg-gradient-to-b from-[#0e1424] via-[#090d18] to-[#04060c] border-2 border-amber-500/60 p-6 sm:p-10 shadow-[0_0_70px_rgba(245,158,11,0.3)] text-center">
        {/* Animated Top Golden Beam */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_25px_#f59e0b]" />

        {/* Dynamic Holographic Scanbeam Sweeper */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="hologram-sweep absolute inset-0 opacity-25" />
        </div>

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
          {/* Status Badge with Glowing Pulse */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/50 text-amber-300 text-xs font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>OFFICIAL TOURNAMENT CONCLUSION: ALL SUBMISSIONS LOCKED</span>
          </div>

          <h1 className="text-3xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-200 to-amber-500 tracking-tight uppercase drop-shadow-[0_0_35px_rgba(245,158,11,0.4)]">
            COMPETITION HAS ENDED
          </h1>

          <p className="text-amber-200/90 font-sans text-sm sm:text-base font-medium max-w-xl mx-auto leading-relaxed">
            Thank you for participating in The Final Decrypt! All flags, decryption submissions, and time-stamped tie-breakers have been evaluated with cryptographic precision.
          </p>

          {/* Quick Stats Grid with Neon Accents */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 max-w-lg mx-auto">
            <div className="bg-[#0b0f1a]/90 border border-slate-800 hover:border-cyan-500/40 rounded-xl p-3 shadow-lg transition-all hover:scale-105">
              <span className="text-[10px] text-slate-400 uppercase block font-sans">Total Squads</span>
              <span className="text-xl font-black text-white">{leaderboard.length}</span>
            </div>
            <div className="bg-[#0b0f1a]/90 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-3 shadow-lg transition-all hover:scale-105">
              <span className="text-[10px] text-slate-400 uppercase block font-sans">Total Decryptions</span>
              <span className="text-xl font-black text-emerald-400">{totalSolves}</span>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-[#0b0f1a]/90 border border-slate-800 hover:border-amber-500/40 rounded-xl p-3 shadow-lg transition-all hover:scale-105">
              <span className="text-[10px] text-slate-400 uppercase block font-sans">Points Scored</span>
              <span className="text-xl font-black text-amber-400">{totalPoints} PTS</span>
            </div>
          </div>

          {/* Action Row: Replay Rocket Launch & Solution Writeups */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            {onReplayRocketLaunch && (
              <button
                onClick={() => {
                  playCyberBlip(900);
                  onReplayRocketLaunch();
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/25 to-amber-500/20 hover:from-amber-500/35 hover:to-orange-500/35 text-amber-300 border border-amber-500/50 hover:border-amber-400 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] cursor-pointer group"
              >
                <Rocket className="w-4 h-4 text-amber-400 group-hover:-translate-y-0.5 transition-transform" />
                <span>REPLAY ROCKET LAUNCH CEREMONY</span>
              </button>
            )}

            {writeupMode && onOpenWriteupPortal && (
              <button
                onClick={() => {
                  playCyberBlip(800);
                  onOpenWriteupPortal();
                }}
                className="px-5 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-cyan-400" />
                <span>OFFICIAL CHALLENGE WRITEUPS UNLOCKED</span>
              </button>
            )}

            <button
              onClick={() => setShowConfetti(!showConfetti)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
              title="Toggle Confetti Animation"
            >
              {showConfetti ? '✨ CELEBRATION FX: ON' : '✨ CELEBRATION FX: OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Logged-In User Squad Final Report Card */}
      {userRankEntry && currentTeam && (
        <div className="relative z-10 rounded-2xl bg-gradient-to-r from-[#0d1627] via-[#0b1220] to-[#080d18] border-2 border-cyan-500/70 p-5 sm:p-7 shadow-[0_0_40px_rgba(6,182,212,0.3)] flex flex-col sm:flex-row items-center justify-between gap-5 overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600/30 via-cyan-500/20 to-blue-600/30 border-2 border-cyan-400 flex flex-col items-center justify-center text-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.5)] animate-pulse shrink-0">
              <span className="text-[9px] text-cyan-400/80 font-bold tracking-widest">RANK</span>
              <span className="text-2xl font-black">#{userRankEntry.rank}</span>
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider shrink-0" style={{}}>
                {(() => {
                  const badge = getRankBadgeInfo(userRankEntry.rank);
                  return (
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.color}`}>
                      {badge.label}
                    </span>
                  );
                })()}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">{currentTeam.teamName}</h2>
              <p className="text-xs text-slate-400 font-sans flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>{currentTeam.members.join(', ')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 bg-[#060a12]/90 px-6 py-3.5 rounded-xl border border-slate-800 text-center relative z-10 shadow-inner">
            <div>
              <span className="text-[10px] text-slate-400 block font-sans uppercase">FINAL SCORE</span>
              <span className="text-xl font-black text-amber-300">{userRankEntry.score} PTS</span>
            </div>
            <div className="h-9 w-px bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400 block font-sans uppercase">SOLVES</span>
              <span className="text-xl font-black text-emerald-400">{userRankEntry.solvesCount} / 20</span>
            </div>
          </div>
        </div>
      )}

      {/* TOP 3 CHAMPIONS PODIUM SECTION */}
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">
              TOURNAMENT PODIUM: TOP 3 CHAMPIONS
            </h2>
          </div>
          <span className="text-xs text-amber-400/90 font-bold uppercase tracking-wider bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
            ★ VERIFIED RANKS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end">
          {/* 2nd Place: Silver (Left) */}
          <div className="order-2 md:order-1 bg-gradient-to-b from-[#101524] to-[#0a0e18] border border-slate-300/50 hover:border-slate-300 rounded-2xl p-5 shadow-[0_0_30px_rgba(203,213,225,0.2)] hover:shadow-[0_0_40px_rgba(203,213,225,0.35)] transition-all hover:-translate-y-1 flex flex-col items-center relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
            <div className="w-14 h-14 rounded-full bg-slate-400/20 border-2 border-slate-300 flex items-center justify-center text-slate-200 mb-2 shadow-[0_0_20px_rgba(203,213,225,0.5)]">
              <Medal className="w-7 h-7 text-slate-300" />
            </div>
            <span className="text-[10px] text-slate-300 font-extrabold uppercase tracking-widest mb-1">
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
          <div className="order-1 md:order-2 bg-gradient-to-b from-[#241a06] via-[#161105] to-[#0c0e18] border-2 border-amber-400 rounded-2xl p-6 sm:p-8 shadow-[0_0_55px_rgba(251,191,36,0.45)] hover:shadow-[0_0_75px_rgba(251,191,36,0.6)] transition-all scale-105 hover:scale-108 relative overflow-hidden text-center">
            {/* Radiant Spotlight Beam */}
            <div className="absolute -top-10 left-1/4 right-1/4 h-40 bg-gradient-to-b from-amber-400/25 via-amber-300/10 to-transparent blur-xl pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500" />
            
            {/* Crown with Floating Sparkles */}
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
          </div>

          {/* 3rd Place: Bronze (Right) */}
          <div className="order-3 bg-gradient-to-b from-[#181109] to-[#0a0e18] border border-amber-700/50 hover:border-amber-600 rounded-2xl p-5 shadow-[0_0_30px_rgba(217,119,6,0.2)] hover:shadow-[0_0_40px_rgba(217,119,6,0.35)] transition-all hover:-translate-y-1 flex flex-col items-center relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-amber-700 to-transparent" />
            <div className="w-14 h-14 rounded-full bg-amber-800/25 border-2 border-amber-600 flex items-center justify-center text-amber-500 mb-2 shadow-[0_0_20px_rgba(217,119,6,0.4)]">
              <Medal className="w-7 h-7 text-amber-500" />
            </div>
            <span className="text-[10px] text-amber-500 font-extrabold uppercase tracking-widest mb-1">
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
      <div className="relative z-10 rounded-2xl bg-[#0a0e17]/95 border border-slate-800 p-5 sm:p-6 space-y-4 shadow-[0_10px_35px_rgba(0,0,0,0.7)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Medal className="w-4 h-4 text-amber-400" />
              COMPLETE OFFICIAL FINAL STANDINGS
            </h3>
            <p className="text-xs text-slate-400 font-sans">
              All scores certified with zero-bias tie-breakers (Highest Score → Earliest Timestamp → Fewer Incorrect Attempts → Fewest Hints Unlocked).
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search squad or operator..."
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
                <th className="py-3 px-3 hidden md:table-cell">Operators</th>
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
                    className={`transition-all ${
                      isUserTeam
                        ? 'bg-cyan-950/40 border-l-4 border-cyan-400 shadow-md'
                        : entry.rank === 1
                        ? 'bg-amber-950/20 hover:bg-amber-950/30'
                        : entry.rank === 2
                        ? 'bg-slate-800/25 hover:bg-slate-800/35'
                        : entry.rank === 3
                        ? 'bg-amber-900/15 hover:bg-amber-900/25'
                        : 'hover:bg-slate-900/60'
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
                          <span className="px-2 py-0.5 rounded text-[9px] bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                            YOUR SQUAD
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

      {/* Embedded CSS for Confetti & Hologram Sweeper Animations */}
      <style>{`
        @keyframes confettiFall {
          0% {
            transform: translateY(-20px) rotate(0deg) rotateX(0deg);
            opacity: 1;
          }
          50% {
            transform: translateY(50vh) rotate(180deg) rotateX(180deg);
            opacity: 0.85;
          }
          100% {
            transform: translateY(105vh) rotate(360deg) rotateX(360deg);
            opacity: 0;
          }
        }

        .hologram-sweep {
          background: linear-gradient(
            115deg,
            transparent 0%,
            transparent 35%,
            rgba(245, 158, 11, 0.15) 45%,
            rgba(6, 182, 212, 0.25) 50%,
            rgba(245, 158, 11, 0.15) 55%,
            transparent 65%,
            transparent 100%
          );
          background-size: 200% 200%;
          animation: scanbeamMove 4.5s ease-in-out infinite;
        }

        @keyframes scanbeamMove {
          0% { background-position: -150% -150%; }
          50% { background-position: 150% 150%; }
          100% { background-position: -150% -150%; }
        }
      `}</style>
    </div>
  );
};
