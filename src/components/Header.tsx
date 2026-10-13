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
  User,
  LogOut,
  ChevronDown,
  Radio,
  BookOpen,
  Activity,
  Zap,
  AlertTriangle,
  Menu,
  X,
  MessageSquareHeart,
} from 'lucide-react';
import type { CompetitionState, LeaderboardEntry } from '../types.ts';
import { playCyberBlip, setAudioMuted } from '../utils/audio.ts';

export type AppTab = 'challenges' | 'rules' | 'leaderboard' | 'activity' | 'feedback' | 'profile' | 'admin';

interface HeaderProps {
  currentTab: AppTab;
  setCurrentTab: (tab: AppTab) => void;
  competitionState: CompetitionState;
  team: {
    id: string;
    teamName: string;
    members: string[];
    score: number;
    strikes?: number;
    isDisqualified?: boolean;
    hasStarted?: boolean;
  } | null;
  leaderboard: LeaderboardEntry[];
  onOpenAuthModal: () => void;
  onLogoutTeam: () => void;
  isAdminAuthenticated: boolean;
  isConnected: boolean;
  adminOperatorName?: string;
  isReadyToStart?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  competitionState,
  team,
  leaderboard,
  onOpenAuthModal,
  onLogoutTeam,
  isAdminAuthenticated,
  isConnected,
  adminOperatorName,
  isReadyToStart,
}) => {
  const [muted, setMutedState] = useState(false);
  const [showTeamMenu, setShowTeamMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Only show the live competition countdown timer if admin is authenticated OR after the team has started
  const showCompetitionTimer =
    isAdminAuthenticated || (Boolean(team) && Boolean(isReadyToStart || team?.hasStarted));

  const toggleSound = () => {
    const next = !muted;
    setMutedState(next);
    setAudioMuted(next);
    if (!next) playCyberBlip(1000);
  };

  const isGuest = !team && !isAdminAuthenticated;
  const isTabLocked = (tabId: AppTab) => isGuest && (tabId === 'activity' || tabId === 'feedback' || tabId === 'profile');

  const handleTabClick = (tab: AppTab) => {
    playCyberBlip(750);
    if (isTabLocked(tab)) {
      setMobileMenuOpen(false);
      onOpenAuthModal();
      return;
    }
    setCurrentTab(tab);
    setMobileMenuOpen(false);
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const teamRank = team
    ? leaderboard.find((l) => l.teamId === team.id)?.rank || '-'
    : null;

  const currentStrikes = team?.strikes || 0;
  const isDisqualified = Boolean(team?.isDisqualified);

  // Minimal Clean Warning Meter Indicator (Exempt admin)
  const renderStrikeIndicator = () => {
    if (!team || isAdminAuthenticated || currentTab === 'admin') return null;
    if (isDisqualified) {
      return (
        <span className="px-2 py-1 rounded-lg text-[10px] font-mono font-black bg-red-950/80 text-red-400 border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)] flex items-center gap-1.5 animate-pulse shrink-0">
          <AlertTriangle className="w-3 h-3 text-red-400" />
          <span>[DISQ]</span>
        </span>
      );
    }
    if (currentStrikes > 0) {
      return (
        <span className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-amber-950/70 text-amber-300 border border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.2)] flex items-center gap-1 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="hidden sm:inline">WARNINGS: </span>
          <span className="sm:hidden">WRN: </span>
          <span>{currentStrikes}</span>
        </span>
      );
    }
    return (
      <span className="hidden xl:flex px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-[#08121d] text-slate-400 border border-slate-800 items-center gap-1 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41]" />
        <span>WRN: 0</span>
      </span>
    );
  };

  const navTabs: { id: AppTab; label: string; shortLabel: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'challenges', label: 'CHALLENGES', shortLabel: 'CHALLENGES', icon: Terminal },
    { id: 'rules', label: 'RULES & INFO', shortLabel: 'RULES', icon: BookOpen },
    { id: 'leaderboard', label: 'LEADERBOARD', shortLabel: 'LEADERBOARD', icon: Trophy },
    { id: 'activity', label: 'LIVE FEED', shortLabel: 'FEED', icon: Radio },
    { id: 'feedback', label: 'FEEDBACK', shortLabel: 'FEEDBACK', icon: MessageSquareHeart },
    { id: 'profile', label: 'PROFILE', shortLabel: 'PROFILE', icon: User },
  ];

  return (
    <header
      className="sticky top-0 z-50 transition-all duration-300"
      style={{
        background: 'rgba(8, 15, 22, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0, 255, 65, 0.2)',
        boxShadow: '0 4px 20px rgba(0, 255, 65, 0.15), 0 10px 30px rgba(0, 0, 0, 0.85)',
      }}
    >
      {/* Holographic Neon Accent Line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#00ff41]/60 to-transparent pointer-events-none" />

      {/* Main 3-Column Header Bar */}
      <div className="w-full px-2 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-16 sm:h-18 gap-2">
          
          {/* ================= COLUMN 1 (LEFT): BRANDING LOGO & TITLE ================= */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => handleTabClick('challenges')}
              className="flex items-center gap-2 group text-left cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
              title="The Final Decrypt"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#050e18]/90 border border-[#00ff41]/50 flex items-center justify-center text-[#00ff41] shadow-[0_0_12px_rgba(0,255,65,0.3)] group-hover:border-[#00ff41] group-hover:shadow-[0_0_20px_rgba(0,255,65,0.55)] transition-all shrink-0">
                <Terminal className="w-4 h-4 text-[#00ff41]" />
              </div>
              <div className="min-w-0">
                <div className="font-mono font-black text-xs sm:text-sm tracking-wider text-white flex items-center gap-1 drop-shadow-[0_0_10px_rgba(0,255,65,0.5)]">
                  <span className="text-[#00ff41] animate-pulse">&gt;</span>
                  <span className="bg-gradient-to-r from-white via-slate-100 to-[#e2e8f0] bg-clip-text text-transparent truncate">
                    THE FINAL DECRYPT
                  </span>
                </div>
                <div className="text-[9px] sm:text-[10px] font-mono text-slate-400 tracking-wider hidden sm:flex items-center gap-1.5">
                  <span className="text-[#00f0ff] font-bold">ROUND 2:</span>
                  <span>NO CLUE, NO MERCY</span>
                </div>
              </div>
            </button>
          </div>

          {/* ================= COLUMN 2 (CENTER): CENTERED NAVIGATION TABS ================= */}
          <nav className="hidden xl:flex items-center justify-center shrink-0">
            <div className="flex items-center gap-0.5 2xl:gap-1 p-0.5 2xl:p-1 rounded-xl bg-[#040a12]/90 border border-slate-800/90 backdrop-blur-md shadow-inner">
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                const locked = isTabLocked(tab.id);
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    title={locked ? `${tab.label} (Sign in / register to unlock)` : undefined}
                    className={`px-2 2xl:px-2.5 py-1.5 rounded-lg font-mono text-[11px] 2xl:text-xs font-bold transition-all duration-200 flex items-center gap-1 2xl:gap-1.5 cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'text-[#00ff41] bg-[#00ff41]/15 border border-[#00ff41]/60 shadow-[0_0_12px_rgba(0,255,65,0.3)]'
                        : locked
                        ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'
                        : 'text-slate-400 hover:text-[#00ff41] hover:bg-[#00ff41]/10 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${locked ? 'text-slate-500' : ''}`} />
                    <span>{tab.label}</span>
                    {locked && (
                      <Lock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                    )}
                  </button>
                );
              })}

              {/* Admin Panel Tab Item */}
              {isAdminAuthenticated && (
                <button
                  onClick={() => handleTabClick('admin')}
                  className={`px-2 2xl:px-2.5 py-1.5 rounded-lg font-mono text-[11px] 2xl:text-xs font-bold transition-all duration-200 flex items-center gap-1 2xl:gap-1.5 cursor-pointer whitespace-nowrap ${
                    currentTab === 'admin'
                      ? 'text-amber-300 bg-amber-500/20 border border-amber-500/70 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                      : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 border border-transparent'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>ADMIN</span>
                </button>
              )}
            </div>
          </nav>

          {/* ================= COLUMN 3 (RIGHT): STATUS, TIMER, SOUND, SIGN IN & MOBILE HAMBURGER ================= */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
            {/* Live Competition Countdown Timer */}
            {showCompetitionTimer && (() => {
              const isLastMinute = competitionState.status === 'running' && competitionState.remainingSeconds <= 60 && competitionState.remainingSeconds > 0;
              return (
                <div
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border text-xs font-mono shadow-inner transition-colors shrink-0 ${
                    isLastMinute
                      ? 'border-red-500/90 bg-red-950/60 text-red-400 shadow-[0_0_18px_rgba(239,68,68,0.55)] animate-pulse font-black'
                      : competitionState.status === 'running'
                      ? 'bg-[#050e18]/90 border-[#00ff41]/40 text-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.15)]'
                      : competitionState.status === 'paused'
                      ? 'border-amber-500/50 bg-amber-950/20 text-amber-400'
                      : 'border-red-500/50 bg-red-950/20 text-red-400'
                  }`}
                >
                  <Clock
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isLastMinute
                        ? 'text-red-400 animate-bounce drop-shadow-[0_0_8px_#ef4444]'
                        : competitionState.status === 'running'
                        ? 'text-[#00ff41] animate-pulse drop-shadow-[0_0_6px_#00ff41]'
                        : competitionState.status === 'paused'
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}
                  />
                  <span className="hidden 2xl:inline text-slate-400 text-[10px] uppercase font-bold">
                    {isLastMinute
                      ? 'FINAL COUNTDOWN:'
                      : competitionState.status === 'running'
                      ? 'TIME:'
                      : competitionState.status === 'paused'
                      ? 'PAUSED:'
                      : 'ENDED:'}
                  </span>
                  <span className="font-bold tracking-wider tabular-nums text-xs">
                    {formatTime(competitionState.remainingSeconds)}
                  </span>
                </div>
              );
            })()}

            {/* Strike Meter Indicator (Desktop - if squad is logged in) */}
            <div className="shrink-0">
              {renderStrikeIndicator()}
            </div>

            {/* WS Connected Badge (Desktop) */}
            <div
              className={`hidden md:flex px-2 py-1 sm:py-1.5 rounded-xl text-[10px] font-mono font-bold border items-center gap-1.5 shrink-0 ${
                isConnected
                  ? 'bg-[#040c14]/90 text-[#00ff41] border-[#00ff41]/40 shadow-[0_0_8px_rgba(0,255,65,0.15)]'
                  : 'bg-red-950/40 text-red-400 border-red-500/40'
              }`}
              title={isConnected ? 'Real-Time Telemetry & Socket.IO Active' : 'WebSocket Disconnected'}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                {isConnected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff41] opacity-75 duration-1000" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff41] shadow-[0_0_8px_#00ff41]" />
                  </>
                ) : (
                  <span className="inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_8px_#ef4444]" />
                )}
              </span>
              <span className="hidden 2xl:inline opacity-75">WS:</span>
              <span className="hidden xl:inline">{isConnected ? 'LIVE' : 'OFF'}</span>
            </div>

            {/* Audio Toggle Button - ALWAYS Visible on sm+ screens */}
            <button
              onClick={toggleSound}
              className={`hidden sm:flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border font-mono text-xs font-bold transition-all cursor-pointer shrink-0 ${
                muted
                  ? 'bg-red-950/30 text-slate-400 border-slate-800 hover:border-red-500/40 hover:text-red-300'
                  : 'bg-[#050e18]/90 text-[#00ff41] border-[#00ff41]/40 shadow-[0_0_10px_rgba(0,255,65,0.2)] hover:border-[#00ff41]'
              }`}
              title={muted ? 'Audio SFX Muted - Click to Unmute' : 'Audio SFX Active - Click to Mute'}
              aria-label="Toggle sound"
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 text-red-400 shrink-0" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-[#00ff41] shrink-0 animate-pulse" />
              )}
              <span className="text-[10px] hidden 2xl:inline">{muted ? 'OFF' : 'ON'}</span>
            </button>

            {/* Team Profile Dropdown OR Sign In / Register Button - ALWAYS Visible */}
            {team ? (
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowTeamMenu(!showTeamMenu)}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-[#050e18] border border-emerald-500/40 hover:border-emerald-400 transition-all shadow-[0_0_12px_rgba(0,255,65,0.18)] cursor-pointer shrink-0"
                >
                  <div className="text-left font-mono">
                    <div className="text-xs font-bold text-white flex items-center gap-1">
                      <span className="max-w-[70px] sm:max-w-[100px] xl:max-w-[130px] truncate">{team.teamName}</span>
                      {teamRank && (
                        <span className="text-[9px] text-black bg-[#00ff41] px-1 rounded font-black">
                          #{teamRank}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#00ff41] font-bold">
                      {team.score} PTS
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5 shrink-0" />
                </button>

                {/* Team Dropdown Menu */}
                {showTeamMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#08121d]/98 border border-emerald-500/40 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.9)] p-3.5 z-50 text-xs font-mono backdrop-blur-xl animate-fadeIn">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                      <div>
                        <div className="font-bold text-white text-xs">{team.teamName}</div>
                        <div className="text-[10px] text-emerald-400">
                          RANK #{teamRank} · {team.score} PTS
                        </div>
                      </div>
                      <div className="text-right">{renderStrikeIndicator()}</div>
                    </div>

                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                      TEAM MEMBERS ({team.members.length}/3):
                    </div>
                    <ul className="space-y-1 mb-3 bg-[#040810] p-2 rounded-lg border border-slate-800">
                      {team.members.map((m, i) => (
                        <li key={i} className="text-slate-300 flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 truncate">
                            <UserCheck className="w-3 h-3 text-[#00ff41]" />
                            <span className="truncate">{m}</span>
                          </span>
                          {i === 0 && (
                            <span className="text-[8px] text-[#00ff41] bg-[#00ff41]/10 px-1 rounded font-bold">
                              LEADER
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    <div className="border-t border-slate-800 pt-2 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setShowTeamMenu(false);
                          handleTabClick('profile');
                        }}
                        className="px-2 py-1 rounded-lg bg-[#00ff41]/10 hover:bg-[#00ff41]/20 text-[#00ff41] text-[11px] font-bold cursor-pointer"
                      >
                        View Profile
                      </button>

                      <button
                        onClick={() => {
                          setShowTeamMenu(false);
                          onLogoutTeam();
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-950/40 text-red-300 hover:text-white border border-red-500/30 text-[11px] font-bold cursor-pointer"
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
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 bg-[#00ff41]/15 hover:bg-[#00ff41] text-[#00ff41] hover:text-black border border-[#00ff41] shadow-[0_0_12px_rgba(0,255,65,0.25)] hover:shadow-[0_0_20px_rgba(0,255,65,0.5)] active:scale-95 cursor-pointer shrink-0"
                title="Sign in or register a new team"
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">SIGN UP / IN</span>
                <span className="sm:hidden">LOGIN</span>
              </button>
            )}

            {/* Mobile Hamburger Drawer Trigger Button (< xl screens, min 44x44px touch target) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 sm:p-2.5 min-w-[38px] sm:min-w-[42px] min-h-[38px] sm:min-h-[42px] rounded-xl bg-[#050e18]/90 border border-emerald-500/40 text-slate-300 hover:text-[#00ff41] hover:border-[#00ff41] flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-[0_0_12px_rgba(0,255,65,0.15)] shrink-0"
              aria-label="Toggle navigation drawer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-[#00ff41]" /> : <Menu className="w-5 h-5 text-[#00ff41]" />}
            </button>
          </div>
        </div>

        {/* ================= MOBILE NAVIGATION DRAWER (< xl screens) ================= */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-emerald-500/30 bg-[#050c14]/98 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] px-4 py-5 space-y-4 font-mono text-xs animate-in slide-in-from-top duration-200">
            {/* Primary Navigation Links with 44px+ Touch Targets */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-1 pb-1 flex items-center justify-between">
                <span>NAVIGATION // SELECT SECTOR</span>
                <span className="text-[#00ff41] text-[9px]">[ROUND 2]</span>
              </div>
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                const locked = isTabLocked(tab.id);
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#00ff41]/20 text-[#00ff41] border border-[#00ff41] shadow-[0_0_15px_rgba(0,255,65,0.3)]'
                        : locked
                        ? 'bg-[#08111d]/40 text-slate-500 hover:text-slate-300 border border-slate-900'
                        : 'bg-[#08111d]/60 text-slate-300 hover:text-white hover:bg-slate-800/60 border border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#00ff41]' : locked ? 'text-slate-600' : 'text-slate-400'}`} />
                      <span className={`text-sm tracking-wide ${locked ? 'text-slate-500' : ''}`}>{tab.label}</span>
                    </div>
                    {locked ? (
                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                        <Lock className="w-2.5 h-2.5 text-slate-500" />
                        <span>LOCKED</span>
                      </span>
                    ) : (
                      <span className={isActive ? 'text-[#00ff41] font-mono text-xs' : 'text-slate-600'}>
                        {isActive ? '[ACTIVE]' : '→'}
                      </span>
                    )}
                  </button>
                );
              })}

              {isAdminAuthenticated && (
                <button
                  onClick={() => handleTabClick('admin')}
                  className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer ${
                    currentTab === 'admin'
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                      : 'bg-amber-950/20 text-amber-400 hover:text-amber-300 border border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span className="text-sm tracking-wide">
                      ADMIN [{adminOperatorName?.toUpperCase() || 'CONTROLLER'}]
                    </span>
                  </div>
                  <span className="text-amber-400">→</span>
                </button>
              )}
            </div>

            {/* System Telemetry & Quick Action Controls in Mobile Drawer */}
            <div className="pt-3 border-t border-slate-800/80 space-y-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-1">
                SYSTEM & TELEMETRY CONTROLS
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Mobile WS Status */}
                <div
                  className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                    isConnected
                      ? 'bg-[#040c14] text-[#00ff41] border-[#00ff41]/40 shadow-[0_0_10px_rgba(0,255,65,0.15)]'
                      : 'bg-red-950/40 text-red-400 border-red-500/40'
                  }`}
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    {isConnected ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff41] opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff41]" />
                      </>
                    ) : (
                      <span className="inline-flex rounded-full h-2 w-2 bg-red-500" />
                    )}
                  </span>
                  <span className="text-[11px] font-bold truncate">
                    {isConnected ? 'WS CONNECTED' : 'OFFLINE'}
                  </span>
                </div>

                {/* Mobile Audio SFX Toggle */}
                <button
                  onClick={toggleSound}
                  className="min-h-[44px] p-2.5 rounded-xl bg-[#040c14] border border-slate-800 hover:border-[#00ff41]/40 text-slate-300 hover:text-[#00ff41] flex items-center justify-between text-[11px] font-bold cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    {muted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-[#00ff41]" />}
                    <span>SFX</span>
                  </div>
                  <span className={muted ? 'text-slate-500' : 'text-[#00ff41]'}>
                    {muted ? 'MUTED' : 'ON'}
                  </span>
                </button>
              </div>

              {/* Mobile Strike Indicator */}
              {team && (
                <div className="p-2.5 rounded-xl bg-[#040c14] border border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold">STRIKE MONITOR:</span>
                  <div>{renderStrikeIndicator()}</div>
                </div>
              )}

              {/* Mobile Team Account / Login CTA */}
              {team ? (
                <div className="p-3 rounded-xl bg-[#08121d] border border-emerald-500/30 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white font-bold text-xs truncate flex items-center gap-1.5">
                      <span className="truncate">{team.teamName}</span>
                      {teamRank && (
                        <span className="text-[9px] text-black bg-[#00ff41] px-1 rounded font-black">
                          #{teamRank}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#00ff41] font-bold mt-0.5">
                      {team.score} PTS · {team.members.length} MEMBERS
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleTabClick('profile')}
                      className="px-2.5 py-1.5 rounded-lg bg-[#00ff41]/10 text-[#00ff41] text-[11px] font-bold hover:bg-[#00ff41]/20 cursor-pointer min-h-[38px]"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onLogoutTeam();
                      }}
                      className="p-2 rounded-lg bg-red-950/40 text-red-400 hover:text-white border border-red-500/30 min-h-[38px] flex items-center justify-center cursor-pointer"
                      title="Disconnect Team"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuthModal();
                  }}
                  className="w-full min-h-[46px] py-3 rounded-xl bg-[#00ff41] hover:bg-[#00ff41]/90 text-black font-mono text-xs font-black tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(0,255,65,0.4)] flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <UserCheck className="w-4 h-4 text-black" />
                  <span>SIGN IN / REGISTER TEAM</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
