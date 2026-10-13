import React, { useState } from 'react';
import {
  Trophy,
  Medal,
  Clock,
  AlertTriangle,
  Search,
  Users,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Radio,
  UserPlus,
  RefreshCw,
  Layers,
  Crown,
  Zap,
} from 'lucide-react';
import type { LeaderboardEntry } from '../types.ts';
import { playCyberBlip, playSuccessChime } from '../utils/audio.ts';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentTeamId?: string;
  hasDemoTeams?: boolean;
  isAdmin?: boolean;
  onToggleDemoMode?: (mode: 'clean' | 'seed') => void;
  onOpenAuthModal?: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  entries,
  currentTeamId,
  hasDemoTeams,
  isAdmin,
  onToggleDemoMode,
  onOpenAuthModal,
}) => {
  const [search, setSearch] = useState('');
  const [showTieBreakerExplainer, setShowTieBreakerExplainer] = useState(false);
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);

  const filtered = entries.filter((e) =>
    e.teamName.toLowerCase().includes(search.toLowerCase()) ||
    e.members.some((m) => m.toLowerCase().includes(search.toLowerCase()))
  );

  const formatLastSolve = (ts: number) => {
    if (!ts || ts === 0) return '—';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleModeToggle = async (mode: 'clean' | 'seed') => {
    playCyberBlip(800);
    setIsUpdatingMode(true);
    try {
      if (onToggleDemoMode) {
        await onToggleDemoMode(mode);
      } else {
        await fetch('/api/scoreboard/mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        });
      }
      playSuccessChime();
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdatingMode(false);
    }
  };

  const getRankBadge = (rank: number, score: number = 0) => {
    if (score === 0) {
      return (
        <span className="font-mono text-xs font-semibold text-slate-500 w-8 text-center" title="Not participated yet (0 points)">
          #{rank}
        </span>
      );
    }
    switch (rank) {
      case 1:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/30 to-amber-600/20 text-amber-300 border border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.45)]" title="1st Place Champion">
            <Crown className="w-4 h-4 text-amber-300" />
          </div>
        );
      case 2:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-400/20 text-slate-200 border border-slate-300 shadow-[0_0_12px_rgba(203,213,225,0.3)]" title="2nd Place">
            <Medal className="w-4 h-4 text-slate-200" />
          </div>
        );
      case 3:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-700/20 text-amber-400 border border-amber-600 shadow-[0_0_10px_rgba(217,119,6,0.25)]" title="3rd Place">
            <Medal className="w-4 h-4 text-amber-500" />
          </div>
        );
      default:
        return (
          <span className="font-mono text-xs font-black text-slate-400 w-8 text-center">
            #{rank}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-[#0d111a]/90 backdrop-blur-xl border border-emerald-500/30 p-5 sm:p-7 shadow-[0_0_30px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(0,255,102,0.04)] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00ff66] to-transparent opacity-80" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#00ff66] font-bold">
              <Trophy className="w-4 h-4" />
              <span>DEFENSE INTELLIGENCE // LIVE OPERATOR STANDINGS</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-mono text-white mt-1.5 tracking-wide flex items-center gap-2">
              <span>SCOREBOARD & RANKINGS</span>
              <span className="text-xs font-mono font-bold text-[#00ff66] bg-[#00ff66]/10 px-2 py-0.5 rounded border border-[#00ff66]/30">
                REAL-TIME SYNC
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-sans mt-1 max-w-2xl leading-relaxed">
              Live standings computed with automated tie-breaker telemetry. Ties are decided by earliest solve timestamp and fewest incorrect submissions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Demo / Live Mode Controls (Admin Exclusive) */}
            {isAdmin && (
              hasDemoTeams ? (
                <button
                  onClick={() => handleModeToggle('clean')}
                  disabled={isUpdatingMode}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono font-bold flex items-center gap-2 transition-all hover:border-[#00ff66]/40"
                  title="Remove sample teams to show only registered teams"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isUpdatingMode ? 'UPDATING...' : 'CLEAR PREVIEW TEAMS'}</span>
                </button>
              ) : (
                <button
                  onClick={() => handleModeToggle('seed')}
                  disabled={isUpdatingMode}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono font-bold flex items-center gap-2 transition-all hover:border-[#00ff66]/40"
                  title="Load sample teams for testing"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isUpdatingMode ? 'LOADING...' : 'LOAD PREVIEW TEAMS'}</span>
                </button>
              )
            )}

            <button
              onClick={() => setShowTieBreakerExplainer(!showTieBreakerExplainer)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-300 flex items-center gap-2 border border-slate-700 transition-all hover:border-cyan-400"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#00f0ff]" />
              <span>TIE-BREAKER LOGIC</span>
            </button>
          </div>
        </div>

        {/* Status Callout Banner */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${hasDemoTeams ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-[#00ff66] shadow-[0_0_8px_#00ff66]'}`} />
            <span className="text-slate-300 font-bold">
              {hasDemoTeams
                ? 'MODE: PREVIEW TEAMS ACTIVE (SIMULATED ARENA)'
                : 'MODE: LIVE TOURNAMENT ARENA (ONLY REGISTERED TEAMS)'}
            </span>
          </div>

          <div className="text-slate-400 flex items-center gap-2 text-[11px]">
            <span>REGISTERED TEAMS: <strong className="text-white font-bold">{entries.length}</strong></span>
            <span>·</span>
            <span className="text-emerald-400 font-bold">STATUS: TELEMETRY VERIFIED</span>
          </div>
        </div>

        {/* Tie-breaker modal / popout */}
        {showTieBreakerExplainer && (
          <div className="mt-4 p-4 rounded-xl bg-[#080b12] border border-[#00f0ff]/50 text-xs font-mono text-slate-300 space-y-2 animate-fadeIn shadow-[0_0_20px_rgba(0,240,255,0.15)]">
            <div className="text-[#00f0ff] font-black flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00f0ff]" />
              <span>TIE-BREAKER ALGORITHM HIERARCHY:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pl-1 leading-relaxed">
              <li><strong className="text-white">Primary Metric:</strong> Total accumulated points from valid flag decryptions.</li>
              <li><strong className="text-white">Tie-Breaker Level 1:</strong> Earliest recorded UTC timestamp reaching that exact score.</li>
              <li><strong className="text-white">Tie-Breaker Level 2:</strong> Lowest cumulative incorrect submission attempts across all challenges.</li>
              <li><strong className="text-white">Disqualification Condition:</strong> Teams disqualified upon Administrator Arbitration review are positioned at the base of the board.</li>
            </ol>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl bg-[#0d111a]/85 backdrop-blur-md border border-slate-800 p-4 shadow-lg">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leaderboard by team name or operator handle..."
            className="w-full bg-[#080b12] border border-slate-700 focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono text-white placeholder-slate-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Scoreboard Table */}
      <div className="rounded-2xl bg-[#0d111a]/85 backdrop-blur-md border border-slate-800 overflow-hidden shadow-2xl">
        {/* Mobile Swipe Guidance Banner */}
        <div className="sm:hidden px-4 py-1.5 bg-slate-900/80 border-b border-slate-800 text-[10px] text-slate-400 font-mono flex items-center justify-between">
          <span className="text-[#00ff66]">← SWIPE TABLE TO VIEW COLUMNS →</span>
          <span>{filtered.length} TEAMS</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono min-w-[680px]">
            <thead>
              <tr className="bg-[#080b12] border-b border-slate-800 text-slate-400">
                <th className="py-3.5 px-4 w-20 text-center font-bold">RANK</th>
                <th className="py-3.5 px-4 font-bold">TEAM // OPERATOR CREW</th>
                <th className="py-3.5 px-4 text-center font-bold">SOLVES</th>
                <th className="py-3.5 px-4 text-center font-bold">INCORRECT</th>
                <th className="py-3.5 px-4 text-center font-bold">LAST SOLVE (UTC)</th>
                <th className="py-3.5 px-4 text-right font-bold">SCORE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((entry) => {
                const isCurrentTeam = currentTeamId === entry.teamId;

                return (
                  <tr
                    key={entry.teamId}
                    className={`transition-all ${
                      isCurrentTeam
                        ? 'bg-emerald-950/25 border-l-4 border-l-[#00ff66] shadow-[inset_0_0_15px_rgba(0,255,102,0.1)]'
                        : 'hover:bg-slate-800/35'
                    }`}
                  >
                    <td className="py-4 px-4 text-center">
                      <div className="flex justify-center">
                        {getRankBadge(entry.rank, entry.score)}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-sm sm:text-base ${entry.isDisqualified ? 'text-red-400 line-through opacity-70' : entry.rank === 1 && entry.score > 0 ? 'text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'text-white'}`}>
                          {entry.teamName}
                        </span>

                        {entry.rank === 1 && entry.score > 0 && (
                          <span className="text-[10px] font-black text-amber-950 bg-gradient-to-r from-amber-400 to-amber-300 px-2 py-0.5 rounded shadow-[0_0_12px_rgba(251,191,36,0.6)] flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-950" />
                            <span>1ST PLACE</span>
                          </span>
                        )}

                        {entry.isDisqualified && (
                          <span className="text-[10px] font-black text-red-300 bg-red-950 px-2 py-0.5 rounded border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)] flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                            <span>DISQUALIFIED</span>
                          </span>
                        )}

                        {!entry.isDisqualified && entry.score < 0 && (
                          <span
                            className="text-[10px] font-bold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/60 flex items-center gap-1 shadow-[0_0_8px_rgba(244,63,94,0.3)]"
                            title="Score is negative due to hint point deductions"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                            <span>HINT DEDUCTION ({entry.score} PTS)</span>
                          </span>
                        )}

                        {!entry.isDisqualified && entry.score === 0 && (
                          <span
                            className="text-[10px] font-bold text-slate-300 bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1"
                            title="Logged in competitor awaiting first flag solve"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            <span>{entry.totalFailedAttempts > 0 ? 'PARTICIPATING (0 PTS)' : 'LOGGED IN · 0 PTS'}</span>
                          </span>
                        )}

                        {!entry.isDisqualified && entry.strikes > 0 && (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-600/50">
                            {entry.strikes}/10 STRIKES
                          </span>
                        )}

                        {isCurrentTeam && (
                          <span className="text-[10px] font-black text-black bg-[#00ff66] px-2 py-0.5 rounded shadow-[0_0_10px_rgba(0,255,102,0.5)]">
                            YOUR TEAM
                          </span>
                        )}

                        {entry.isFlaggedAnomaly && (
                          <span
                            className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/40 flex items-center gap-1"
                            title="Under review by automated velocity anomaly detection"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>REVIEW</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>{entry.members.join(', ')}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${entry.solvesCount > 0 ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-bold' : 'bg-slate-900/40 border border-slate-800 text-slate-500'}`}>
                        <CheckCircle className={`w-3.5 h-3.5 ${entry.solvesCount > 0 ? 'text-[#00ff66]' : 'text-slate-600'}`} />
                        <span>{entry.solvesCount}</span>
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center text-slate-400">
                      <span className={`font-mono ${entry.totalFailedAttempts > 4 ? 'text-amber-400 font-bold' : ''}`}>
                        {entry.totalFailedAttempts}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{formatLastSolve(entry.lastSolveTime)}</span>
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Zap className={`w-3.5 h-3.5 ${entry.score > 0 ? 'text-[#00ff66]' : entry.score < 0 ? 'text-rose-500' : 'text-slate-600'}`} />
                        <span className={`text-base sm:text-lg font-black tracking-wider ${entry.score > 0 ? 'text-[#00ff66] drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]' : entry.score < 0 ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'text-slate-500'}`}>
                          {entry.score}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-0.5">PTS</span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-50 animate-pulse" />
                    <p className="font-bold text-base text-slate-200">No teams currently registered in the competition.</p>
                    <p className="text-xs text-slate-500 mt-1 mb-5">
                      Register your team to take 1st place, or load demo teams for simulated preview.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      {onOpenAuthModal && (
                        <button
                          onClick={onOpenAuthModal}
                          className="px-5 py-2.5 rounded-xl bg-[#00ff66] text-black font-black text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(0,255,102,0.4)] hover:shadow-[0_0_30px_rgba(0,255,102,0.6)] transition-all"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>REGISTER FIRST TEAM</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleModeToggle('seed')}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-colors"
                      >
                        Load Preview Competitors
                      </button>
                    </div>
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
