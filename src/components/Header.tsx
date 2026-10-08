import React, { useState } from 'react';
import {
  Shield,
  Clock,
  Trophy,
  Terminal,
  Volume2,
  VolumeX,
  Lock,
  UserCheck,
  LogOut,
  ChevronDown,
  Radio,
  BookOpen,
  Activity,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import type { CompetitionState, LeaderboardEntry } from '../types.ts';
import { playCyberBlip, setAudioMuted } from '../utils/audio.ts';

interface HeaderProps {
  currentTab: 'challenges' | 'leaderboard' | 'activity' | 'admin';
  setCurrentTab: (tab: 'challenges' | 'leaderboard' | 'activity' | 'admin') => void;
  competitionState: CompetitionState;
  team: {
    id: string;
    teamName: string;
    members: string[];
    score: number;
    strikes?: number;
    isDisqualified?: boolean;
  } | null;
  leaderboard: LeaderboardEntry[];
  onOpenAuthModal: () => void;
  onLogoutTeam: () => void;
  onOpenAdminAuth: () => void;
  isAdminAuthenticated: boolean;
  isConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  competitionState,
  team,
  leaderboard,
  onOpenAuthModal,
  onLogoutTeam,
  onOpenAdminAuth,
  isAdminAuthenticated,
  isConnected,
}) => {
  const [muted, setMutedState] = useState(false);
  const [showTeamMenu, setShowTeamMenu] = useState(false);

  const toggleSound = () => {
    const next = !muted;
    setMutedState(next);
    setAudioMuted(next);
    if (!next) playCyberBlip(1000);
  };

  const handleTabClick = (tab: 'challenges' | 'leaderboard' | 'activity' | 'admin') => {
    playCyberBlip(750);
    if (tab === 'admin' && !isAdminAuthenticated) {
      onOpenAdminAuth();
      return;
    }
    setCurrentTab(tab);
  };

  // Format seconds to HH:MM:SS
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Find team's rank
  const teamRank = team
    ? leaderboard.find((l) => l.teamId === team.id)?.rank || '-'
    : null;

  const currentStrikes = team?.strikes || 0;
  const isDisqualified = Boolean(team?.isDisqualified || currentStrikes >= 5);

  const getStrikeBadge = () => {
    if (isDisqualified) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/90 text-red-400 border border-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.5)] flex items-center gap-1 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-red-400" />
          <span>[DISQUALIFIED]</span>
        </span>
      );
    }
    if (currentStrikes >= 3) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/70 text-red-400 border border-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.3)] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          <span>STRIKES: {currentStrikes}/5 [CRITICAL]</span>
        </span>
      );
    }
    if (currentStrikes > 0) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/70 text-amber-300 border border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.25)] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>STRIKES: {currentStrikes}/5 [ELEVATED]</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/60 text-[#00ff66] border border-emerald-500/40 shadow-[0_0_8px_rgba(0,255,102,0.15)] flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66]" />
        <span>STRIKES: 0/5 [NOMINAL]</span>
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-[#07090e]/95 backdrop-blur-xl border-b border-[#00ff66]/25 shadow-[0_4px_30px_rgba(0,0,0,0.85)]">
      {/* Top Cyber Command Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20 gap-2 sm:gap-4">
          {/* Neon Glow Branding */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-[#0d111a] border border-[#00ff66]/60 text-[#00ff66] shadow-[0_0_18px_rgba(0,255,102,0.35)] shrink-0 group">
              <Terminal className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:scale-110" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#00ff66] animate-ping opacity-80" />
              <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 rounded-full bg-[#00f0ff]" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-sm sm:text-base md:text-lg tracking-wider text-white flex items-center gap-1.5 drop-shadow-[0_0_10px_rgba(0,255,102,0.5)]">
                  <span className="text-[#00ff66] animate-pulse">&gt;</span>
                  <span>THE FINAL DECRYPTERS</span>
                </span>
                <span className="hidden sm:inline-block text-[10px] font-mono tracking-widest text-[#00f0ff] border border-[#00f0ff]/40 px-2 py-0.5 rounded-md bg-[#00f0ff]/10 shadow-[0_0_8px_rgba(0,240,255,0.2)] font-semibold">
                  ROUND 2: NO CLUE, NO MERCY
                </span>
              </div>

              {/* Live Telemetry Bar */}
              <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-mono text-slate-400 mt-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#00ff66] shadow-[0_0_8px_#00ff66] animate-pulse' : 'bg-red-500 shadow-[0_0_8px_#ff3366]'}`} />
                  <span className={isConnected ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {isConnected ? 'WS: CONNECTED' : 'WS: RECONNECTING'}
                  </span>
                </div>
                <span className="text-slate-600">|</span>
                <span className="hidden md:inline-flex items-center gap-1 text-slate-400">
                  <Activity className="w-3 h-3 text-[#00f0ff]" />
                  <span>DEFENSE TELEMETRY LIVE</span>
                </span>
                {team && (
                  <>
                    <span className="hidden sm:inline text-slate-600">|</span>
                    <div className="hidden sm:inline-flex">
                      {getStrikeBadge()}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Central Live Synced Timer */}
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-xl bg-[#0d111a]/90 border border-emerald-500/40 shadow-[0_0_20px_rgba(0,255,102,0.1),inset_0_0_12px_rgba(0,255,102,0.05)] backdrop-blur-md">
            <div className="relative">
              <Clock className={`w-5 h-5 ${competitionState.status === 'running' ? 'text-[#00ff66] animate-pulse' : 'text-amber-400'}`} />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00ff66] animate-ping opacity-60" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 tracking-wider">
                <span>TIME REMAINING</span>
                <span className={`w-1.5 h-1.5 rounded-full ${competitionState.status === 'running' ? 'bg-[#00ff66]' : 'bg-amber-400'}`} />
                <span className="uppercase text-[9px] font-bold text-slate-300">
                  [{competitionState.status}]
                </span>
              </div>
              <div className="font-mono text-xl font-black tracking-widest text-emerald-400 tabular-nums drop-shadow-[0_0_8px_rgba(0,255,102,0.5)]">
                {formatTime(competitionState.remainingSeconds)}
              </div>
            </div>

            {competitionState.writeupMode && (
              <div className="ml-2 px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-400/50 text-cyan-300 text-[10px] font-mono font-bold flex items-center gap-1 shadow-[0_0_10px_rgba(0,240,255,0.25)]">
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>WRITEUPS UNLOCKED</span>
              </div>
            )}
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Audio Toggle */}
            <button
              onClick={toggleSound}
              className="p-2 sm:p-2.5 rounded-lg bg-[#0d111a] border border-slate-700 hover:border-emerald-500/60 text-slate-300 hover:text-[#00ff66] transition-all hover:shadow-[0_0_12px_rgba(0,255,102,0.2)]"
              title={muted ? 'Unmute Cyber SFX' : 'Mute Cyber SFX'}
              aria-label="Toggle Sound Effects"
            >
              {muted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />}
            </button>

            {/* Team Status / Auth Trigger */}
            {team ? (
              <div className="relative">
                <button
                  onClick={() => setShowTeamMenu(!showTeamMenu)}
                  className="flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-[#0d111a] border border-emerald-500/50 hover:border-emerald-400 shadow-[0_0_15px_rgba(0,255,102,0.2)] hover:shadow-[0_0_20px_rgba(0,255,102,0.3)] transition-all"
                >
                  <div className="relative flex items-center justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#00ff66]" />
                    <span className="absolute w-4 h-4 rounded-full bg-[#00ff66]/30 animate-ping" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                      <span className="max-w-[110px] sm:max-w-[140px] truncate">{team.teamName}</span>
                      {teamRank && (
                        <span className="text-[10px] text-black bg-[#00ff66] px-1.5 py-0.2 rounded font-black">
                          #{teamRank}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-[#00ff66] font-bold flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5 text-[#00ff66]" />
                      <span>{team.score} PTS</span>
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
                </button>

                {/* Team Dropdown Menu */}
                {showTeamMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-[#0d111a]/98 border border-emerald-500/50 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.9)] p-4 z-50 text-xs font-mono backdrop-blur-xl animate-fadeIn">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                      <div>
                        <div className="font-bold text-white text-sm">{team.teamName}</div>
                        <div className="text-[10px] text-emerald-400 font-medium">RANK #{teamRank} · {team.score} PTS</div>
                      </div>
                      <div className="text-right">
                        {getStrikeBadge()}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                      ACTIVE OPERATORS ({team.members.length}/4):
                    </div>
                    <ul className="space-y-1 mb-3 bg-[#080b12] p-2 rounded-lg border border-slate-800/80">
                      {team.members.map((m, i) => (
                        <li key={i} className="text-slate-300 flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5">
                            <UserCheck className="w-3 h-3 text-[#00ff66]" />
                            <span className="font-medium">{m}</span>
                          </span>
                          {i === 0 && (
                            <span className="text-[9px] text-[#00ff66] bg-[#00ff66]/10 px-1 py-0.2 rounded border border-[#00ff66]/30">
                              LEAD
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    <div className="border-t border-slate-800 pt-2.5 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">SESSION AUTHENTICATED</span>
                      <button
                        onClick={() => {
                          setShowTeamMenu(false);
                          onLogoutTeam();
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-950/40 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 text-[11px] font-bold transition-colors"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Disconnect</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-[#00ff66]/10 border border-[#00ff66] text-[#00ff66] hover:bg-[#00ff66] hover:text-black font-mono text-xs font-black tracking-wider transition-all duration-200 shadow-[0_0_15px_rgba(0,255,102,0.3)] hover:shadow-[0_0_25px_rgba(0,255,102,0.6)]"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>SIGN IN / JOIN TEAM</span>
              </button>
            )}

            {/* Admin Portal Gateway */}
            <button
              onClick={() => handleTabClick('admin')}
              className={`p-2 sm:p-2.5 rounded-lg border transition-all ${
                isAdminAuthenticated
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                  : 'bg-[#0d111a] border-slate-700 hover:border-amber-500/50 text-slate-400 hover:text-amber-400'
              }`}
              title={isAdminAuthenticated ? 'Admin Panel Active' : 'Master Admin Portal Login'}
              aria-label="Admin Portal Access"
            >
              <Lock className={`w-4 h-4 ${isAdminAuthenticated ? 'text-amber-400 animate-pulse' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile Sub-Telemetry Strip */}
        <div className="flex lg:hidden items-center justify-between py-2 border-t border-slate-800/80 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-[11px]">COUNTDOWN:</span>
            <span className="text-emerald-400 font-bold tabular-nums">{formatTime(competitionState.remainingSeconds)}</span>
          </div>
          {team && (
            <div>
              {getStrikeBadge()}
            </div>
          )}
        </div>

        {/* Quick-Access Navigation Tabs with Active Glow Indicators */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-2.5 border-t border-slate-800/70 no-scrollbar">
          <button
            onClick={() => handleTabClick('challenges')}
            className={`relative px-4 py-1.5 text-xs font-mono font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${
              currentTab === 'challenges'
                ? 'bg-[#00ff66]/15 text-[#00ff66] border border-[#00ff66]/60 shadow-[0_0_15px_rgba(0,255,102,0.25)]'
                : 'text-slate-400 hover:text-white border border-transparent hover:border-slate-800 hover:shadow-[0_0_15px_rgba(0,255,102,0.2)]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-[#00ff66]" />
            <span>CHALLENGES</span>
            {currentTab === 'challenges' && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#00ff66] shadow-[0_0_8px_#00ff66]" />
            )}
          </button>

          <button
            onClick={() => handleTabClick('leaderboard')}
            className={`relative px-4 py-1.5 text-xs font-mono font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${
              currentTab === 'leaderboard'
                ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/60 shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                : 'text-slate-400 hover:text-white border border-transparent hover:border-slate-800 hover:shadow-[0_0_15px_rgba(0,240,255,0.2)]'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span>LEADERBOARD</span>
            {currentTab === 'leaderboard' && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
            )}
          </button>

          <button
            onClick={() => handleTabClick('activity')}
            className={`relative px-4 py-1.5 text-xs font-mono font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${
              currentTab === 'activity'
                ? 'bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/60 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                : 'text-slate-400 hover:text-white border border-transparent hover:border-slate-800 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)]'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-[#a855f7]" />
            <span>LIVE FEED</span>
            {currentTab === 'activity' && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#a855f7] shadow-[0_0_8px_#a855f7]" />
            )}
          </button>

          {isAdminAuthenticated && (
            <button
              onClick={() => handleTabClick('admin')}
              className={`relative px-4 py-1.5 text-xs font-mono font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${
                currentTab === 'admin'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  : 'text-amber-400/70 hover:text-amber-300 border border-transparent hover:border-amber-500/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>COMMAND HQ</span>
              {currentTab === 'admin' && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
