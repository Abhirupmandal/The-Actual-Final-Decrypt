import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  CompetitionState,
  PublicChallengeView,
  LeaderboardEntry,
  ActivityFeedEvent,
} from './types.ts';
import { Header } from './components/Header.tsx';
import { ChallengeSection } from './components/ChallengeSection.tsx';
import { Leaderboard } from './components/Leaderboard.tsx';
import { ActivityFeed } from './components/ActivityFeed.tsx';
import { AdminPortal } from './components/AdminPortal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { AdminLoginModal } from './components/AdminLoginModal.tsx';
import { AnnouncementModal } from './components/AnnouncementModal.tsx';
import { WriteupModal } from './components/WriteupModal.tsx';
import { Watermark } from './components/Watermark.tsx';
import { SecurityGuard } from './components/SecurityGuard.tsx';
import { StrikeWarningModal } from './components/StrikeWarningModal.tsx';
import { DisqualificationScreen } from './components/DisqualificationScreen.tsx';
import { playSuccessChime, playCyberBlip } from './utils/audio.ts';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Application Views
  const [currentTab, setCurrentTab] = useState<'challenges' | 'leaderboard' | 'activity' | 'admin'>('challenges');

  // Competition State
  const [competitionState, setCompetitionState] = useState<CompetitionState>({
    status: 'running',
    startTime: Date.now(),
    durationSeconds: 7200,
    remainingSeconds: 7200,
    writeupMode: false,
    announcement: null,
  });

  // Data
  const [challenges, setChallenges] = useState<PublicChallengeView[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedEvent[]>([]);
  const [team, setTeam] = useState<{
    id: string;
    teamName: string;
    members: string[];
    score: number;
    strikes?: number;
    isDisqualified?: boolean;
    disqualifiedReason?: string;
  } | null>(null);

  // 5-Strike Security State
  const [strikeWarning, setStrikeWarning] = useState<{ strikes: number; reason: string } | null>(null);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [disqualifiedReason, setDisqualifiedReason] = useState<string | undefined>();

  // Auth & Admin Tokens
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return localStorage.getItem('ctf_admin_token') || null;
  });
  const [hasDemoTeams, setHasDemoTeams] = useState<boolean>(false);

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<any>(null);
  const [activeWriteupChallenge, setActiveWriteupChallenge] = useState<PublicChallengeView | null>(null);

  // Fetch full state from backend
  const fetchState = useCallback(async () => {
    try {
      const token = localStorage.getItem('ctf_team_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/state', { headers });
      if (res.ok) {
        const data = await res.json();
        setCompetitionState(data.competitionState);
        setChallenges(data.challenges);
        setLeaderboard(data.leaderboard);
        setActivityFeed(data.activityFeed);
        if (typeof data.hasDemoTeams === 'boolean') {
          setHasDemoTeams(data.hasDemoTeams);
        }
        if (data.team) {
          setTeam(data.team);
          if (data.team.isDisqualified) {
            setIsDisqualified(true);
            setDisqualifiedReason(data.team.disqualifiedReason || 'Accumulated 5 security infractions.');
          }
        } else if (token) {
          // Token expired or invalid
          localStorage.removeItem('ctf_team_token');
          setTeam(null);
        }
        if (data.competitionState.announcement) {
          setActiveAnnouncement(data.competitionState.announcement);
        }
      }
    } catch (err) {
      console.error('Failed to sync initial state:', err);
    }
  }, []);

  // Initialize Socket.io and Listeners
  useEffect(() => {
    const s = io({
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      setIsConnected(true);
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on('state_init', (data) => {
      if (data.competitionState) setCompetitionState(data.competitionState);
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      if (data.activityFeed) setActivityFeed(data.activityFeed);
    });

    s.on('timer_tick', (tick) => {
      setCompetitionState((prev) => ({
        ...prev,
        status: tick.status,
        remainingSeconds: tick.remainingSeconds,
        writeupMode: tick.writeupMode,
      }));
    });

    s.on('leaderboard_update', (newLeaderboard: LeaderboardEntry[]) => {
      setLeaderboard(newLeaderboard);
    });

    s.on('activity_event', (event: ActivityFeedEvent) => {
      setActivityFeed((prev) => [event, ...prev.slice(0, 49)]);
      if (event.type === 'solve' || event.type === 'first_blood') {
        playCyberBlip(800);
      }
    });

    s.on('team_disqualified', (disqData: { teamId: string; teamName: string; reason: string }) => {
      fetchState();
      setTeam((current) => {
        if (current && current.id === disqData.teamId) {
          setIsDisqualified(true);
          setDisqualifiedReason(disqData.reason);
        }
        return current;
      });
    });

    s.on('announcement_broadcast', (announcement) => {
      setActiveAnnouncement(announcement);
      playSuccessChime();
    });

    s.on('competition_ended', () => {
      fetchState();
    });

    s.on('state_update', () => {
      fetchState();
    });

    setSocket(s);
    fetchState();

    return () => {
      s.disconnect();
    };
  }, [fetchState]);

  // Handle Team Login Success
  const handleTeamLoginSuccess = (newTeam: any, token: string) => {
    setTeam(newTeam);
    fetchState();
  };

  // Handle Team Logout
  const handleTeamLogout = () => {
    localStorage.removeItem('ctf_team_token');
    setTeam(null);
    fetchState();
  };

  // Handle Admin Login Success
  const handleAdminLoginSuccess = (token: string) => {
    setAdminToken(token);
    setCurrentTab('admin');
    fetchState();
  };

  // Handle Admin Logout
  const handleAdminLogout = () => {
    localStorage.removeItem('ctf_admin_token');
    setAdminToken(null);
    setCurrentTab('challenges');
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-[#e2e8f0] relative flex flex-col font-sans selection:bg-[#00ff66]/30 selection:text-[#00ff66]">
      {/* CRT Scanline Background Effect */}
      <div className="fixed inset-0 scanline pointer-events-none z-10 opacity-40" />

      {/* Cyberpunk Grid Background */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.035]" />

      {/* Security Anti-Cheat Guard & ShortCut Interceptor */}
      <SecurityGuard
        teamLoggedIn={Boolean(team) && !isDisqualified}
        onStrikeTriggered={(strikes, disq, reason) => {
          if (disq || strikes >= 5) {
            setIsDisqualified(true);
            setDisqualifiedReason(reason);
            setStrikeWarning(null);
            fetchState();
          } else if (strikes > 0) {
            setStrikeWarning({ strikes, reason });
            fetchState();
          }
        }}
      />

      {/* Dynamic Watermark */}
      <Watermark teamName={team?.teamName} sessionId={team?.id} />

      {/* Global Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        competitionState={competitionState}
        team={team}
        leaderboard={leaderboard}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogoutTeam={handleTeamLogout}
        onOpenAdminAuth={() => setIsAdminLoginModalOpen(true)}
        isAdminAuthenticated={Boolean(adminToken)}
        isConnected={isConnected}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-20">
        {currentTab === 'challenges' && (
          <ChallengeSection
            challenges={challenges}
            teamLoggedIn={Boolean(team)}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onViewWriteup={(chal) => setActiveWriteupChallenge(chal)}
            onRefreshState={fetchState}
          />
        )}

        {currentTab === 'leaderboard' && (
          <Leaderboard
            entries={leaderboard}
            currentTeamId={team?.id}
            hasDemoTeams={hasDemoTeams}
            onToggleDemoMode={async (mode) => {
              const res = await fetch('/api/scoreboard/mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode }),
              });
              if (res.ok) {
                const data = await res.json();
                setLeaderboard(data.leaderboard);
                setHasDemoTeams(data.hasDemoTeams);
                fetchState();
              }
            }}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}

        {currentTab === 'activity' && (
          <ActivityFeed events={activityFeed} />
        )}

        {currentTab === 'admin' && adminToken && (
          <AdminPortal
            adminToken={adminToken}
            competitionState={competitionState}
            onRefreshState={fetchState}
            onLogoutAdmin={handleAdminLogout}
          />
        )}
      </main>

      {/* Global Footer */}
      <footer className="border-t border-slate-900 bg-[#05070a] py-6 relative z-20 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[#00ff66] font-bold">THE FINAL DECRYPT</span>
            <span>·</span>
            <span>ROUND 2: NO CLUE, NO MERCY</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Official CTF Platform</span>
            <span>·</span>
            <span>Real-time Scoring</span>
            <span>·</span>
            <span className="text-emerald-400">Competition Active</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleTeamLoginSuccess}
      />

      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => setIsAdminLoginModalOpen(false)}
        onSuccess={handleAdminLoginSuccess}
      />

      <AnnouncementModal
        announcement={activeAnnouncement}
        onDismiss={() => setActiveAnnouncement(null)}
      />

      <WriteupModal
        challenge={activeWriteupChallenge}
        onClose={() => setActiveWriteupChallenge(null)}
      />

      {/* 5-Strike Security Warning Modal */}
      {strikeWarning && !isDisqualified && (
        <StrikeWarningModal
          strikes={strikeWarning.strikes}
          reason={strikeWarning.reason}
          onAcknowledge={() => setStrikeWarning(null)}
        />
      )}

      {/* Permanent Disqualification Lockdown Screen */}
      {isDisqualified && (
        <DisqualificationScreen
          teamName={team?.teamName}
          reason={disqualifiedReason}
          onLogout={handleTeamLogout}
        />
      )}
    </div>
  );
}
