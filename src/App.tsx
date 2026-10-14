import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { TopThreePodiumModal } from './components/TopThreePodiumModal.tsx';
import { LeaderboardTopThreePreview } from './components/LeaderboardTopThreePreview.tsx';
import { RocketLaunchModal } from './components/RocketLaunchModal.tsx';
import { CompetitionEndedDashboard } from './components/CompetitionEndedDashboard.tsx';
import { playSuccessChime, playCyberBlip, playClockTick, playCompetitionOverSound } from './utils/audio.ts';
import { Maximize2, Heart, Lock, ArrowRight, UserPlus, BookOpen, Trophy } from 'lucide-react';
import { requestAppFullscreen, isAppFullscreen } from './utils/fullscreen.ts';

function GuestRestrictedTabCard({
  title,
  description,
  onOpenAuthModal,
  onNavigateToRules,
  onNavigateToLeaderboard,
}: {
  title: string;
  description: string;
  onOpenAuthModal: () => void;
  onNavigateToRules: () => void;
  onNavigateToLeaderboard: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto my-12 p-6 sm:p-10 rounded-3xl bg-[#080e18]/90 border border-slate-800 text-center font-mono space-y-5 shadow-[0_0_50px_rgba(0,255,65,0.1)] animate-fadeIn relative overflow-hidden backdrop-blur-xl">
      <div className="absolute top-0 left-1/4 right-1/4 h-1 bg-gradient-to-r from-transparent via-[#00ff41] to-transparent shadow-[0_0_20px_#00ff41]" />

      <div className="w-16 h-16 mx-auto rounded-2xl bg-[#00ff41]/10 border border-[#00ff41]/40 flex items-center justify-center text-[#00ff41] shadow-[0_0_25px_rgba(0,255,65,0.2)]">
        <Lock className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00ff41]/10 border border-[#00ff41]/30 text-[#00ff41] text-[10px] font-bold uppercase tracking-widest">
          <span>SQUAD AUTHENTICATION REQUIRED</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 font-sans max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={() => {
            playCyberBlip(800);
            onOpenAuthModal();
          }}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00ff41] hover:bg-[#00ff41]/90 text-black font-black uppercase text-xs tracking-wider shadow-[0_0_25px_rgba(0,255,65,0.4)] transition-all cursor-pointer inline-flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4 text-black" />
          <span>SIGN UP / LOG IN SQUAD</span>
        </button>

        <button
          onClick={() => {
            playCyberBlip(750);
            onNavigateToRules();
          }}
          className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold uppercase text-xs tracking-wider transition-all cursor-pointer inline-flex items-center justify-center gap-2"
        >
          <BookOpen className="w-4 h-4 text-[#00ff41]" />
          <span>RULES & INFO</span>
        </button>

        <button
          onClick={() => {
            playCyberBlip(750);
            onNavigateToLeaderboard();
          }}
          className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold uppercase text-xs tracking-wider transition-all cursor-pointer inline-flex items-center justify-center gap-2"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>LEADERBOARD</span>
        </button>
      </div>
    </div>
  );
}

function FeedbackLockedCard({
  onNavigateToChallenges,
  onNavigateToLeaderboard,
}: {
  onNavigateToChallenges: () => void;
  onNavigateToLeaderboard: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto my-12 p-6 sm:p-10 rounded-3xl bg-[#080e18]/90 border border-amber-500/40 text-center font-mono space-y-5 shadow-[0_0_50px_rgba(245,158,11,0.15)] animate-fadeIn relative overflow-hidden backdrop-blur-xl">
      <div className="absolute top-0 left-1/4 right-1/4 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_20px_#f59e0b]" />

      <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
        <Lock className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          <span>COMPETITION IN PROGRESS - ACCESS RESTRICTED</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
          FEEDBACK FORM LOCKED
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 font-sans max-w-md mx-auto leading-relaxed">
          The feedback evaluation form is locked during live competition hours. It will automatically unlock for all participating squads once the event is complete and the admin concludes the tournament.
        </p>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={() => {
            playCyberBlip(800);
            onNavigateToChallenges();
          }}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00ff41] hover:bg-[#00ff41]/90 text-black font-black uppercase text-xs tracking-wider shadow-[0_0_25px_rgba(0,255,65,0.4)] transition-all cursor-pointer inline-flex items-center justify-center gap-2"
        >
          <span>RETURN TO CHALLENGES</span>
        </button>

        <button
          onClick={() => {
            playCyberBlip(750);
            onNavigateToLeaderboard();
          }}
          className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold uppercase text-xs tracking-wider transition-all cursor-pointer inline-flex items-center justify-center gap-2"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>LEADERBOARD</span>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Application Views
  const [currentTab, setCurrentTab] = useState<AppTab>('challenges');

  // Mandatory Post-Event Feedback Submission Gate
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState<boolean>(() => {
    try {
      localStorage.removeItem('ctf_feedback_submitted');
      const teamData = localStorage.getItem('ctf_team_data');
      if (teamData) {
        const parsed = JSON.parse(teamData);
        if (parsed?.id && localStorage.getItem('ctf_feedback_submitted_' + parsed.id) === 'true') {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  });

  // Victory Ceremony & Final Podium Modal
  const [showRocketLaunch, setShowRocketLaunch] = useState(false);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [topThreeData, setTopThreeData] = useState<LeaderboardEntry[]>([]);

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

  // Auto-close writeup modal on user side when admin locks writeups
  useEffect(() => {
    if (!competitionState.writeupMode) {
      setActiveWriteupChallenge(null);
    }
  }, [competitionState.writeupMode]);

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
        if (data.competitionState?.status === 'ended' && data.leaderboard) {
          const top3 = data.leaderboard.slice(0, 3);
          setTopThreeData(top3);
          const shown = sessionStorage.getItem('ctf_podium_shown');
          if (shown !== 'true') {
            setShowRocketLaunch(true);
            sessionStorage.setItem('ctf_podium_shown', 'true');
          }
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

        // Check if current participant has already submitted feedback
        if (token) {
          fetch('/api/feedback/my', { headers })
            .then((r) => r.json())
            .then((d) => {
              if (d?.feedback) {
                setHasSubmittedFeedback(true);
                if (data.team?.id) {
                  try {
                    localStorage.setItem('ctf_feedback_submitted_' + data.team.id, 'true');
                  } catch {}
                }
              } else {
                setHasSubmittedFeedback(false);
                if (data.team?.id) {
                  try {
                    localStorage.removeItem('ctf_feedback_submitted_' + data.team.id);
                  } catch {}
                }
              }
            })
            .catch(() => {});
        } else {
          setHasSubmittedFeedback(false);
        }
      }
    } catch (err) {
      console.error('Failed to sync initial state:', err);
    }
  }, []);

  const handleFeedbackSubmittedSuccess = useCallback(() => {
    setHasSubmittedFeedback(true);
    const teamData = localStorage.getItem('ctf_team_data');
    try {
      const parsed = teamData ? JSON.parse(teamData) : null;
      if (parsed?.id) {
        localStorage.setItem('ctf_feedback_submitted_' + parsed.id, 'true');
      }
    } catch {}
  }, []);

  const handleUnlockAndShowDashboard = useCallback(() => {
    setHasSubmittedFeedback(true);
    const teamData = localStorage.getItem('ctf_team_data');
    try {
      const parsed = teamData ? JSON.parse(teamData) : null;
      if (parsed?.id) {
        localStorage.setItem('ctf_feedback_submitted_' + parsed.id, 'true');
      }
    } catch {}
    setCurrentTab('leaderboard');
    const token = localStorage.getItem('ctf_team_token');
    fetch('/api/post-event/viewed', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }).catch(() => {});
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

  // Ref to debounce ticking sound to exactly once per second
  const lastTickSecondRef = useRef<number | null>(null);

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
      if (data.competitionState) {
        setCompetitionState(data.competitionState);
        if (!data.competitionState.writeupMode) {
          setActiveWriteupChallenge(null);
        }
      }
      if (data.challenges && Array.isArray(data.challenges)) setChallenges(data.challenges);
      if (data.leaderboard) setLeaderboard(data.leaderboard);
    });

    s.on('writeup_mode_changed', (payload: { writeupMode: boolean }) => {
      setCompetitionState((prev) => ({ ...prev, writeupMode: payload.writeupMode }));
      if (!payload.writeupMode) {
        setActiveWriteupChallenge(null);
        setChallenges((prev) => prev.map((c) => ({ ...c, writeup: undefined })));
      }
      fetchState();
    });

    s.on('timer_tick', (tick) => {
      // Authentic mechanical clock ticking sound during the final 60 seconds
      if (
        tick.status === 'running' &&
        typeof tick.remainingSeconds === 'number' &&
        tick.remainingSeconds <= 60 &&
        tick.remainingSeconds > 0
      ) {
        if (lastTickSecondRef.current !== tick.remainingSeconds) {
          lastTickSecondRef.current = tick.remainingSeconds;
          playClockTick(tick.remainingSeconds);
        }
      }

      setCompetitionState((prev) => {
        const nextMode = tick.writeupMode ?? prev.writeupMode;
        if (!nextMode) {
          setActiveWriteupChallenge(null);
        }
        return {
          ...prev,
          status: tick.status,
          remainingSeconds: tick.remainingSeconds,
          writeupMode: nextMode,
        };
      });
    });

    s.on('leaderboard_update', (newLeaderboard: LeaderboardEntry[]) => {
      setLeaderboard(newLeaderboard);
    });

    s.on('competition_ended', (data: { top3?: LeaderboardEntry[]; finalStandings?: LeaderboardEntry[] }) => {
      if (data?.finalStandings) setLeaderboard(data.finalStandings);
      if (data?.top3) setTopThreeData(data.top3);
      playCompetitionOverSound();
      fetchState();

      // Launch rocket animation first; onComplete triggers victory top 3 podium
      setShowVictoryModal(false);
      setShowRocketLaunch(true);
      sessionStorage.setItem('ctf_podium_shown', 'true');
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

    s.on('competition_reset', () => {
      sessionStorage.removeItem('ctf_podium_shown');
      setShowRocketLaunch(false);
      setShowVictoryModal(false);
      localStorage.removeItem('ctf_team_token');
      localStorage.removeItem('ctf_team_data');
      localStorage.removeItem('ctf_feedback_submitted');
      try {
        const allKeys = Object.keys(localStorage);
        allKeys.forEach((k) => {
          if (k.startsWith('ctf_team_ready_') || k.startsWith('ctf_feedback_submitted')) {
            localStorage.removeItem(k);
          }
        });
      } catch {}
      setTeam(null);
      setIsReadyToStart(false);
      setIsDisqualified(false);
      setHasSubmittedFeedback(false);
      setFocusBannerWarning(null);
      fetchState();
    });

    s.on('feedbacks_cleared', () => {
      setHasSubmittedFeedback(false);
      try {
        const allKeys = Object.keys(localStorage);
        allKeys.forEach((k) => {
          if (k.startsWith('ctf_feedback_submitted')) {
            localStorage.removeItem(k);
          }
        });
      } catch {}
      fetchState();
    });

    s.on('matrix_speed_updated', (data: { speed: number }) => {
      if (typeof data?.speed === 'number') {
        setMatrixSpeed(data.speed);
        localStorage.setItem('ctf_matrix_speed', data.speed.toString());
      }
    });

    s.on('state_update', (data?: any) => {
      if (data) {
        if (data.competitionState) setCompetitionState(data.competitionState);
        if (data.leaderboard) setLeaderboard(data.leaderboard);
        if (data.challenges) setChallenges(data.challenges);
      } else {
        fetchState();
      }
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
    setHasSubmittedFeedback(newTeam?.id ? localStorage.getItem('ctf_feedback_submitted_' + newTeam.id) === 'true' : false);
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
      localStorage.removeItem('ctf_feedback_submitted_' + team.id);
    }
    localStorage.removeItem('ctf_team_token');
    localStorage.removeItem('ctf_team_data');
    localStorage.removeItem('ctf_feedback_submitted');
    setTeam(null);
    setIsReadyToStart(false);
    setHasSubmittedFeedback(false);
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
              <span className="font-bold tracking-wider">RESTRICTED ZONE: SECRET ACCESS GATEWAY</span>
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
                {competitionState.status === 'ended' ? (
                  !hasSubmittedFeedback && !adminToken ? (
                    <FeedbackSection
                      team={team}
                      isMandatoryIntermission={true}
                      onOpenAuthModal={() => setIsAuthModalOpen(true)}
                      onUnlockFinalDashboard={handleUnlockAndShowDashboard}
                      onFeedbackSubmitted={handleFeedbackSubmittedSuccess}
                    />
                  ) : (
                    <CompetitionEndedDashboard
                      leaderboard={leaderboard}
                      currentTeam={team}
                      writeupMode={Boolean(competitionState.writeupMode)}
                      onReplayRocketLaunch={() => setShowRocketLaunch(true)}
                      onOpenWriteupPortal={() => {
                        if (!competitionState.writeupMode) return;
                        const available = challenges.filter((c) => Boolean(c.writeup));
                        if (available.length > 0) {
                          setActiveWriteupChallenge(available[0]);
                        }
                      }}
                    />
                  )
                ) : !team ? (
                  /* Primary Entry: Registration & Signup Portal First */
                  <LandingPortal
                    onSuccess={handleTeamLoginSuccess}
                    onAdminSuccess={handleAdminLoginSuccess}
                    onExploreScoreboard={() => setCurrentTab('leaderboard')}
                  />
                ) : (competitionState.status !== 'running' && !adminToken) || !isReadyToStart ? (
                  /* Pre-Competition Gate: Explicit Opt-In Before Challenges Render & Holds Teams Until Admin Starts */
                  <PreCompetitionGate
                    teamName={team.teamName}
                    members={team.members}
                    totalChallengesCount={challenges.length}
                    totalPointsPool={challenges.reduce((acc, c) => acc + c.points, 0)}
                    remainingSeconds={competitionState.remainingSeconds}
                    competitionStatus={competitionState.status}
                    hasStarted={Boolean((team.hasStarted || isReadyToStart) && competitionState.status === 'running')}
                    onConfirmReady={handleConfirmReady}
                    onNavigateToChallenges={() => setCurrentTab('challenges')}
                    onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  />
                ) : (
                  /* Challenge Marketplace: Active Only After [ READY TO START ] AND Admin Has Started */
                  <ChallengeSection
                    challenges={challenges}
                    teamLoggedIn={Boolean(team)}
                    currentTeamName={team?.teamName}
                    isLockedOrEnded={competitionState.remainingSeconds <= 0}
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
                competitionStatus={competitionState.status}
                hasStarted={Boolean((team?.hasStarted || isReadyToStart) && competitionState.status === 'running')}
                onConfirmReady={handleConfirmReady}
                onNavigateToChallenges={() => setCurrentTab('challenges')}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
              />
            )}

            {currentTab === 'leaderboard' && (
              competitionState.status === 'ended' && !hasSubmittedFeedback && !adminToken ? (
                <LeaderboardTopThreePreview
                  top3={topThreeData.length > 0 ? topThreeData : leaderboard.slice(0, 3)}
                  totalTeams={leaderboard.length}
                  onProceedToFeedback={() => {
                    playCyberBlip(800);
                    setCurrentTab('feedback');
                  }}
                />
              ) : competitionState.status === 'ended' ? (
                <CompetitionEndedDashboard
                  leaderboard={leaderboard}
                  currentTeam={team}
                  writeupMode={Boolean(competitionState.writeupMode)}
                  onReplayRocketLaunch={() => setShowRocketLaunch(true)}
                  onOpenWriteupPortal={() => {
                    if (!competitionState.writeupMode) return;
                    const available = challenges.filter((c) => Boolean(c.writeup));
                    if (available.length > 0) {
                      setActiveWriteupChallenge(available[0]);
                    }
                  }}
                />
              ) : (
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
              )
            )}

            {currentTab === 'activity' && (
              !team && !adminToken ? (
                <GuestRestrictedTabCard
                  title="LIVE FEED: SQUAD LOGIN REQUIRED"
                  description="Real-time decrypt alerts, activity feeds, and tournament solve streams are exclusive to registered participating squads and competition arbitrators."
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  onNavigateToRules={() => setCurrentTab('rules')}
                  onNavigateToLeaderboard={() => setCurrentTab('leaderboard')}
                />
              ) : (
                <ActivityFeed events={activityFeed} />
              )
            )}

            {currentTab === 'feedback' && (
              competitionState.status !== 'ended' && !adminToken ? (
                <FeedbackLockedCard
                  onNavigateToChallenges={() => setCurrentTab('challenges')}
                  onNavigateToLeaderboard={() => setCurrentTab('leaderboard')}
                />
              ) : !team && !adminToken ? (
                <GuestRestrictedTabCard
                  title="FEEDBACK PORTAL: SQUAD LOGIN REQUIRED"
                  description="Competition feedback evaluations are linked to registered participating squads. Please register your squad or sign in to share your tournament experience."
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  onNavigateToRules={() => setCurrentTab('rules')}
                  onNavigateToLeaderboard={() => setCurrentTab('leaderboard')}
                />
              ) : (
                <FeedbackSection
                  team={team}
                  isMandatoryIntermission={competitionState.status === 'ended' && !hasSubmittedFeedback && !adminToken}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  onUnlockFinalDashboard={handleUnlockAndShowDashboard}
                  onFeedbackSubmitted={handleFeedbackSubmittedSuccess}
                />
              )
            )}

            {currentTab === 'profile' && (
              !team && !adminToken ? (
                <GuestRestrictedTabCard
                  title="SQUAD PROFILE: SQUAD LOGIN REQUIRED"
                  description="Please sign in or register your competing team to access your squad stats, decrypted flags, and token settings."
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  onNavigateToRules={() => setCurrentTab('rules')}
                  onNavigateToLeaderboard={() => setCurrentTab('leaderboard')}
                />
              ) : (
                <ProfileView
                  team={team}
                  challenges={challenges}
                  leaderboard={leaderboard}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  onLogoutTeam={handleTeamLogout}
                />
              )
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
            <span className="text-cyan-400 font-medium inline-flex items-center gap-1.5 flex-wrap">
              <span>Core Developer:</span>
              <span className="text-white font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40 text-cyan-200">Abhirup</span>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span>Secondary Devs:</span>
              <span className="text-slate-300 font-semibold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">Shrikant</span>
              <span>&amp;</span>
              <span className="text-slate-300 font-semibold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">Anuj</span>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span className="text-amber-400">Special Thanks:</span>
              <span className="text-amber-300 font-semibold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40">Tester Sagar</span>
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

      {Boolean(competitionState.writeupMode && activeWriteupChallenge) && (
        <WriteupModal
          isOpen={Boolean(competitionState.writeupMode && activeWriteupChallenge)}
          challenge={activeWriteupChallenge}
          challenges={challenges.filter((c) => Boolean(c.writeup))}
          onSelectChallenge={(c) => setActiveWriteupChallenge(c)}
          onClose={() => setActiveWriteupChallenge(null)}
        />
      )}

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

      {/* Cinematic Rocket Launch Sequence on Event End */}
      <RocketLaunchModal
        isOpen={showRocketLaunch}
        onComplete={() => {
          setShowRocketLaunch(false);
          setShowVictoryModal(true);
        }}
      />

      {/* Victory Podium Modal on Competition End */}
      <TopThreePodiumModal
        isOpen={showVictoryModal}
        onClose={() => {
          setShowVictoryModal(false);
          if (!hasSubmittedFeedback && !adminToken) {
            setCurrentTab('feedback');
          }
        }}
        top3={topThreeData.length > 0 ? topThreeData : leaderboard.slice(0, 3)}
        totalTeams={leaderboard.length}
        hasSubmittedFeedback={hasSubmittedFeedback}
        onReplayRocketLaunch={() => {
          setShowVictoryModal(false);
          setShowRocketLaunch(true);
        }}
        onViewDashboard={() => {
          setShowVictoryModal(false);
          if (!hasSubmittedFeedback && !adminToken) {
            setCurrentTab('feedback');
          } else {
            handleUnlockAndShowDashboard();
          }
        }}
      />
    </div>
  );
}
