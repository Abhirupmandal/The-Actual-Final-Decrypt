import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  CompetitionState,
  PublicChallengeView,
  LeaderboardEntry,
  ActivityFeedEvent,
} from './types.ts';
import { Header, type AppTab } from './components/Header.tsx';
import { ChallengeSection } from './components/ChallengeSection.tsx';
import { Leaderboard } from './components/Leaderboard.tsx';
import { ActivityFeed } from './components/ActivityFeed.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { PreCompetitionGate } from './components/PreCompetitionGate.tsx';
import { LandingPortal } from './components/LandingPortal.tsx';
import { AdminPortal } from './components/AdminPortal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { AdminLoginModal } from './components/AdminLoginModal.tsx';
import { AnnouncementModal } from './components/AnnouncementModal.tsx';
import { WriteupModal } from './components/WriteupModal.tsx';
import { ArtifactViewerModal } from './components/ArtifactViewerModal.tsx';
import { FeedbackSection } from './components/FeedbackSection.tsx';
import { StandaloneArtifactViewer } from './components/StandaloneArtifactViewer.tsx';
import { Watermark } from './components/Watermark.tsx';
import { SecurityGuard } from './components/SecurityGuard.tsx';
import { StrikeWarningBanner } from './components/StrikeWarningBanner.tsx';
import { DisqualificationScreen } from './components/DisqualificationScreen.tsx';
import { BinaryRainBackground } from './components/BinaryRainBackground.tsx';
import { playSuccessChime, playCyberBlip } from './utils/audio.ts';
import { Maximize2, Heart } from 'lucide-react';
import { requestAppFullscreen, isAppFullscreen } from './utils/fullscreen.ts';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Application Views
  const [currentTab, setCurrentTab] = useState<AppTab>('challenges');

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
    hasStarted?: boolean;
    startedAt?: number;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('ctf_team_data');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Ready To Start Pre-Competition Gate (restored from saved team state)
  const [isReadyToStart, setIsReadyToStart] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ctf_team_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(parsed.hasStarted);
      }
    } catch {}
    return false;
  });

  // 10-Strike Security Telemetry State
  const [focusBannerWarning, setFocusBannerWarning] = useState<{ strikes: number; reason: string } | null>(null);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [disqualifiedReason, setDisqualifiedReason] = useState<string | undefined>();

  // Dynamic Matrix Rain Speed State
  const [matrixSpeed, setMatrixSpeed] = useState<number>(() => {
    const saved = localStorage.getItem('ctf_matrix_speed');
    return saved ? parseFloat(saved) : 1.0;
  });

  // Auth & Admin Tokens (Option 2: Strict In-Memory Admin Session, Never Auto-Remembered)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isAdminRouteActive, setIsAdminRouteActive] = useState<boolean>(false);
  const [hasDemoTeams, setHasDemoTeams] = useState<boolean>(false);

  // Modals & Artifact Viewers
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<any>(null);
  const [activeWriteupChallenge, setActiveWriteupChallenge] = useState<PublicChallengeView | null>(null);
  const [activeArtifactChallengeId, setActiveArtifactChallengeId] = useState<string | null>(null);

  // Standalone Artifact Viewer Tab Routing (/viewer/:challengeId)
  const [standaloneViewerChallengeId, setStandaloneViewerChallengeId] = useState<string | null>(() => {
    const path = window.location.pathname || '';
    const match = path.match(/^\/viewer\/([^/?#]+)/);
    if (match) return decodeURIComponent(match[1]);
    const hash = window.location.hash || '';
    const hashMatch = hash.match(/^#\/viewer\/([^/?#]+)/);
    if (hashMatch) return decodeURIComponent(hashMatch[1]);
    return null;
  });

  useEffect(() => {
    const checkViewerRoute = () => {
      const path = window.location.pathname || '';
      const match = path.match(/^\/viewer\/([^/?#]+)/);
      if (match) {
        setStandaloneViewerChallengeId(decodeURIComponent(match[1]));
        return;
      }
      const hash = window.location.hash || '';
      const hashMatch = hash.match(/^#\/viewer\/([^/?#]+)/);
      if (hashMatch) {
        setStandaloneViewerChallengeId(decodeURIComponent(hashMatch[1]));
        return;
      }
      setStandaloneViewerChallengeId(null);
    };

    window.addEventListener('popstate', checkViewerRoute);
    window.addEventListener('hashchange', checkViewerRoute);
    return () => {
      window.removeEventListener('popstate', checkViewerRoute);
      window.removeEventListener('hashchange', checkViewerRoute);
    };
  }, []);

  // Ensure no stale blackout curtain or classes remain from previous sessions / hot-reloads
  useEffect(() => {
    try {
      document.documentElement.classList.remove('drm-blackout-active');
      document.body.classList.remove('drm-blackout-active');
      document.body.style.backgroundColor = '';
      document.documentElement.style.backgroundColor = '';
      const curtain = document.getElementById('drm-global-blackout-curtain');
      if (curtain && curtain.parentNode) {
        curtain.parentNode.removeChild(curtain);
      }
    } catch {}
  }, []);

  // Persistent Acknowledged Announcements State (Prevents broadcast banner loop)
  const getAcknowledgedAnnouncementIds = (): string[] => {
    try {
      const raw = localStorage.getItem('ctf_acknowledged_announcements');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const handleDismissAnnouncement = useCallback((id?: string) => {
    const targetId = id || activeAnnouncement?.id;
    if (targetId) {
      try {
        const raw = localStorage.getItem('ctf_acknowledged_announcements');
        const list: string[] = raw ? JSON.parse(raw) : [];
        if (!list.includes(targetId)) {
          list.push(targetId);
          localStorage.setItem('ctf_acknowledged_announcements', JSON.stringify(list));
        }
      } catch (err) {
        console.warn('Failed to persist acknowledged announcement ID:', err);
      }
    }
    setActiveAnnouncement(null);
  }, [activeAnnouncement]);

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
        if (typeof data.competitionState?.matrixRainSpeed === 'number') {
          setMatrixSpeed(data.competitionState.matrixRainSpeed);
        }
        setChallenges(data.challenges);
        setLeaderboard(data.leaderboard);
        setActivityFeed(data.activityFeed);
        if (typeof data.hasDemoTeams === 'boolean') {
          setHasDemoTeams(data.hasDemoTeams);
        }
        if (data.team) {
          setTeam(data.team);
          try {
            localStorage.setItem('ctf_team_data', JSON.stringify(data.team));
          } catch {}
          if (data.team.hasStarted) {
            setIsReadyToStart(true);
          } else {
            localStorage.removeItem('ctf_team_ready_' + data.team.id);
            setIsReadyToStart(false);
          }

          if (data.team.isDisqualified) {
            setIsDisqualified(true);
            setDisqualifiedReason(
              data.team.disqualifiedReason || 'Security policy violation. Session revoked.'
            );
          } else {
            setIsDisqualified(false);
          }
        } else if (token && data.tokenExpired) {
          // Token explicitly revoked or expired by server
          localStorage.removeItem('ctf_team_token');
          localStorage.removeItem('ctf_team_data');
          setTeam(null);
          setIsReadyToStart(false);
        }
        if (data.competitionState.announcement) {
          const ann = data.competitionState.announcement;
          const acknowledged = getAcknowledgedAnnouncementIds();
          if (ann.id && !acknowledged.includes(ann.id)) {
            setActiveAnnouncement(ann);
          } else {
            setActiveAnnouncement(null);
          }
        } else {
          setActiveAnnouncement(null);
        }
      }
    } catch (err) {
      console.error('Failed to sync initial state:', err);
    }
  }, []);

  // Unified Admin Session Detection: Administrators are officials and must NEVER be proctored or warned
  const isAdminSession = Boolean(
    adminToken ||
    currentTab === 'admin' ||
    isAdminRouteActive ||
    (typeof window !== 'undefined' && (
      window.location.pathname.toLowerCase().includes('secret') ||
      window.location.pathname.toLowerCase().includes('portal-auth') ||
      window.location.hash.toLowerCase().includes('secret') ||
      window.location.hash.toLowerCase().includes('portal-auth')
    ))
  );

  // Clear any student proctoring warnings immediately if viewing admin portal
  useEffect(() => {
    if (currentTab === 'admin') {
      setFocusBannerWarning(null);
    }
  }, [currentTab]);

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
      if (data.challenges && Array.isArray(data.challenges)) setChallenges(data.challenges);
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      if (data.activityFeed) setActivityFeed(data.activityFeed);
    });

    s.on('state_update', (data) => {
      if (data.competitionState) setCompetitionState(data.competitionState);
      if (data.challenges && Array.isArray(data.challenges)) setChallenges(data.challenges);
      if (data.leaderboard) setLeaderboard(data.leaderboard);
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
          setFocusBannerWarning(null);
        }
        return current;
      });
    });

    s.on('team:reset_ready', (evt: { teamId: string }) => {
      setTeam((current) => {
        if (current && current.id === evt.teamId) {
          localStorage.removeItem('ctf_team_ready_' + current.id);
          setIsReadyToStart(false);
        }
        return current;
      });
      fetchState();
    });

    s.on('team:updated', (updatedTeam: any) => {
      setTeam((current) => {
        if (current && current.id === updatedTeam.id) {
          try {
            localStorage.setItem('ctf_team_data', JSON.stringify(updatedTeam));
          } catch {}
          return updatedTeam;
        }
        return current;
      });
      fetchState();
    });

    s.on('team:strikes_reset', (evt: { teamId: string }) => {
      setTeam((current) => {
        if (current && current.id === evt.teamId) {
          const updated = { ...current, strikes: 0, isDisqualified: false };
          try {
            localStorage.setItem('ctf_team_data', JSON.stringify(updated));
          } catch {}
          return updated;
        }
        return current;
      });
      setFocusBannerWarning(null);
      fetchState();
    });

    s.on('announcement_broadcast', (announcement) => {
      if (!announcement) return;
      const acked = getAcknowledgedAnnouncementIds();
      if (announcement.id && acked.includes(announcement.id)) {
        return;
      }
      setActiveAnnouncement(announcement);
      playSuccessChime();
    });

    s.on('announcement_cleared', () => {
      setActiveAnnouncement(null);
    });

    s.on('competition_ended', () => {
      fetchState();
    });

    s.on('competition_reset', () => {
      localStorage.removeItem('ctf_team_token');
      try {
        const allKeys = Object.keys(localStorage);
        allKeys.forEach((k) => {
          if (k.startsWith('ctf_team_ready_')) {
            localStorage.removeItem(k);
          }
        });
      } catch {}
      setTeam(null);
      setIsReadyToStart(false);
      setIsDisqualified(false);
      setFocusBannerWarning(null);
      fetchState();
    });

    s.on('matrix_speed_updated', (data: { speed: number }) => {
      if (typeof data?.speed === 'number') {
        setMatrixSpeed(data.speed);
        localStorage.setItem('ctf_matrix_speed', data.speed.toString());
      }
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

  // Handle Team Login / Registration Success
  const handleTeamLoginSuccess = (newTeam: any, token: string) => {
    if (token) {
      localStorage.setItem('ctf_team_token', token);
    }
    if (newTeam) {
      try {
        localStorage.setItem('ctf_team_data', JSON.stringify(newTeam));
      } catch {}
    }
    setTeam(newTeam);
    if (newTeam.hasStarted) {
      setIsReadyToStart(true);
    } else {
      localStorage.removeItem('ctf_team_ready_' + newTeam.id);
      setIsReadyToStart(false);
    }
    setCurrentTab('challenges');
    fetchState();
  };

  // Fullscreen Status Tracking
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => isAppFullscreen());

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(isAppFullscreen());
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Handle Team Logout
  const handleTeamLogout = () => {
    if (team) {
      localStorage.removeItem('ctf_team_ready_' + team.id);
    }
    localStorage.removeItem('ctf_team_token');
    localStorage.removeItem('ctf_team_data');
    setTeam(null);
    setIsReadyToStart(false);
    setFocusBannerWarning(null);
    fetchState();
  };

  // Explicit Opt-in: READY TO START (Automatically transitions to Fullscreen)
  const handleConfirmReady = async () => {
    if (!team) return;
    try {
      await requestAppFullscreen();
    } catch (e) {
      console.warn('Auto fullscreen on ready error:', e);
    }

    try {
      const token = localStorage.getItem('ctf_team_token');
      await fetch('/api/team/ready', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (e) {
      console.warn('Ready sync error:', e);
    }
    localStorage.setItem('ctf_team_ready_' + team.id, 'true');
    setIsReadyToStart(true);
    fetchState();
  };

  // Stealth Secret Admin Route Detection (Option 2: Strict Password Prompt Every Visit)

  useEffect(() => {
    // Purge any lingering stored tokens for strict zero-remembering
    localStorage.removeItem('ctf_admin_token');

    const checkAdminRoute = () => {
      const path = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();

      // Activates on the secret route (or /secret alias)
      const isMatch =
        path.includes('portal-auth-ctrl-8f9b2') ||
        hash.includes('portal-auth-ctrl-8f9b2') ||
        path.includes('secret') ||
        hash.includes('secret');

      if (isMatch) {
        setIsAdminRouteActive(true);
        // Strict Option 2: Always prompt for the Master Admin password every time the secret link is visited!
        if (!adminToken) {
          setIsAdminLoginModalOpen(true);
        } else {
          setCurrentTab('admin');
        }
      } else {
        if (!adminToken) {
          setIsAdminRouteActive(false);
        }
      }
    };

    checkAdminRoute();
    window.addEventListener('popstate', checkAdminRoute);
    window.addEventListener('hashchange', checkAdminRoute);

    // Stealth Admin Hotkey: Ctrl+Shift+G (Primary) opens the master admin password prompt from anywhere
    const handleAdminHotKey = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const keyLower = e.key ? e.key.toLowerCase() : '';
      const code = e.code || '';

      const isMatch =
        (isCtrlOrMeta && isShift && (keyLower === 'g' || code === 'KeyG' || keyLower === 'a' || code === 'KeyA')) ||
        (e.altKey && (keyLower === 'g' || code === 'KeyG' || keyLower === 'a' || code === 'KeyA'));

      if (isMatch) {
        e.preventDefault();
        e.stopPropagation();
        setIsAdminRouteActive(true);
        setIsAdminLoginModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleAdminHotKey, true);

    return () => {
      window.removeEventListener('popstate', checkAdminRoute);
      window.removeEventListener('hashchange', checkAdminRoute);
      window.removeEventListener('keydown', handleAdminHotKey, true);
    };
  }, [adminToken]);

  // Admin Operator Display Name
  const [adminOperatorName, setAdminOperatorName] = useState<string>('Rabum Alal');

  // Handle Admin Login Success (Session-Only Unified Routing)
  const handleAdminLoginSuccess = (token: string, adminName?: string) => {
    setAdminToken(token);
    if (adminName) setAdminOperatorName(adminName);
    setIsAdminRouteActive(false);
    setCurrentTab('admin');
    fetchState();
  };

  // Handle Admin Logout
  const handleAdminLogout = () => {
    localStorage.removeItem('ctf_admin_token');
    setAdminToken(null);
    setIsAdminRouteActive(false);
    window.history.pushState({}, '', '/');
    setCurrentTab('challenges');
  };

  // If navigating directly to a dedicated artifact viewer tab under the same domain
  if (standaloneViewerChallengeId) {
    return (
      <div className="min-h-screen bg-[#07090e]/80 text-[#e2e8f0] relative flex flex-col font-sans selection:bg-[#00ff66]/30 selection:text-[#00ff66]">
        {/* Global Binary Digit Rain Animated Canvas */}
        <BinaryRainBackground speed={matrixSpeed} />
        <StandaloneArtifactViewer
          challengeId={standaloneViewerChallengeId}
          onBack={() => {
            window.history.pushState({}, '', '/');
            setStandaloneViewerChallengeId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e]/80 text-[#e2e8f0] relative flex flex-col font-sans selection:bg-[#00ff66]/30 selection:text-[#00ff66]">
      {/* Global Binary Digit Rain Animated Canvas */}
      <BinaryRainBackground speed={matrixSpeed} />

      {/* CRT Scanline Background Effect */}
      <div className="fixed inset-0 scanline pointer-events-none z-10 opacity-30" />

      {/* Cyberpunk Grid Background */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.025]" />

      {/* Security Anti-Cheat Guard (Engaged STRICTLY after a squad clicks [ START COMPETITION ] - Never on login or landing page) */}
      {Boolean(team && isReadyToStart && !isDisqualified && !isAdminSession && currentTab !== 'admin') && (
        <SecurityGuard
          teamLoggedIn={true}
          team={team}
          isAdmin={false}
          isReadyToStart={true}
          isViewingArtifact={Boolean(activeArtifactChallengeId || standaloneViewerChallengeId)}
          onStrikeTriggered={(strikes, _disq, reason) => {
            // Automated screenshot/incident strikes NEVER disqualify.
            // Disqualification is strictly reserved for Administrator manual arbitration.
            if (strikes > 0) {
              setFocusBannerWarning({ strikes, reason });
              fetchState();
            }
          }}
        />
      )}

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
        isAdminAuthenticated={isAdminSession}
        isConnected={isConnected}
        adminOperatorName={adminOperatorName}
        isReadyToStart={isReadyToStart}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative">
        {/* Stealth Admin Gateway: Active Only When Navigating to Secret Route */}
        {isAdminRouteActive && !adminToken ? (
          <div className="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-[#0d111a]/95 border-2 border-amber-500/70 shadow-[0_0_50px_rgba(245,158,11,0.25)] font-mono text-xs animate-fadeIn backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-bold tracking-wider">RESTRICTED ZONE // SECRET ACCESS GATEWAY</span>
            </div>
            <h2 className="text-xl font-black text-white mb-2">MASTER ADMIN AUTHENTICATION</h2>
            <p className="text-slate-400 font-sans text-xs mb-6">
              Organizers access only. Authenticate with the master arbitration passkey to access command controls, timer management, and real-time telemetry.
            </p>
            <button
              onClick={() => setIsAdminLoginModalOpen(true)}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2"
            >
              <span>ENTER MASTER PASSKEY</span>
            </button>
          </div>
        ) : (
          <>
            {currentTab === 'challenges' && (
              <>
                {!team ? (
                  /* Primary Entry: Registration & Signup Portal First */
                  <LandingPortal
                    onSuccess={handleTeamLoginSuccess}
                    onAdminSuccess={handleAdminLoginSuccess}
                    onExploreScoreboard={() => setCurrentTab('leaderboard')}
                  />
                ) : !isReadyToStart ? (
                  /* Pre-Competition Gate: Explicit Opt-In Before Challenges Render */
                  <PreCompetitionGate
                    teamName={team.teamName}
                    members={team.members}
                    totalChallengesCount={challenges.length}
                    totalPointsPool={challenges.reduce((acc, c) => acc + c.points, 0)}
                    remainingSeconds={competitionState.remainingSeconds}
                    onConfirmReady={handleConfirmReady}
                  />
                ) : (
                  /* Challenge Marketplace: Active Only After [ READY TO START ] */
                  <ChallengeSection
                    challenges={challenges}
                    teamLoggedIn={Boolean(team)}
                    onOpenAuthModal={() => setIsAuthModalOpen(true)}
                    onViewWriteup={(chal) => setActiveWriteupChallenge(chal)}
                    onRefreshState={fetchState}
                    onViewArtifact={(chalId) => setActiveArtifactChallengeId(chalId)}
                  />
                )}
              </>
            )}

            {currentTab === 'rules' && (
              <PreCompetitionGate
                teamName={team?.teamName}
                members={team?.members}
                totalChallengesCount={challenges.length}
                totalPointsPool={challenges.reduce((acc, c) => acc + c.points, 0)}
                remainingSeconds={competitionState.remainingSeconds}
                hasStarted={Boolean(team?.hasStarted || isReadyToStart)}
                onConfirmReady={handleConfirmReady}
                onNavigateToChallenges={() => setCurrentTab('challenges')}
              />
            )}

            {currentTab === 'leaderboard' && (
              <Leaderboard
                entries={leaderboard}
                currentTeamId={team?.id}
                hasDemoTeams={hasDemoTeams}
                isAdmin={Boolean(adminToken)}
                onToggleDemoMode={async (mode) => {
                  const res = await fetch('/api/scoreboard/mode', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(adminToken ? { 'x-admin-token': adminToken } : {}),
                    },
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

            {currentTab === 'feedback' && (
              <FeedbackSection
                team={team}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
              />
            )}

            {currentTab === 'profile' && (
              <ProfileView
                team={team}
                challenges={challenges}
                leaderboard={leaderboard}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
                onLogoutTeam={handleTeamLogout}
              />
            )}

            {currentTab === 'admin' && adminToken && (
              <AdminPortal
                adminToken={adminToken}
                competitionState={competitionState}
                onRefreshState={fetchState}
                onLogoutAdmin={handleAdminLogout}
                adminOperatorName={adminOperatorName}
                socket={socket}
              />
            )}
          </>
        )}
      </main>

      {/* Global Footer */}
      <footer className="border-t border-slate-900 bg-[#05070a] py-6 relative z-20 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span className="text-[#00ff66] font-bold">THE FINAL DECRYPT</span>
            <span>·</span>
            <span>ROUND 2: NO CLUE, NO MERCY</span>
            <span className="hidden sm:inline">·</span>
            <span className="text-cyan-400 font-medium inline-flex items-center gap-1.5">
              <span>Developed with</span>
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
              <span>by IEEE NMIET RAS Developer Team</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
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
        onAdminSuccess={handleAdminLoginSuccess}
      />

      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => {
          setIsAdminLoginModalOpen(false);
          if (isAdminRouteActive && !adminToken) {
            setIsAdminRouteActive(false);
            window.history.pushState({}, '', '/');
            setCurrentTab('challenges');
          }
        }}
        onSuccess={handleAdminLoginSuccess}
      />

      <AnnouncementModal
        announcement={activeAnnouncement}
        onDismiss={handleDismissAnnouncement}
      />

      <WriteupModal
        challenge={activeWriteupChallenge}
        onClose={() => setActiveWriteupChallenge(null)}
      />

      {/* Interactive In-Browser Artifact Display System */}
      <ArtifactViewerModal
        challengeId={activeArtifactChallengeId}
        onClose={() => setActiveArtifactChallengeId(null)}
      />

      {/* Non-intrusive Screenshot Warning Banner for Students (Auto-dismisses in 7s) */}
      {focusBannerWarning && !isDisqualified && currentTab !== 'admin' && (
        <StrikeWarningBanner
          strikes={focusBannerWarning.strikes}
          reason={focusBannerWarning.reason}
          onDismiss={() => setFocusBannerWarning(null)}
        />
      )}

      {/* Permanent Disqualification Lockdown Screen (Student Only) */}
      {isDisqualified && !isAdminSession && (
        <DisqualificationScreen
          teamName={team?.teamName}
          reason={disqualifiedReason}
          onLogout={handleTeamLogout}
        />
      )}
    </div>
  );
}
