import React from 'react';
import {
  Shield,
  ShieldAlert,
  UserCheck,
  Users,
  Award,
  Zap,
  CheckCircle2,
  Lock,
  Clock,
  Terminal,
  LogOut,
  AlertTriangle,
  Flame,
  Radio,
  FileCode,
  Key,
  Layers,
  Mail,
} from 'lucide-react';
import type { PublicChallengeView, LeaderboardEntry } from '../types.ts';
import { playCyberBlip } from '../utils/audio.ts';

interface ProfileViewProps {
  team: {
    id: string;
    teamName: string;
    email?: string;
    members: string[];
    score: number;
    strikes?: number;
    isDisqualified?: boolean;
    disqualifiedReason?: string;
  } | null;
  challenges: PublicChallengeView[];
  leaderboard: LeaderboardEntry[];
  onOpenAuthModal: () => void;
  onLogoutTeam: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  team,
  challenges,
  leaderboard,
  onOpenAuthModal,
  onLogoutTeam,
}) => {
  if (!team) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 font-mono animate-fadeIn">
        <div className="rounded-2xl bg-[#0d111a]/90 backdrop-blur-xl border border-[#00ff66]/30 p-8 sm:p-10 text-center shadow-[0_0_35px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(0,255,102,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00ff66] to-transparent opacity-80" />

          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#080b12] border border-[#00ff66]/40 flex items-center justify-center text-[#00ff66] shadow-[0_0_20px_rgba(0,255,102,0.25)]">
            <Terminal className="w-8 h-8" />
          </div>

          <div className="text-[11px] text-[#00ff66] uppercase font-bold tracking-widest mb-1">
            [ACCESS RESTRICTED: CLEARANCE REQUIRED]
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
            OPERATOR DOSSIER LOCKED
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 font-sans max-w-md mx-auto leading-relaxed">
            No active team session detected. Authenticate or establish a new team to access defense telemetry, challenge breakdown, and operator clearance.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => {
                playCyberBlip(800);
                onOpenAuthModal();
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00ff66] hover:bg-[#00ff66]/85 text-black font-black text-xs tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(0,255,102,0.4)] hover:shadow-[0_0_30px_rgba(0,255,102,0.6)] flex items-center justify-center gap-2"
            >
              <Key className="w-4 h-4" />
              <span>AUTHENTICATE / SIGN IN</span>
            </button>

            <button
              onClick={() => {
                playCyberBlip(800);
                onOpenAuthModal();
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#080b12] hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-[#00ff66]/50 text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>REGISTER NEW TEAM</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const teamLeaderboardEntry = leaderboard.find((l) => l.teamId === team.id);
  const teamRank = teamLeaderboardEntry?.rank || '-';
  const solvedChallenges = challenges.filter((c) => c.isSolved);
  const currentStrikes = team.strikes || 0;
  const isDisqualified = Boolean(team.isDisqualified);

  const getCategoryBadgeClass = (category: string) => {
    switch (category.toUpperCase()) {
      case 'CRYPTO':
        return 'cat-badge-crypto';
      case 'STEGO':
        return 'cat-badge-stego';
      case 'FORENSICS':
        return 'cat-badge-forensics';
      case 'WEB':
        return 'cat-badge-web';
      case 'REV':
        return 'cat-badge-rev';
      case 'OSINT':
        return 'cat-badge-osint';
      case 'AUDIO':
        return 'cat-badge-audio';
      default:
        return 'cat-badge-misc';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn font-mono">
      {/* Top Dossier HUD Banner */}
      <div className="rounded-2xl bg-[#0d111a]/90 backdrop-blur-xl border border-[#00ff66]/30 p-5 sm:p-7 shadow-[0_0_30px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(0,255,102,0.04)] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00ff66] to-transparent opacity-80" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#00ff66] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#00ff66] animate-ping" />
              <Shield className="w-4 h-4" />
              <span>TEAM PROFILE &amp; STATS</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1.5 tracking-wide flex items-center gap-3">
              <span>{team.teamName}</span>
              <span className="text-xs font-bold text-black bg-[#00ff66] px-2.5 py-0.5 rounded-md shadow-[0_0_12px_rgba(0,255,102,0.5)]">
                RANK #{teamRank}
              </span>
            </h2>
            {team.email && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono mt-1">
                <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{team.email}</span>
                <span className="text-[10px] text-slate-500">· VERIFIED TEAM EMAIL</span>
              </div>
            )}
            <p className="text-xs sm:text-sm text-slate-300 font-sans mt-1 max-w-xl">
              View your team rank, score, members, and solved challenges in real time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                playCyberBlip(700);
                onLogoutTeam();
              }}
              className="px-4 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white border border-red-500/40 hover:border-red-500 text-xs font-bold transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>LOG OUT</span>
            </button>
          </div>
        </div>

        {/* Quick Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-[#080b12] p-3.5 rounded-xl border border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#00ff66]" />
              TOTAL POINTS
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-0.5 ${team.score < 0 ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'text-[#00ff66] drop-shadow-[0_0_8px_rgba(0,255,102,0.5)]'}`}>
              {team.score} PTS
            </div>
          </div>

          <div className="bg-[#080b12] p-3.5 rounded-xl border border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[#00f0ff]" />
              CHALLENGES SOLVED
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {solvedChallenges.length} / {challenges.length}
            </div>
          </div>

          <div className="bg-[#080b12] p-3.5 rounded-xl border border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              TEAM MEMBERS
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-300 mt-0.5">
              {team.members.length} {team.members.length === 1 ? 'MEMBER' : 'MEMBERS'}
            </div>
          </div>

          <div className="bg-[#080b12] p-3.5 rounded-xl border border-slate-800">
            <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-red-400" />
              ACCOUNT STATUS
            </div>
            <div className="text-sm sm:text-base font-black mt-1">
              {isDisqualified ? (
                <span className="text-red-400 animate-pulse">[DISQUALIFIED]</span>
              ) : currentStrikes > 0 ? (
                <span className="text-amber-400">{currentStrikes}/10 WARNINGS</span>
              ) : (
                <span className="text-emerald-400">ACTIVE (NORMAL)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Strike Security Status & Squad Members */}
        <div className="space-y-6">
          {/* 10-Strike Security Telemetry Box */}
          <div className="rounded-2xl bg-[#0d111a]/85 backdrop-blur-md border border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  SECURITY STATUS
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                isDisqualified
                  ? 'bg-red-950 text-red-400 border-red-500'
                  : currentStrikes > 0
                  ? 'bg-amber-950 text-amber-300 border-amber-500'
                  : 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
              }`}>
                {isDisqualified ? 'DISQUALIFIED' : currentStrikes > 0 ? 'WARNING' : 'NORMAL'}
              </span>
            </div>

            {/* 10-Slot Visual Meter */}
            <div>
              <div className="text-[10px] text-slate-400 mb-2 uppercase font-bold">
                WARNINGS ACCUMULATED ({currentStrikes}/10):
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((slot) => (
                  <div
                    key={slot}
                    className={`h-7 rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${
                      slot <= currentStrikes
                        ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.7)] border border-red-400'
                        : 'bg-[#080b12] text-slate-600 border border-slate-800'
                    }`}
                  >
                    #{slot}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              Screenshots and unauthorized developer tools are monitored to maintain fair play across all participating teams.
            </p>
          </div>

          {/* Squad Roster */}
          <div className="rounded-2xl bg-[#0d111a]/85 backdrop-blur-md border border-slate-800 p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00ff66]" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  TEAM MEMBERS
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-bold">
                {team.members.length} / 3 MEMBERS
              </span>
            </div>

            <ul className="space-y-2">
              {team.members.map((member, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#080b12] border border-slate-800/80"
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-[#00ff66]" />
                    <span className="text-white text-xs font-bold">{member}</span>
                  </div>
                  {i === 0 ? (
                    <span className="text-[9px] font-black text-black bg-[#00ff66] px-1.5 py-0.5 rounded">
                      TEAM LEADER
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-slate-500">MEMBER</span>
                  )}
                </li>
              ))}
            </ul>

            {team.email && (
              <div className="p-2.5 rounded-xl bg-[#080b12] border border-emerald-500/30 flex items-center gap-2.5 text-xs mt-3">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Team Leader Contact Email</div>
                  <div className="font-mono text-emerald-300 font-semibold truncate text-[11px]">{team.email}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Columns: Captured Targets Chronology & Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl bg-[#0d111a]/85 backdrop-blur-md border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#00ff66]" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  SOLVED CHALLENGES ({solvedChallenges.length})
                </span>
              </div>
              <span className="text-[11px] text-[#00ff66] font-bold">
                {solvedChallenges.reduce((acc, c) => acc + c.points, 0)} TOTAL POINTS
              </span>
            </div>

            {solvedChallenges.length > 0 ? (
              <div className="space-y-2.5">
                {solvedChallenges.map((chal) => (
                  <div
                    key={chal.id}
                    className="p-3.5 rounded-xl bg-[#080b12] border border-emerald-500/30 flex items-center justify-between gap-3 hover:border-emerald-500/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-[#00ff66] shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-bold text-xs sm:text-sm truncate">
                            {chal.title}
                          </span>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-black border uppercase ${getCategoryBadgeClass(
                              chal.category
                            )}`}
                          >
                            {chal.category}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {chal.section} · Flag Format: {chal.flagFormat}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-[#00ff66] drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]">
                        +{chal.points}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1">PTS</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-14 text-center text-slate-500 space-y-2">
                <Terminal className="w-10 h-10 mx-auto text-slate-600 opacity-60 animate-pulse" />
                <p className="font-bold text-slate-400 text-xs">NO TARGETS DECRYPTED YET</p>
                <p className="text-[11px] text-slate-600 max-w-sm mx-auto">
                  Access the CHALLENGES marketplace to begin decrypting cryptographic ciphers, steganographic payloads, and binary exploits.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
