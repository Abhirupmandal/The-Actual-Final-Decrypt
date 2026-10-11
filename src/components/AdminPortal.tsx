import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock,
  Play,
  Pause,
  Square,
  RotateCcw,
  Megaphone,
  Download,
  Users,
  User,
  ShieldAlert,
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Key,
  Layers,
  Server,
  Zap,
  Activity,
  Database,
  Camera,
  Scan,
  Mail,
  X,
  Crown,
  Lightbulb,
  UserPlus,
  FileText,
  Eye,
  Flame,
  History,
  Binary,
  Sliders,
  MessageSquareHeart,
  Star,
} from 'lucide-react';
import type {
  Challenge,
  Team,
  SecurityLog,
  ActivityFeedEvent,
  CompetitionState,
  ScreenshotAlert,
  AuditLog,
  FeedbackSubmission,
} from '../types.ts';
import { playCyberBlip, playSuccessChime, playErrorBuzz } from '../utils/audio.ts';

interface AdminPortalProps {
  adminToken: string;
  competitionState: CompetitionState;
  onRefreshState: () => void;
  onLogoutAdmin: () => void;
  adminOperatorName?: string;
  socket?: any;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  adminToken,
  competitionState,
  onRefreshState,
  onLogoutAdmin,
  adminOperatorName,
  socket,
}) => {
  const [activeTab, setActiveTab] = useState<'CONTROLS' | 'CHALLENGES' | 'TEAMS' | 'ACTIVITIES' | 'SCREENSHOTS' | 'AUDIT' | 'FEEDBACK' | 'LOGS'>('CONTROLS');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [screenshotAlerts, setScreenshotAlerts] = useState<ScreenshotAlert[]>([]);
  const [logs, setLogs] = useState<{ securityLogs: SecurityLog[]; activityFeed: ActivityFeedEvent[] }>({
    securityLogs: [],
    activityFeed: [],
  });

  // Dedicated Timestamped Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditActorFilter, setAuditActorFilter] = useState<'ALL' | 'STUDENT' | 'ADMIN' | 'SYSTEM'>('ALL');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  // User Activities Stream Filter & Search
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'SOLVES' | 'FAILS' | 'HINTS' | 'AUTH' | 'ARTIFACTS' | 'SYSTEM'>('ALL');
  const [activitySearchQuery, setActivitySearchQuery] = useState('');

  // Compulsory Teams Roster Search & Filter State
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [teamStatusFilter, setTeamStatusFilter] = useState<'ALL' | 'COMPETING' | 'BRIEFING' | 'AT_RISK' | 'DISQUALIFIED'>('ALL');

  // Valuable User Feedback State
  const [feedbacks, setFeedbacks] = useState<FeedbackSubmission[]>([]);
  const [feedbackSearchQuery, setFeedbackSearchQuery] = useState('');

  // UI Notification & Confirmation Modal States
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [challengeToDelete, setChallengeToDelete] = useState<Challenge | null>(null);
  const [teamToDisqualify, setTeamToDisqualify] = useState<Team | null>(null);
  const [disqualifyReason, setDisqualifyReason] = useState<string>('Disqualified by Administrator Arbitration for competition rule violation.');

  // Master Timer Control Center State
  const [customTimerMinutes, setCustomTimerMinutes] = useState('');
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [restartDurationMinutes, setRestartDurationMinutes] = useState(120);
  const [customRestartInput, setCustomRestartInput] = useState('');

  // Load Balancer & Redis Telemetry
  const [lbData, setLbData] = useState<{
    nodeId: string;
    uptimeSeconds: number;
    clientIp: string;
    trustProxy: boolean;
    teamsConnected: number;
    metrics: {
      connectedToRedis: boolean;
      cacheHits: number;
      cacheMisses: number;
      hitRate: string;
      keysInMemory: number;
      zsetKeysCount?: number;
      memoryUsageMb?: number;
    };
  } | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<{ durationMs: number; opsPerSec: number } | null>(null);

  // Attachment upload error in challenge form
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // Announcement state
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMsg, setAnnouncementMsg] = useState('');

  // Challenge modal / editor
  const [isEditingChallenge, setIsEditingChallenge] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Partial<Challenge>>({
    title: '',
    section: 'Section A (Find the Clue, Find the Key)',
    category: 'CRYPTO',
    points: 150,
    difficulty: 'Medium',
    description: '',
    flag: 'CTF{new_flag}',
    flagFormat: 'CTF{...}',
    maxAttempts: 5,
    hints: [],
  });

  // Score adjustment modal
  const [scoreAdjustTeam, setScoreAdjustTeam] = useState<Team | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');

  const fetchAdminData = async () => {
    try {
      // Challenges
      const chalRes = await fetch('/api/admin/challenges', {
        headers: { 'x-admin-token': adminToken },
      });
      if (chalRes.ok) setChallenges(await chalRes.json());

      // Teams
      const teamsRes = await fetch('/api/admin/teams', {
        headers: { 'x-admin-token': adminToken },
      });
      if (teamsRes.ok) setTeams(await teamsRes.json());

      // Logs
      const logsRes = await fetch('/api/admin/logs', {
        headers: { 'x-admin-token': adminToken },
      });
      if (logsRes.ok) setLogs(await logsRes.json());

      // Load Balancer & Cache Telemetry
      const lbRes = await fetch('/api/admin/loadbalancer/status', {
        headers: { 'x-admin-token': adminToken },
      });
      if (lbRes.ok) setLbData(await lbRes.json());

      // Live Screenshot Alerts
      const ssRes = await fetch('/api/admin/screenshots', {
        headers: { 'x-admin-token': adminToken },
      });
      if (ssRes.ok) setScreenshotAlerts(await ssRes.json());

      // Dedicated Timestamped System-Wide Audit Logs
      const auditRes = await fetch('/api/admin/audit-logs', {
        headers: { 'x-admin-token': adminToken },
      });
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        if (Array.isArray(auditData.logs)) {
          setAuditLogs(auditData.logs);
        }
      }

      // User Feedback Submissions
      const fbRes = await fetch('/api/admin/feedbacks', {
        headers: { 'x-admin-token': adminToken },
      });
      if (fbRes.ok) {
        const fbData = await fbRes.json();
        if (Array.isArray(fbData.feedbacks)) {
          setFeedbacks(fbData.feedbacks);
        }
      }
    } catch (e) {
      console.error('Failed to load admin data', e);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 3500);
    return () => clearInterval(interval);
  }, [adminToken]);

  // Real-time WebSocket Synchronization for Live Teams Roster Feed & Screenshot Alerts
  useEffect(() => {
    if (!socket) return;
    const handleTeamReg = (newTeam: Team) => {
      setTeams((prev) => {
        if (prev.some((t) => t.id === newTeam.id)) {
          return prev.map((t) => (t.id === newTeam.id ? newTeam : t));
        }
        return [newTeam, ...prev];
      });
      playCyberBlip(950);
    };
    const handleTeamUpd = (updatedTeam: Team) => {
      setTeams((prev) =>
        prev.map((t) => (t.id === updatedTeam.id ? updatedTeam : t))
      );
    };

    const handleScreenshotAlert = (alertData: ScreenshotAlert) => {
      playCyberBlip(900);
      setScreenshotAlerts((prev) => [alertData, ...prev.filter((a) => a.id !== alertData.id)]);
    };

    const handleActivityEvent = (act: ActivityFeedEvent) => {
      setLogs((prev) => ({
        ...prev,
        activityFeed: [act, ...prev.activityFeed.filter((a) => a.id !== act.id)].slice(0, 300),
      }));
    };

    const handleNewAuditLog = (newLog: AuditLog) => {
      setAuditLogs((prev) => [newLog, ...prev.filter((l) => l.logId !== newLog.logId)].slice(0, 500));
    };

    const handleSecurityAlert = (secLog: SecurityLog) => {
      setLogs((prev) => ({
        ...prev,
        securityLogs: [secLog, ...prev.securityLogs.filter((l) => l.id !== secLog.id)].slice(0, 300),
      }));
    };

    const handleLogsCleared = () => {
      setLogs((prev) => ({ ...prev, securityLogs: [] }));
    };

    const handleFeedbackReceived = (fb: FeedbackSubmission) => {
      setFeedbacks((prev) => [fb, ...prev.filter((f) => f.id !== fb.id)]);
      playCyberBlip(920);
    };

    socket.on('admin:team_registered', handleTeamReg);
    socket.on('admin:team_updated', handleTeamUpd);
    socket.on('admin:screenshot_alert', handleScreenshotAlert);
    socket.on('admin:feedback_received', handleFeedbackReceived);
    socket.on('activity_event', handleActivityEvent);
    socket.on('audit:new_log', handleNewAuditLog);
    socket.on('security_alert', handleSecurityAlert);
    socket.on('security_logs_cleared', handleLogsCleared);
    return () => {
      socket.off('admin:team_registered', handleTeamReg);
      socket.off('admin:team_updated', handleTeamUpd);
      socket.off('admin:screenshot_alert', handleScreenshotAlert);
      socket.off('admin:feedback_received', handleFeedbackReceived);
      socket.off('activity_event', handleActivityEvent);
      socket.off('audit:new_log', handleNewAuditLog);
      socket.off('security_alert', handleSecurityAlert);
      socket.off('security_logs_cleared', handleLogsCleared);
    };
  }, [socket]);

  // Dismiss Screenshot Alert
  const handleDismissScreenshot = async (id: string) => {
    playCyberBlip(700);
    try {
      await fetch(`/api/admin/screenshots/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken },
      });
      setScreenshotAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.warn('Failed to dismiss screenshot alert:', err);
    }
  };

  // Clear All Screenshot Alerts
  const handleClearAllScreenshots = async () => {
    playCyberBlip(700);
    try {
      await fetch('/api/admin/screenshots', {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken },
      });
      setScreenshotAlerts([]);
      setNotification({ type: 'info', text: 'All screenshot alert logs purged.' });
    } catch (err) {
      console.warn('Failed to clear screenshot alerts:', err);
    }
  };

  // Clear Screenshot Alerts for a Specific Squad
  const handleClearScreenshotsForTeam = async (teamId: string) => {
    playCyberBlip(700);
    const targetAlerts = screenshotAlerts.filter((a) => a.teamId === teamId);
    for (const a of targetAlerts) {
      try {
        await fetch(`/api/admin/screenshots/${a.id}`, {
          method: 'DELETE',
          headers: { 'x-admin-token': adminToken },
        });
      } catch {}
    }
    setScreenshotAlerts((prev) => prev.filter((a) => a.teamId !== teamId));
    setNotification({ type: 'info', text: 'Purged screenshot alerts for selected squad.' });
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Timer Display Formatter (HH:MM:SS)
  const formatTimeFull = (secs: number) => {
    const safeSecs = Math.max(0, secs);
    const h = Math.floor(safeSecs / 3600);
    const m = Math.floor((safeSecs % 3600) / 60);
    const s = safeSecs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Timer Handlers - Full Authority
  const handleTimerAction = async (
    action: 'start' | 'pause' | 'stop' | 'restart' | 'set' | 'add' | 'subtract',
    seconds?: number
  ) => {
    playCyberBlip(800);
    try {
      const res = await fetch('/api/admin/timer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ action, seconds }),
      });
      if (res.ok) {
        playSuccessChime();
        if (action === 'start') {
          setNotification({ type: 'success', text: 'Countdown started / resumed. Submissions active.' });
        } else if (action === 'pause' || action === 'stop') {
          setNotification({ type: 'info', text: 'Countdown stopped / paused. Submissions frozen across all screens.' });
        } else if (action === 'restart') {
          setNotification({
            type: 'success',
            text: `Countdown restarted successfully with ${Math.round((seconds || 7200) / 60)} minutes. Submissions live!`,
          });
        } else if (action === 'set') {
          setNotification({
            type: 'success',
            text: `Countdown timer set to ${Math.round((seconds || 0) / 60)} minutes.`,
          });
        } else if (action === 'add') {
          setNotification({
            type: 'info',
            text: `Added ${Math.round((seconds || 0) / 60)} minutes to countdown timer.`,
          });
        } else if (action === 'subtract') {
          setNotification({
            type: 'info',
            text: `Subtracted ${Math.round((seconds || 0) / 60)} minutes from countdown timer.`,
          });
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setNotification({ type: 'error', text: data.error || 'Failed to update countdown timer.' });
      }
    } catch {
      setNotification({ type: 'error', text: 'Failed to communicate with timer control service.' });
    }
    onRefreshState();
  };

  const handleApplyCustomTime = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(customTimerMinutes.trim(), 10);
    if (isNaN(mins) || mins < 1) {
      setNotification({ type: 'error', text: 'Please enter a valid duration in minutes (at least 1 minute).' });
      return;
    }
    handleTimerAction('set', mins * 60);
    setCustomTimerMinutes('');
  };

  const handleConfirmRestartTimer = () => {
    let mins = restartDurationMinutes;
    if (restartDurationMinutes === -1) {
      mins = parseInt(customRestartInput.trim(), 10);
      if (isNaN(mins) || mins < 1) {
        setNotification({ type: 'error', text: 'Please enter a valid restart duration in minutes.' });
        return;
      }
    }
    setShowRestartModal(false);
    handleTimerAction('restart', mins * 60);
  };

  // Broadcast Announcement
  const handleBroadcastAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementMsg.trim()) return;

    playCyberBlip(1000);
    await fetch('/api/admin/announcement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({
        title: announcementTitle || 'COMMAND HQ BROADCAST',
        message: announcementMsg.trim(),
      }),
    });
    setAnnouncementTitle('');
    setAnnouncementMsg('');
    playSuccessChime();
    setNotification({ type: 'success', text: 'Announcement broadcasted to all participants!' });
    onRefreshState();
    fetchAdminData();
  };

  // Clear / Revoke Broadcast Announcement
  const handleClearAnnouncement = async () => {
    playCyberBlip(700);
    try {
      await fetch('/api/admin/announcement', {
        method: 'DELETE',
        headers: {
          'x-admin-token': adminToken,
        },
      });
      setAnnouncementTitle('');
      setAnnouncementMsg('');
      setNotification({ type: 'info', text: 'Active broadcast stopped and revoked across all participant screens.' });
      onRefreshState();
      fetchAdminData();
    } catch {
      setNotification({ type: 'error', text: 'Failed to revoke active broadcast.' });
    }
  };

  // Writeup Mode Toggle
  const handleToggleWriteupMode = async () => {
    playCyberBlip(800);
    const next = !competitionState.writeupMode;
    await fetch('/api/admin/writeup-mode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ enabled: next }),
    });
    setNotification({
      type: 'info',
      text: next ? 'Writeup Mode enabled! Solutions visible.' : 'Writeup Mode locked.',
    });
    onRefreshState();
  };

  // Competition Reset
  const handleConfirmReset = async () => {
    setShowResetConfirmModal(false);
    playErrorBuzz();
    await fetch('/api/admin/reset', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
    });
    playSuccessChime();
    setNotification({ type: 'success', text: 'Competition state successfully reset.' });
    onRefreshState();
    fetchAdminData();
  };

  // Export CSV (no window.open)
  const handleExportCSV = async () => {
    playCyberBlip(850);
    try {
      const res = await fetch('/api/admin/export-csv', {
        headers: { 'x-admin-token': adminToken },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ctf_final_decrypt_leaderboard_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setNotification({ type: 'success', text: 'Leaderboard CSV exported.' });
    } catch (e) {
      playErrorBuzz();
      setNotification({ type: 'error', text: 'Failed to export CSV.' });
    }
  };

  // Export Complete System-Wide Audit Trail CSV (High-Precision UTC Timestamps)
  const handleExportAuditCSV = async () => {
    playCyberBlip(850);
    try {
      const res = await fetch('/api/admin/export-audit-csv', {
        headers: { 'x-admin-token': adminToken },
      });
      if (!res.ok) throw new Error('Audit export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `the_final_decrypt_audit_trail_utc_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setNotification({ type: 'success', text: 'System audit logs CSV exported successfully.' });
    } catch (e) {
      playErrorBuzz();
      setNotification({ type: 'error', text: 'Failed to export audit logs CSV.' });
    }
  };

  // Save Challenge
  const handleSaveChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    playCyberBlip(800);

    const isExisting = Boolean(editingChallenge.id);
    const url = isExisting
      ? `/api/admin/challenges/${editingChallenge.id}`
      : '/api/admin/challenges';
    const method = isExisting ? 'PUT' : 'POST';

    const payload = {
      ...editingChallenge,
      points: Number(editingChallenge.points) || 100, // Evaluated exactly as admin says
      hints: Array.isArray(editingChallenge.hints)
        ? editingChallenge.hints
            .filter((h) => (h.title && h.title.trim().length > 0) || (h.content && h.content.trim().length > 0))
            .map((h, idx) => ({
              id: h.id || `hint-${Date.now()}-${idx + 1}`,
              title: h.title.trim() || `Hint #${idx + 1}`,
              cost: Math.max(0, Number(h.cost || 0)),
              content: h.content.trim(),
            }))
        : [],
    };

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        playErrorBuzz();
        setNotification({
          type: 'error',
          text: errData.error || 'Failed to save challenge.',
        });
        return;
      }

      setIsEditingChallenge(false);
      fetchAdminData();
      onRefreshState();
      playSuccessChime();
      setNotification({
        type: 'success',
        text: isExisting ? 'Challenge updated in SQLite database.' : 'New challenge saved to SQLite database.',
      });
    } catch {
      playErrorBuzz();
      setNotification({ type: 'error', text: 'Failed to connect to database service.' });
    }
  };

  // Delete Challenge
  const handleConfirmDeleteChallenge = async () => {
    if (!challengeToDelete) return;
    const id = challengeToDelete.id;
    setChallengeToDelete(null);
    playCyberBlip(600);
    await fetch(`/api/admin/challenges/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': adminToken },
    });
    setNotification({ type: 'info', text: 'Challenge deleted.' });
    fetchAdminData();
    onRefreshState();
  };

  // Score Adjust
  const handleConfirmScoreAdjust = async () => {
    if (!scoreAdjustTeam) return;
    playCyberBlip(800);

    await fetch(`/api/admin/teams/${scoreAdjustTeam.id}/adjust-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({
        delta: adjustDelta,
        reason: adjustReason,
      }),
    });

    setScoreAdjustTeam(null);
    setAdjustDelta(0);
    setAdjustReason('');
    fetchAdminData();
    onRefreshState();
  };

  // Unlock Challenge for Team
  const handleUnlockTeamChallenge = async (teamId: string, challengeId: string) => {
    playCyberBlip(800);
    await fetch(`/api/admin/teams/${teamId}/unlock-challenge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ challengeId }),
    });
    fetchAdminData();
    onRefreshState();
  };

  // Clear Anomaly Flag
  const handleClearAnomaly = async (teamId: string) => {
    playCyberBlip(800);
    await fetch(`/api/admin/teams/${teamId}/clear-anomaly`, {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
    });
    fetchAdminData();
    onRefreshState();
  };

  // Clear Strikes & Reinstate Team
  const handleClearStrikes = async (teamId: string) => {
    playCyberBlip(800);
    await fetch(`/api/admin/teams/${teamId}/clear-strikes`, {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
    });
    fetchAdminData();
    onRefreshState();
  };

  // Reset Team Ready / Start Status back to Pre-Competition Gate
  const handleResetTeamReady = async (teamId: string) => {
    playCyberBlip(800);
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/reset-ready`, {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
      });
      const data = await res.json();
      if (res.ok) {
        playSuccessChime();
        setNotification({ type: 'success', text: data.message || 'Squad start status reset to pre-competition gate.' });
      }
    } catch (err) {
      console.error('Failed to reset team ready state:', err);
    }
    fetchAdminData();
    onRefreshState();
  };

  // Reset ALL Teams Start Status back to Pre-Competition Gate
  const handleResetAllTeamsReady = async () => {
    if (!window.confirm('Reset all squads back to the Pre-Competition "START COMPETITION" rules briefing page?')) return;
    playCyberBlip(800);
    try {
      const res = await fetch('/api/admin/teams/reset-all-ready', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
      });
      const data = await res.json();
      if (res.ok) {
        playSuccessChime();
        setNotification({ type: 'success', text: data.message || 'All squads reset back to Pre-Competition Gate.' });
      }
    } catch (err) {
      console.error('Failed to reset all teams ready state:', err);
    }
    fetchAdminData();
    onRefreshState();
  };

  // Clear Strikes for ALL Teams
  const handleClearAllStrikes = async () => {
    if (!window.confirm('Reset strikes and reinstate all penalized teams across the competition?')) return;
    playCyberBlip(800);
    try {
      const res = await fetch('/api/admin/teams/clear-all-strikes', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
      });
      const data = await res.json();
      if (res.ok) {
        playSuccessChime();
        setNotification({ type: 'success', text: data.message || 'Strikes reset for all teams.' });
        fetchAdminData();
        onRefreshState();
      } else {
        playErrorBuzz();
        setNotification({ type: 'error', text: data.error || 'Failed to reset all strikes.' });
      }
    } catch {
      playErrorBuzz();
      setNotification({ type: 'error', text: 'Network error resetting all strikes.' });
    }
  };

  // Disqualify Team
  const handleConfirmDisqualifyTeam = async () => {
    if (!teamToDisqualify) return;
    const teamId = teamToDisqualify.id;
    const teamName = teamToDisqualify.teamName;
    const reason = disqualifyReason.trim() || 'Manual Disqualification by Competition Arbitration';
    setTeamToDisqualify(null);
    playErrorBuzz();
    await fetch(`/api/admin/teams/${teamId}/disqualify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ reason }),
    });
    setNotification({ type: 'info', text: `Team [${teamName}] disqualified: ${reason}` });
    fetchAdminData();
    onRefreshState();
  };

  // Flush Redis Cache
  const handleFlushCache = async () => {
    playCyberBlip(800);
    try {
      const res = await fetch('/api/admin/flush-cache', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
      });
      if (res.ok) {
        playSuccessChime();
        setNotification({ type: 'success', text: 'Redis cache successfully flushed.' });
        fetchAdminData();
      }
    } catch {
      setNotification({ type: 'error', text: 'Failed to flush Redis cache.' });
    }
  };

  // Run Redis Benchmark
  const handleRunBenchmark = async () => {
    playCyberBlip(850);
    setIsBenchmarking(true);
    setBenchmarkResult(null);
    try {
      const res = await fetch('/api/admin/cache/benchmark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ iterations: 150 }),
      });
      const data = await res.json();
      if (data.success && data.benchmark) {
        playSuccessChime();
        setBenchmarkResult(data.benchmark);
        if (data.metrics && lbData) {
          setLbData({ ...lbData, metrics: data.metrics });
        }
        setNotification({
          type: 'success',
          text: `Benchmark complete: ${data.benchmark.opsPerSec.toLocaleString()} ops/sec (${data.benchmark.durationMs}ms)`,
        });
      }
    } catch {
      setNotification({ type: 'error', text: 'Benchmark failed.' });
    } finally {
      setIsBenchmarking(false);
    }
  };

  const [isClearingLogs, setIsClearingLogs] = useState(false);

  const handleClearSecurityLogs = async () => {
    if (!window.confirm('Are you sure you want to purge all security incident logs?')) return;
    setIsClearingLogs(true);
    try {
      const res = await fetch('/api/admin/logs/clear', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
      });
      const data = await res.json();
      if (data.success) {
        setLogs((prev) => ({ ...prev, securityLogs: [] }));
        setNotification({ type: 'success', text: 'Security incident logs successfully purged.' });
        playSuccessChime();
      } else {
        setNotification({ type: 'error', text: data.error || 'Failed to clear security logs.' });
      }
    } catch {
      setNotification({ type: 'error', text: 'Failed to contact server to purge logs.' });
    } finally {
      setIsClearingLogs(false);
    }
  };

  const [matrixSpeed, setMatrixSpeed] = useState<number>(competitionState.matrixRainSpeed ?? 1.0);

  useEffect(() => {
    if (typeof competitionState.matrixRainSpeed === 'number') {
      setMatrixSpeed(competitionState.matrixRainSpeed);
    }
  }, [competitionState.matrixRainSpeed]);

  const handleSetMatrixSpeed = async (newSpeed: number) => {
    const rounded = Math.round(newSpeed * 10) / 10;
    setMatrixSpeed(rounded);
    playCyberBlip(850);
    try {
      const res = await fetch('/api/admin/matrix-speed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ speed: rounded }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'success',
          text: `Matrix rain speed synchronized globally to ${rounded}x.`,
        });
        onRefreshState();
      }
    } catch {
      setNotification({ type: 'error', text: 'Failed to update matrix rain speed.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-lg border font-mono text-xs shadow-lg ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : notification.type === 'error'
              ? 'bg-red-950/80 border-red-500/50 text-red-300'
              : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            {notification.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}
            {notification.type === 'info' && <Zap className="w-4 h-4 text-cyan-400" />}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}



      {/* Top Admin Banner */}
      <div className="rounded-xl bg-[#0f1422] border-2 border-amber-500/40 p-5 sm:p-6 shadow-[0_0_25px_rgba(245,158,11,0.15)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
              <Lock className="w-4 h-4 animate-pulse" />
              <span>ADMIN PORTAL · LOGGED IN AS: {(adminOperatorName || 'ORGANIZER').toUpperCase()}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
              ADMINISTRATION &amp; EVENT CONTROLS
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-sans mt-0.5">
              Full organizer access: manage timer, push instant broadcasts, view screenshot alerts, and manage challenges.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {screenshotAlerts.length > 0 && (
              <button
                onClick={() => {
                  playCyberBlip(700);
                  setActiveTab('SCREENSHOTS');
                }}
                className="px-3.5 py-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/60 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-red-400" />
                <span>SCREENSHOT ALERTS ({screenshotAlerts.length})</span>
              </button>
            )}

            <button
              onClick={handleExportAuditCSV}
              className="px-3.5 py-2 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-[#00e5ff] border border-cyan-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-[0_0_12px_rgba(0,229,255,0.15)]"
              title="Export complete system audit trail with microsecond UTC timestamps"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT AUDIT LOGS CSV</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-[#00ff66] border border-emerald-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT SCOREBOARD CSV</span>
            </button>
            <button
              onClick={onLogoutAdmin}
              className="px-3.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Admin Subtabs */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap gap-2 text-xs font-mono">
          {(['CONTROLS', 'CHALLENGES', 'TEAMS', 'ACTIVITIES', 'SCREENSHOTS', 'AUDIT', 'FEEDBACK', 'LOGS'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                playCyberBlip(650);
                setActiveTab(tab);
              }}
              className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab
                  ? 'bg-amber-500 text-black font-bold shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'bg-[#080b12] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab === 'ACTIVITIES' && (
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
              )}
              {tab === 'SCREENSHOTS' && (
                <Camera className={`w-3.5 h-3.5 ${screenshotAlerts.length > 0 ? 'text-red-400 animate-pulse' : 'text-slate-500'}`} />
              )}
              {tab === 'AUDIT' && (
                <History className="w-3.5 h-3.5 text-cyan-400" />
              )}
              {tab === 'FEEDBACK' && (
                <MessageSquareHeart className="w-3.5 h-3.5 text-pink-400" />
              )}
              <span>{tab === 'ACTIVITIES' ? 'USER ACTIVITIES' : tab === 'AUDIT' ? 'AUDIT TRAIL' : tab === 'FEEDBACK' ? 'TEAM FEEDBACK' : tab}</span>
              {tab === 'ACTIVITIES' && logs.activityFeed.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500 font-bold">
                  {logs.activityFeed.length}
                </span>
              )}
              {tab === 'SCREENSHOTS' && screenshotAlerts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-500 text-white font-black animate-pulse">
                  {screenshotAlerts.length}
                </span>
              )}
              {tab === 'AUDIT' && auditLogs.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500 font-bold">
                  {auditLogs.length}
                </span>
              )}
              {tab === 'FEEDBACK' && feedbacks.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-pink-950 text-pink-300 border border-pink-500 font-bold">
                  {feedbacks.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: CONTROLS */}
      {activeTab === 'CONTROLS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Global Timer Master Control Center */}
          <div className="rounded-xl bg-[#0d111a] border border-slate-800 p-5 space-y-5 font-mono text-xs">
            {/* Header: Title + Real-Time Status Pill */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                MASTER COMPETITION TIMER
              </span>
              <div className="flex items-center gap-2">
                {competitionState.status === 'running' ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-[#00ff66] border border-emerald-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66] animate-pulse" />
                    RUNNING
                  </span>
                ) : competitionState.status === 'paused' ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    STOPPED / PAUSED
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    TIME EXPIRED
                  </span>
                )}
              </div>
            </div>

            {/* Large Digital Clock Display */}
            <div className="bg-[#050811] border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
                  <span className="w-1 h-3 bg-emerald-500 rounded-sm" />
                  Live Synchronized Countdown
                </div>
                <div className="text-3xl sm:text-4xl font-black text-[#00ff66] tracking-widest tabular-nums drop-shadow-[0_0_15px_rgba(0,255,102,0.35)]">
                  {formatTimeFull(competitionState.remainingSeconds)}
                </div>
              </div>
              <div className="sm:text-right">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Submissions Status
                </div>
                <span
                  className={`inline-block px-2.5 py-1 rounded text-[11px] font-bold ${
                    competitionState.status === 'running'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {competitionState.status === 'running' ? 'UNLOCKED / ACTIVE' : 'LOCKED / FROZEN'}
                </span>
              </div>
            </div>

            {/* Primary Action Controls: START, STOP, RESTART */}
            <div className="space-y-2">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Primary Timer Execution
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* START / RESUME */}
                <button
                  type="button"
                  onClick={() => handleTimerAction('start')}
                  disabled={competitionState.status === 'running'}
                  className={`px-3.5 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                    competitionState.status === 'running'
                      ? 'bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed opacity-50'
                      : 'bg-emerald-500/20 text-[#00ff66] border border-emerald-500/50 hover:bg-emerald-500/30 cursor-pointer shadow-[0_0_15px_rgba(0,255,102,0.15)]'
                  }`}
                  title="Start or resume the countdown"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>START TIMER</span>
                </button>

                {/* STOP / PAUSE */}
                <button
                  type="button"
                  onClick={() => handleTimerAction('stop')}
                  disabled={competitionState.status !== 'running'}
                  className={`px-3.5 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                    competitionState.status !== 'running'
                      ? 'bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed opacity-50'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                  }`}
                  title="Immediately stop/pause countdown across all participant screens"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>STOP TIMER</span>
                </button>

                {/* RESTART */}
                <button
                  type="button"
                  onClick={() => setShowRestartModal(true)}
                  className="px-3.5 py-2.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-500/30 flex items-center justify-center gap-2 font-bold text-xs cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all"
                  title="Restart the countdown clock whenever you want"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>RESTART TIMER</span>
                </button>
              </div>
            </div>

            {/* Quick Time Adjusters: ADD & SUBTRACT */}
            <div className="space-y-2 pt-1 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                <span>Quick Time Adjusters</span>
                <span className="text-[9px] text-slate-400 font-normal">Real-time sync</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleTimerAction('add', 300)}
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                >
                  +5 Min
                </button>
                <button
                  type="button"
                  onClick={() => handleTimerAction('add', 900)}
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                >
                  +15 Min
                </button>
                <button
                  type="button"
                  onClick={() => handleTimerAction('add', 1800)}
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                >
                  +30 Min
                </button>
                <button
                  type="button"
                  onClick={() => handleTimerAction('add', 3600)}
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                >
                  +60 Min
                </button>

                <div className="h-6 w-px bg-slate-800 mx-1 self-center" />

                <button
                  type="button"
                  onClick={() => handleTimerAction('subtract', 300)}
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                >
                  -5 Min
                </button>
                <button
                  type="button"
                  onClick={() => handleTimerAction('subtract', 900)}
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                >
                  -15 Min
                </button>
                <button
                  type="button"
                  onClick={() => handleTimerAction('subtract', 1800)}
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                >
                  -30 Min
                </button>
              </div>
            </div>

            {/* Custom Exact Time Form */}
            <form onSubmit={handleApplyCustomTime} className="pt-2 border-t border-slate-800/60 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={customTimerMinutes}
                  onChange={(e) => setCustomTimerMinutes(e.target.value)}
                  placeholder="Set exact minutes (e.g. 90)..."
                  className="w-full bg-[#050811] border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/50 font-bold text-xs shrink-0 transition-colors cursor-pointer"
              >
                SET TIME
              </button>
            </form>
          </div>

          {/* Post-Event Writeup Mode Card */}
          <div className="rounded-xl bg-[#0d111a] border border-slate-800 p-5 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                POST-EVENT WRITEUP MODE
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${competitionState.writeupMode ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
                {competitionState.writeupMode ? 'UNLOCKED' : 'LOCKED'}
              </span>
            </div>

            <p className="text-slate-300 leading-relaxed font-sans text-xs">
              When toggled on, official challenge walkthroughs, formulas, and flag derivations will be exposed to all participants for post-competition educational debriefs.
            </p>

            <div>
              <button
                onClick={handleToggleWriteupMode}
                className={`px-4 py-2 rounded font-bold transition-colors ${
                  competitionState.writeupMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                }`}
              >
                {competitionState.writeupMode ? 'LOCK WRITEUPS' : 'RELEASE OFFICIAL WRITEUPS'}
              </button>
            </div>
          </div>

          {/* Instant Broadcast Announcement */}
          <div className="rounded-xl bg-[#0d111a] border border-slate-800 p-5 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-cyan-400" />
                PUSH BROADCAST ANNOUNCEMENT
              </span>
              {competitionState.announcement && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 flex items-center gap-1 border border-cyan-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  ACTIVE BROADCAST PENDING
                </span>
              )}
            </div>

            {competitionState.announcement && (
              <div className="p-3 bg-cyan-950/30 border border-cyan-500/40 rounded flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    LIVE ON PARTICIPANT SCREENS
                  </div>
                  <div className="text-white font-bold text-xs truncate">{competitionState.announcement.title}</div>
                  <div className="text-slate-300 text-[11px] truncate">{competitionState.announcement.message}</div>
                </div>
                <button
                  type="button"
                  onClick={handleClearAnnouncement}
                  className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded font-bold text-[10px] whitespace-nowrap transition-colors"
                >
                  REVOKE / CLEAR
                </button>
              </div>
            )}

            <form onSubmit={handleBroadcastAnnouncement} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Title (Optional)</label>
                <input
                  type="text"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="e.g. SYSTEM UPDATE / CLARIFICATION"
                  className="w-full bg-[#080b12] border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Announcement Message *</label>
                <textarea
                  rows={3}
                  value={announcementMsg}
                  onChange={(e) => setAnnouncementMsg(e.target.value)}
                  placeholder="Push instant alert modal to all active screens..."
                  className="w-full bg-[#080b12] border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.3)] transition-all cursor-pointer"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>BROADCAST TO ALL SCREENS</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAnnouncement}
                  className={`px-4 py-2 font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer border ${
                    competitionState.announcement
                      ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.25)] animate-pulse'
                      : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                  }`}
                  title="Cease broadcasting immediately and remove alert from all participant screens"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>STOP BROADCASTING</span>
                </button>
              </div>
            </form>
          </div>

          {/* Load Balancer & Redis Cache Engine */}
          <div className="rounded-xl bg-[#0d111a] border border-emerald-500/30 p-5 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                LOAD BALANCER & REDIS CACHE
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-[#00ff66] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66] animate-pulse" />
                ACTIVE & SYNCED
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-300">
              <div className="p-2.5 rounded bg-[#080b12] border border-slate-800">
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Server className="w-3 h-3 text-emerald-400" />
                  LB NODE INSTANCE
                </div>
                <div className="font-bold text-emerald-400 mt-0.5 truncate">
                  {lbData?.nodeId || 'node-primary-1'}
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#080b12] border border-slate-800">
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-cyan-400" />
                  HEALTH PROBE
                </div>
                <div className="font-bold text-cyan-400 mt-0.5">/health (HTTP 200)</div>
              </div>

              <div className="p-2.5 rounded bg-[#080b12] border border-slate-800">
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  REDIS HIT RATE
                </div>
                <div className="font-bold text-amber-300 mt-0.5">
                  {lbData?.metrics?.hitRate || '100%'}
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#080b12] border border-slate-800">
                <div className="text-[10px] text-slate-500">CACHE HITS / MISSES</div>
                <div className="font-bold text-white mt-0.5">
                  {lbData?.metrics?.cacheHits ?? 0} hits / {lbData?.metrics?.cacheMisses ?? 0} misses
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#080b12] border border-slate-800">
                <div className="text-[10px] text-slate-500">KEYS & ZSETS</div>
                <div className="font-bold text-white mt-0.5">
                  {lbData?.metrics?.keysInMemory ?? 0} keys · {lbData?.metrics?.zsetKeysCount ?? 1} ZSET
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#080b12] border border-slate-800">
                <div className="text-[10px] text-slate-500">CONCURRENT CAPACITY</div>
                <div className="font-bold text-emerald-400 mt-0.5">100+ TEAMS / 400+ PARTICIPANTS</div>
              </div>

              <div className="p-2.5 rounded bg-[#080b12] border border-slate-800 col-span-2 sm:col-span-3">
                <div className="text-[10px] text-slate-500 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Database className="w-3 h-3 text-cyan-400" />
                    LIVE PERSISTENT DATABASE ENGINE
                  </span>
                  <span className="text-emerald-400 font-bold">SQLITE 3 (ACID COMPLIANT)</span>
                </div>
                <div className="font-bold text-white mt-1 text-[11px] flex items-center justify-between">
                  <span className="text-cyan-300 font-mono">data/ctf_database.sqlite</span>
                  <span className="text-slate-400 font-mono text-[10px]">Indexed by team_name & score</span>
                </div>
              </div>
            </div>

            {benchmarkResult && (
              <div className="p-3 rounded bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
                <span>
                  Benchmark: 150 ops executed in <strong>{benchmarkResult.durationMs}ms</strong>
                </span>
                <span className="font-bold text-[#00ff66]">
                  {benchmarkResult.opsPerSec.toLocaleString()} ops/sec
                </span>
              </div>
            )}

            <div className="pt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleFlushCache}
                className="px-3.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>FLUSH REDIS CACHE</span>
              </button>

              <button
                type="button"
                disabled={isBenchmarking}
                onClick={handleRunBenchmark}
                className="px-3.5 py-2 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-[#00ff66] border border-emerald-500/40 font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isBenchmarking ? 'BENCHMARKING...' : 'BENCHMARK CACHE SPEED'}</span>
              </button>
            </div>
          </div>

          {/* Matrix Rain Visual Controller */}
          <div className="rounded-xl bg-[#0d111a] border border-[#00ff66]/30 p-5 space-y-4 font-mono text-xs shadow-[0_0_20px_rgba(0,255,102,0.06)]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <Binary className="w-4 h-4 text-[#00ff66]" />
                MATRIX BINARY RAIN SPEED
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66] animate-pulse" />
                LIVE SYNCED ({matrixSpeed.toFixed(1)}x)
              </span>
            </div>

            <p className="text-slate-400 font-sans text-xs leading-relaxed">
              Dynamically adjust the velocity of falling binary streams across all participant and admin viewports in real time.
            </p>

            {/* Slider & Value Display */}
            <div className="space-y-2 bg-[#080b12] border border-slate-800 rounded-lg p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#00ff66]" />
                  STREAM VELOCITY
                </span>
                <span className="font-bold font-mono text-base text-[#00ff66] drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]">
                  {matrixSpeed.toFixed(1)}x
                  <span className="text-[10px] text-slate-500 font-normal ml-1">
                    {matrixSpeed <= 0.5 ? '(Ambient)' : matrixSpeed <= 1.2 ? '(Normal)' : matrixSpeed <= 2.0 ? '(Fast)' : '(Hyper)'}
                  </span>
                </span>
              </div>

              <input
                type="range"
                min="0.2"
                max="3.5"
                step="0.1"
                value={matrixSpeed}
                onChange={(e) => handleSetMatrixSpeed(parseFloat(e.target.value))}
                className="w-full accent-[#00ff66] cursor-pointer h-2 bg-slate-800 rounded-lg"
              />

              <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-1">
                <span>0.2x (Slow)</span>
                <span>1.0x (Default)</span>
                <span>2.0x (Fast)</span>
                <span>3.5x (Warp)</span>
              </div>
            </div>

            {/* Preset Speed Buttons */}
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">
                Quick Speed Presets
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: '0.4x SLOW', val: 0.4 },
                  { label: '1.0x NORMAL', val: 1.0 },
                  { label: '1.8x RAPID', val: 1.8 },
                  { label: '2.8x HYPER', val: 2.8 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleSetMatrixSpeed(preset.val)}
                    className={`py-2 px-2.5 rounded font-bold text-[11px] transition-all cursor-pointer border ${
                      Math.abs(matrixSpeed - preset.val) < 0.05
                        ? 'bg-[#00ff66]/20 border-[#00ff66] text-[#00ff66] shadow-[0_0_12px_rgba(0,255,102,0.3)]'
                        : 'bg-[#080b12] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Danger Zone: Reset Competition */}
          <div className="rounded-xl bg-red-950/20 border border-red-500/40 p-5 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-red-500/30">
              <span className="font-bold text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                DANGER ZONE: COMPETITION RESET
              </span>
            </div>

            <p className="text-slate-300 font-sans text-xs">
              Permanently deletes all registered teams, participant activities, screenshot alerts, audit trails, logs, submissions, and resets all scoreboard/audit CSV exports for a fresh tournament session.
            </p>

            <button
              onClick={() => setShowResetConfirmModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET ENTIRE COMPETITION</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: CHALLENGES */}
      {activeTab === 'CHALLENGES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-sm font-bold text-white">
              ACTIVE CHALLENGE MATRIX ({challenges.length})
            </h3>
            <button
              onClick={() => {
                setEditingChallenge({
                  title: '',
                  section: 'Section A (Find the Clue, Find the Key)',
                  category: 'CRYPTO',
                  points: 150,
                  difficulty: 'Medium',
                  description: '',
                  flag: 'CTF{new_secret_flag}',
                  flagFormat: 'CTF{...}',
                  maxAttempts: 5,
                  hints: [
                    { id: 'h1', title: 'First Clue', cost: 20, content: 'Initial orientation clue.' },
                  ],
                });
                setIsEditingChallenge(true);
              }}
              className="px-3 py-1.5 rounded bg-[#00ff66] text-black font-mono font-bold text-xs flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,255,102,0.25)]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ADD NEW CHALLENGE</span>
            </button>
          </div>

          <div className="rounded-xl bg-[#0d111a] border border-slate-800 overflow-x-auto text-xs font-mono">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#080b12] border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-4">TITLE & SECTION</th>
                  <th className="py-3 px-4">CATEGORY</th>
                  <th className="py-3 px-4 text-center">POINTS</th>
                  <th className="py-3 px-4">SECRET FLAG</th>
                  <th className="py-3 px-4 text-center">SOLVES</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {challenges.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                        <span>{c.title}</span>
                        {c.attachment && (
                          <span className="text-[10px] font-mono font-normal px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            📎 {c.attachment.fileName} ({c.attachment.size})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">{c.section}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-cyan-400 font-bold">{c.category}</span>
                    </td>
                    <td className="py-3 px-4 text-center text-[#00ff66] font-bold">
                      {c.points}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300">
                        {c.flag}
                      </code>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-300">
                      {c.solvesCount}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingChallenge(c);
                            setIsEditingChallenge(true);
                          }}
                          className="p-1 text-slate-400 hover:text-white"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setChallengeToDelete(c)}
                          className="p-1 text-red-400 hover:text-red-300"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TEAMS (COMPULSORY PERSISTENT ROSTER & DEFENSE TELEMETRY) */}
      {activeTab === 'TEAMS' && (() => {
        const filteredTeams = teams.filter((t) => {
          if (teamStatusFilter === 'COMPETING' && (!t.hasStarted || t.isDisqualified)) return false;
          if (teamStatusFilter === 'BRIEFING' && (t.hasStarted || t.isDisqualified)) return false;
          if (teamStatusFilter === 'AT_RISK' && ((t.strikes || 0) < 6 || t.isDisqualified)) return false;
          if (teamStatusFilter === 'DISQUALIFIED' && !t.isDisqualified) return false;

          if (!teamSearchQuery.trim()) return true;
          const q = teamSearchQuery.toLowerCase().trim();
          const matchName = t.teamName.toLowerCase().includes(q);
          const matchId = t.id.toLowerCase().includes(q);
          const matchIp = t.ip.toLowerCase().includes(q);
          const matchMember = t.members.some((m) => m.toLowerCase().includes(q));
          const matchEmail = (t.email || '').toLowerCase().includes(q);
          return matchName || matchId || matchIp || matchMember || matchEmail;
        });

        const competingCount = teams.filter((t) => t.hasStarted && !t.isDisqualified).length;
        const briefingCount = teams.filter((t) => !t.hasStarted && !t.isDisqualified).length;
        const atRiskCount = teams.filter((t) => (t.strikes || 0) >= 6 && !t.isDisqualified).length;
        const disqCount = teams.filter((t) => t.isDisqualified).length;

        return (
          <div className="space-y-4 font-mono animate-fadeIn">
            {/* Header with Live Sync Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00ff66] animate-pulse shadow-[0_0_8px_#00ff66]" />
                  <h3 className="text-sm font-black text-white tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#00ff66]" />
                    <span>REGISTERED TEAMS ROSTER & DEFENSE TELEMETRY</span>
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 font-bold">
                    {teams.length} SQUADS SYNCED
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Authoritative student team directory synchronized with disk-backed database storage and sub-millisecond Redis leaderboard cache.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    playCyberBlip(700);
                    fetchAdminData();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#0d111a] border border-slate-700 hover:border-[#00ff66]/50 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Force re-query database store"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#00ff66]" />
                  <span>REFRESH ROSTER</span>
                </button>
              </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
              <div
                onClick={() => setTeamStatusFilter('ALL')}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  teamStatusFilter === 'ALL'
                    ? 'bg-[#00ff66]/10 border-[#00ff66] shadow-[0_0_12px_rgba(0,255,102,0.15)]'
                    : 'bg-[#0d111a] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-[10px] text-slate-400 uppercase font-bold">Total Registered</div>
                <div className="text-xl font-black text-white mt-0.5">{teams.length}</div>
              </div>

              <div
                onClick={() => setTeamStatusFilter('COMPETING')}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  teamStatusFilter === 'COMPETING'
                    ? 'bg-emerald-950/70 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : 'bg-[#0d111a] border-emerald-500/30 hover:border-emerald-500/60'
                }`}
              >
                <div className="text-[10px] text-emerald-400 uppercase font-bold">Competing</div>
                <div className="text-xl font-black text-[#00ff66] mt-0.5">{competingCount}</div>
              </div>

              <div
                onClick={() => setTeamStatusFilter('BRIEFING')}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  teamStatusFilter === 'BRIEFING'
                    ? 'bg-cyan-950/70 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                    : 'bg-[#0d111a] border-cyan-500/30 hover:border-cyan-500/60'
                }`}
              >
                <div className="text-[10px] text-cyan-400 uppercase font-bold">Pre-Briefing</div>
                <div className="text-xl font-black text-cyan-300 mt-0.5">{briefingCount}</div>
              </div>

              <div
                onClick={() => setTeamStatusFilter('AT_RISK')}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  teamStatusFilter === 'AT_RISK'
                    ? 'bg-amber-950/70 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                    : 'bg-[#0d111a] border-amber-500/30 hover:border-amber-500/60'
                }`}
              >
                <div className="text-[10px] text-amber-400 uppercase font-bold">At-Risk (&gt;5 Strikes)</div>
                <div className="text-xl font-black text-amber-300 mt-0.5">{atRiskCount}</div>
              </div>

              <div
                onClick={() => setTeamStatusFilter('DISQUALIFIED')}
                className={`p-3 rounded-xl border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                  teamStatusFilter === 'DISQUALIFIED'
                    ? 'bg-red-950/70 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                    : 'bg-[#0d111a] border-red-500/40 hover:border-red-500/70'
                }`}
              >
                <div className="text-[10px] text-red-400 uppercase font-bold">Disqualified</div>
                <div className="text-xl font-black text-red-400 mt-0.5">{disqCount}</div>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  placeholder="Filter teams by Name, Member, Email, or ID..."
                  className="w-full bg-[#080b12] border border-slate-800 focus:border-[#00ff66] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner"
                />
                {teamSearchQuery && (
                  <button
                    onClick={() => setTeamSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-[10px]"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Status Filter Badges & Bulk Actions */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between lg:justify-end">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
                  {(['ALL', 'COMPETING', 'BRIEFING', 'AT_RISK', 'DISQUALIFIED'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => {
                        playCyberBlip(600);
                        setTeamStatusFilter(filter);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                        teamStatusFilter === filter
                          ? 'bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/60 shadow-[0_0_8px_rgba(0,255,102,0.2)]'
                          : 'bg-[#0d111a] text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {filter.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleClearAllStrikes}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 text-amber-300 hover:text-white border border-amber-500/60 text-[11px] font-bold transition-all shadow-[0_0_10px_rgba(245,158,11,0.25)] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  title="Reset strikes to 0 and reinstate all penalized teams across the competition"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reset All Strikes</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetAllTeamsReady}
                  className="px-3 py-1.5 rounded-lg bg-indigo-500/25 hover:bg-indigo-500/40 text-indigo-300 hover:text-white border border-indigo-500/60 text-[11px] font-bold transition-all shadow-[0_0_10px_rgba(99,102,241,0.25)] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  title="Reset all squads back to the Pre-Competition 'START COMPETITION' rules briefing gate"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Reset All to Start Gate</span>
                </button>
              </div>
            </div>

            {/* Roster Table */}
            <div className="rounded-xl bg-[#0d111a] border border-slate-800 overflow-x-auto text-xs shadow-xl">
              <div className="sm:hidden px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 text-[10px] text-slate-400 font-mono flex items-center justify-between">
                <span className="text-amber-400">← SWIPE ROSTER TO VIEW ALL COLUMNS →</span>
                <span>{filteredTeams.length} TEAMS</span>
              </div>
              <table className="w-full text-left min-w-[760px]">
                <thead>
                  <tr className="bg-[#080b12] border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">TEAM &amp; ID</th>
                    <th className="py-3 px-4">MEMBERS (1-4)</th>
                    <th className="py-3 px-4 text-center">STATUS</th>
                    <th className="py-3 px-4 text-center">SCORE / SOLVES</th>
                    <th className="py-3 px-4 text-center">WARNINGS</th>
                    <th className="py-3 px-4">IP &amp; DETAILS</th>
                    <th className="py-3 px-4 text-right">ARBITRATION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTeams.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                        No registered squads match the current filter query.
                      </td>
                    </tr>
                  ) : (
                    filteredTeams.map((t) => {
                      const isDisq = Boolean(t.isDisqualified);
                      const strikesCount = t.strikes || 0;
                      const solvesCount = Object.keys(t.solves || {}).length;

                      return (
                        <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                          {/* Squad Name & ID */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white text-sm flex items-center gap-1.5">
                              <span>{t.teamName}</span>
                            </div>
                            {t.email && (
                              <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5 font-sans">
                                <Mail className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="font-medium truncate max-w-[220px]">{t.email}</span>
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="font-mono">ID: {t.id}</span>
                              {t.registeredAt && (
                                <span>· {new Date(t.registeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                            </div>
                          </td>

                          {/* Operators */}
                          <td className="py-3.5 px-4 text-slate-300">
                            <div className="flex flex-wrap items-center gap-1">
                              {t.members.map((m, idx) => (
                                <span
                                  key={idx}
                                  className={`px-1.5 py-0.5 rounded text-[10px] border ${
                                    idx === 0
                                      ? 'bg-[#00ff66]/10 text-[#00ff66] border-[#00ff66]/40 font-bold'
                                      : 'bg-slate-800/70 text-slate-300 border-slate-700'
                                  }`}
                                >
                                  {m} {idx === 0 && '★'}
                                </span>
                              ))}
                              <span className="text-[9px] text-slate-500 font-mono ml-1">
                                ({t.members.length}/4)
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center">
                            {isDisq ? (
                              <span className="px-2 py-0.5 rounded bg-red-950/90 text-red-300 border border-red-500 font-bold text-[10px] shadow-[0_0_8px_rgba(239,68,68,0.3)] animate-pulse inline-block">
                                [DISQUALIFIED]
                              </span>
                            ) : t.hasStarted ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-500/50 font-bold text-[10px] inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66] animate-pulse" />
                                <span>COMPETING</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-500/50 font-bold text-[10px] inline-block">
                                IN BRIEFING
                              </span>
                            )}
                          </td>

                          {/* Score / Solves */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="font-bold text-[#00ff66] text-sm">
                              {t.score} PTS
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {solvesCount} solves · {t.totalFailedAttempts || 0} misses
                            </div>
                          </td>

                          {/* 10-Strike System Telemetry Meter */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`font-mono font-bold text-xs ${
                                  isDisq
                                    ? 'text-red-400'
                                    : strikesCount >= 8
                                    ? 'text-orange-400'
                                    : strikesCount >= 4
                                    ? 'text-amber-400'
                                    : 'text-slate-300'
                                }`}
                              >
                                {strikesCount} / 10
                              </span>

                              {/* 10-segment mini bar */}
                              <div className="flex gap-0.5">
                                {Array.from({ length: 10 }).map((_, i) => {
                                  const isFilled = i < strikesCount;
                                  let color = 'bg-slate-800';
                                  if (isFilled) {
                                    if (strikesCount >= 10 || isDisq) color = 'bg-red-500';
                                    else if (strikesCount >= 8) color = 'bg-orange-500';
                                    else if (strikesCount >= 4) color = 'bg-amber-400';
                                    else color = 'bg-emerald-500';
                                  }
                                  return (
                                    <div
                                      key={i}
                                      className={`w-1.5 h-2.5 rounded-xs ${color}`}
                                      title={`Strike slot ${i + 1}`}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </td>

                          {/* IP & Anomaly */}
                          <td className="py-3.5 px-4">
                            <div className="text-slate-300 font-mono text-[11px]">{t.ip}</div>
                            {t.isFlaggedAnomaly && (
                              <div className="text-[10px] text-red-400 flex items-center gap-1 font-bold mt-0.5">
                                <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                                <span className="truncate max-w-[130px]">{t.anomalyReason || 'Velocity flag'}</span>
                              </div>
                            )}
                            {isDisq && t.disqualifiedReason && (
                              <div className="text-[9px] text-red-400 truncate max-w-[140px] mt-0.5 font-sans" title={t.disqualifiedReason}>
                                {t.disqualifiedReason}
                              </div>
                            )}
                          </td>

                          {/* Arbitration Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                onClick={() => {
                                  setScoreAdjustTeam(t);
                                  setAdjustDelta(0);
                                  setAdjustReason('');
                                }}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                                title="Adjust squad score"
                              >
                                Adjust Pts
                              </button>

                              {strikesCount > 0 && (
                                <button
                                  onClick={() => handleClearStrikes(t.id)}
                                  className="px-2.5 py-1 rounded bg-amber-500/25 hover:bg-amber-500/40 text-amber-300 hover:text-white border border-amber-500/60 text-[11px] transition-all font-bold shadow-[0_0_8px_rgba(245,158,11,0.25)] flex items-center gap-1 cursor-pointer"
                                  title={`Reset strikes (currently ${strikesCount}) to 0 for this squad`}
                                >
                                  <RotateCcw className="w-3 h-3 text-amber-400" />
                                  <span>Reset Strikes</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleResetTeamReady(t.id)}
                                className="px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-300 hover:text-white border border-indigo-500/40 text-[11px] transition-all font-semibold flex items-center gap-1 cursor-pointer"
                                title="Reset squad start status back to the Start Competition briefing gate"
                              >
                                <RotateCcw className="w-3 h-3 text-indigo-400" />
                                <span>Reset Start Gate</span>
                              </button>

                              {isDisq ? (
                                <button
                                  onClick={() => handleClearStrikes(t.id)}
                                  className="px-2.5 py-1 rounded bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-300 hover:text-white border border-emerald-500/60 text-[11px] transition-all font-bold shadow-[0_0_8px_rgba(16,185,129,0.25)] flex items-center gap-1 cursor-pointer"
                                  title="Reinstate squad and restore competition access"
                                >
                                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                                  <span>Reinstate</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setTeamToDisqualify(t);
                                    setDisqualifyReason('Disqualified by Administrator Arbitration for competition rule violation.');
                                  }}
                                  className="px-2.5 py-1 rounded bg-red-600/35 hover:bg-red-600/60 text-red-200 hover:text-white border border-red-500 text-[11px] transition-all font-bold shadow-[0_0_10px_rgba(239,68,68,0.35)] flex items-center gap-1 cursor-pointer"
                                  title="Manually disqualify squad"
                                >
                                  <ShieldAlert className="w-3 h-3 text-red-400" />
                                  <span>Disqualify</span>
                                </button>
                              )}

                              {t.isFlaggedAnomaly && (
                                <button
                                  onClick={() => handleClearAnomaly(t.id)}
                                  className="px-2 py-1 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[11px] hover:bg-red-500/30 transition-colors"
                                >
                                  Clear Flag
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* TAB: SCREENSHOT AUDIT & CAPTURE TELEMETRY */}
      {activeTab === 'SCREENSHOTS' && (() => {
        // Aggregate screenshot metrics by squad with member roster
        const flaggedTeamsSummary = (() => {
          const map = new Map<string, {
            teamId: string;
            teamName: string;
            email?: string;
            members: string[];
            count: number;
            lastTimestamp: number;
            triggers: Set<string>;
            ip: string;
            teamObj?: Team;
          }>();

          screenshotAlerts.forEach((alert) => {
            const matchingTeam = teams.find((t) => t.id === alert.teamId);
            const members = matchingTeam?.members || alert.members || [];
            const email = matchingTeam?.email || alert.email || '';
            const entry = map.get(alert.teamId);
            if (!entry) {
              const triggers = new Set<string>();
              if (alert.triggerKey) triggers.add(alert.triggerKey);
              map.set(alert.teamId, {
                teamId: alert.teamId,
                teamName: alert.teamName || matchingTeam?.teamName || 'Unknown Squad',
                email,
                members,
                count: 1,
                lastTimestamp: alert.timestamp,
                triggers,
                ip: alert.ip,
                teamObj: matchingTeam,
              });
            } else {
              entry.count += 1;
              if (alert.triggerKey) entry.triggers.add(alert.triggerKey);
              if (email && !entry.email) entry.email = email;
              if (alert.timestamp > entry.lastTimestamp) {
                entry.lastTimestamp = alert.timestamp;
                entry.ip = alert.ip;
              }
              if (members.length > entry.members.length) {
                entry.members = members;
              }
            }
          });

          return Array.from(map.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
        })();

        return (
          <div className="space-y-6 font-mono text-xs">
            {/* Header Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Camera className="w-5 h-5 text-red-400 animate-pulse" />
                  <span>SCREENSHOT INTERCEPTION & SQUAD AUDIT</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40">
                    {flaggedTeamsSummary.length} SQUADS FLAGGED · {screenshotAlerts.length} TOTAL INCIDENTS
                  </span>
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Real-time telemetry audit of participants attempting PrintScreen, Windows Snipping Tool (Win+Shift+S), or Mac capture tools.
                </p>
              </div>

              {screenshotAlerts.length > 0 && (
                <button
                  onClick={handleClearAllScreenshots}
                  className="px-3 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>PURGE ALL INCIDENTS</span>
                </button>
              )}
            </div>

            {/* SECTION 1: PRIMARY TABLE - SQUADS WITH MEMBERS FLAGGED FOR SCREENSHOTS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>FLAGGED SQUADS ROSTER (TEAMS & MEMBERS AUDIT)</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  {flaggedTeamsSummary.length} Squads Monitored
                </span>
              </div>

              {flaggedTeamsSummary.length === 0 ? (
                <div className="rounded-xl bg-[#0d111a] border border-slate-800 p-8 text-center text-slate-500 space-y-2">
                  <CheckCircle className="w-8 h-8 mx-auto text-emerald-500/60" />
                  <div className="font-bold text-slate-300 text-sm">Zero Screenshot Incidents Detected</div>
                  <p className="text-xs max-w-md mx-auto text-slate-500">
                    No competing squad has attempted screen captures. If a participant hits PrintScreen or Snipping Tool, their squad identity and all team member names will appear here immediately.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-[#0d111a] border border-red-500/30 overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#080b12] text-slate-400 text-[11px] uppercase border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-4">Squad Name</th>
                          <th className="py-3 px-4">Team Members Roster</th>
                          <th className="py-3 px-4 text-center">Violations</th>
                          <th className="py-3 px-4">Captured Tools</th>
                          <th className="py-3 px-4">Latest Incident</th>
                          <th className="py-3 px-4">Client IP</th>
                          <th className="py-3 px-4 text-right">Arbitration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {flaggedTeamsSummary.map((item) => (
                          <tr key={item.teamId} className="hover:bg-red-950/15 transition-colors">
                            {/* Squad Name & ID */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping shrink-0" />
                                <span className="font-bold text-white text-sm">{item.teamName}</span>
                              </div>
                              {item.email && (
                                <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5 font-sans">
                                  <Mail className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span className="font-medium truncate max-w-[200px]">{item.email}</span>
                                </div>
                              )}
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                ID: {item.teamId}
                              </div>
                            </td>

                            {/* Team Members List */}
                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap gap-1.5 max-w-sm">
                                {item.members.length > 0 ? (
                                  item.members.map((memberName, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/90 text-cyan-300 border border-cyan-500/30 text-[11px] font-sans font-semibold shadow-xs"
                                    >
                                      <User className="w-3 h-3 text-cyan-400 shrink-0" />
                                      <span>{memberName}</span>
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-500 italic text-[11px]">
                                    No registered members
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-1">
                                {item.members.length} {item.members.length === 1 ? 'member' : 'members'} enrolled
                              </div>
                            </td>

                            {/* Violation Attempts Count */}
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-black">
                                <Camera className="w-3 h-3 text-red-400" />
                                {item.count} {item.count === 1 ? 'Attempt' : 'Attempts'}
                              </span>
                            </td>

                            {/* Captured Tools / Shortcuts */}
                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap gap-1">
                                {Array.from(item.triggers).map((trig, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold"
                                  >
                                    {trig}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Latest Incident Time */}
                            <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                              <div className="font-bold text-white">
                                {new Date(item.lastTimestamp).toLocaleTimeString()}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {new Date(item.lastTimestamp).toLocaleDateString()}
                              </div>
                            </td>

                            {/* Client IP */}
                            <td className="py-3.5 px-4">
                              <code className="text-cyan-400 text-xs font-mono">{item.ip}</code>
                            </td>

                            {/* Arbitration Actions */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <button
                                  onClick={() => handleClearStrikes(item.teamId)}
                                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-colors cursor-pointer"
                                  title="Reset strike penalty count for this squad"
                                >
                                  Reset Strikes
                                </button>
                                <button
                                  onClick={() => handleClearScreenshotsForTeam(item.teamId)}
                                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors cursor-pointer"
                                  title="Clear all screenshot incidents for this squad"
                                >
                                  Clear Logs
                                </button>
                                <button
                                  onClick={() => {
                                    const t = item.teamObj || teams.find((tm) => tm.id === item.teamId) || ({
                                      id: item.teamId,
                                      teamName: item.teamName,
                                      members: item.members,
                                      score: 0,
                                    } as Team);
                                    setTeamToDisqualify(t);
                                    setDisqualifyReason(`Disqualified by Administrator Arbitration: Repeated screen capture violations (${item.count} incidents).`);
                                  }}
                                  className="px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/50 text-[11px] font-bold transition-colors cursor-pointer"
                                  title="Disqualify squad for screenshot violations"
                                >
                                  Disqualify
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: CHRONOLOGICAL REAL-TIME INCIDENT AUDIT STREAM */}
            {screenshotAlerts.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Scan className="w-4 h-4 text-cyan-400" />
                    <span>CHRONOLOGICAL INCIDENT STREAM ({screenshotAlerts.length} LOGS)</span>
                  </h4>
                </div>

                <div className="rounded-xl bg-[#0d111a] border border-slate-800 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#080b12] text-slate-400 text-[11px] uppercase border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-4">Time</th>
                          <th className="py-3 px-4">Offending Squad & Members</th>
                          <th className="py-3 px-4">Trigger / Shortcut</th>
                          <th className="py-3 px-4">Client Telemetry & Details</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {screenshotAlerts.map((alert) => {
                          const matchingTeam = teams.find((t) => t.id === alert.teamId);
                          const alertMembers = matchingTeam?.members || alert.members || [];

                          return (
                            <tr key={alert.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                                <div className="font-bold text-white">
                                  {new Date(alert.timestamp).toLocaleTimeString()}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {new Date(alert.timestamp).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                                  <span className="font-bold text-red-200 text-xs">{alert.teamName}</span>
                                </div>
                                {(alert.email || matchingTeam?.email) && (
                                  <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5 font-sans">
                                    <Mail className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                    <span className="truncate max-w-[200px]">{alert.email || matchingTeam?.email}</span>
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {alertMembers.map((m, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700"
                                    >
                                      <User className="w-2.5 h-2.5 text-cyan-400" />
                                      <span>{m}</span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[11px] font-bold">
                                  {alert.triggerKey || 'PrintScreen'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-300">
                                <div className="font-mono text-cyan-400 text-xs">IP: {alert.ip}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                                  {alert.details}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => handleDismissScreenshot(alert.id)}
                                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                                >
                                  Dismiss
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 4: USER ACTIVITIES STREAM */}
      {activeTab === 'ACTIVITIES' && (() => {
        const filteredActivities = logs.activityFeed.filter((act) => {
          // Filter by category
          if (activityFilter === 'SOLVES' && act.type !== 'solve' && act.type !== 'first_blood') return false;
          if (activityFilter === 'FAILS' && act.type !== 'failed_submission') return false;
          if (activityFilter === 'HINTS' && act.type !== 'hint_unlocked') return false;
          if (activityFilter === 'AUTH' && act.type !== 'user_login' && act.type !== 'user_signup' && act.type !== 'ready_started') return false;
          if (activityFilter === 'ARTIFACTS' && act.type !== 'artifact_view') return false;
          if (activityFilter === 'SYSTEM' && act.type !== 'system' && act.type !== 'announcement') return false;

          // Search query
          if (!activitySearchQuery) return true;
          const q = activitySearchQuery.toLowerCase();
          return (
            act.teamName.toLowerCase().includes(q) ||
            act.message.toLowerCase().includes(q) ||
            (act.challengeTitle && act.challengeTitle.toLowerCase().includes(q))
          );
        });

        const solveCount = logs.activityFeed.filter((a) => a.type === 'solve' || a.type === 'first_blood').length;
        const failCount = logs.activityFeed.filter((a) => a.type === 'failed_submission').length;
        const hintCount = logs.activityFeed.filter((a) => a.type === 'hint_unlocked').length;
        const authCount = logs.activityFeed.filter((a) => a.type === 'user_login' || a.type === 'user_signup' || a.type === 'ready_started').length;
        const artifactCount = logs.activityFeed.filter((a) => a.type === 'artifact_view').length;
        const systemCount = logs.activityFeed.filter((a) => a.type === 'system' || a.type === 'announcement').length;

        const getActivityIcon = (type: ActivityFeedEvent['type']) => {
          switch (type) {
            case 'first_blood':
              return <Crown className="w-4 h-4 text-amber-400" />;
            case 'solve':
              return <CheckCircle className="w-4 h-4 text-[#00ff66]" />;
            case 'failed_submission':
              return <XCircle className="w-4 h-4 text-rose-400" />;
            case 'hint_unlocked':
              return <Lightbulb className="w-4 h-4 text-cyan-400" />;
            case 'user_signup':
              return <UserPlus className="w-4 h-4 text-purple-400" />;
            case 'user_login':
              return <Key className="w-4 h-4 text-blue-400" />;
            case 'ready_started':
              return <Play className="w-4 h-4 text-emerald-400" />;
            case 'artifact_view':
              return <FileText className="w-4 h-4 text-teal-400" />;
            case 'announcement':
              return <Megaphone className="w-4 h-4 text-amber-400" />;
            default:
              return <Activity className="w-4 h-4 text-slate-400" />;
          }
        };

        const getActivityBadge = (type: ActivityFeedEvent['type']) => {
          switch (type) {
            case 'first_blood':
              return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/50">FIRST BLOOD</span>;
            case 'solve':
              return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-[#00ff66] border border-emerald-500/40">SOLVE</span>;
            case 'failed_submission':
              return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">WRONG FLAG</span>;
            case 'hint_unlocked':
              return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">HINT UNLOCK</span>;
            case 'user_signup':
              return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">REGISTRATION</span>;
            case 'user_login':
              return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">LOGIN</span>;
            case 'ready_started':
              return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">READY / STARTED</span>;
            case 'artifact_view':
              return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">ARTIFACT VIEW</span>;
            default:
              return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">SYSTEM</span>;
          }
        };

        return (
          <div className="space-y-5 font-mono text-xs">
            {/* Header Metrics Banner */}
            <div className="rounded-xl bg-[#0d111a] border border-slate-800 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-bold text-sm text-white">
                    LIVE OPERATOR ACTIONS & USER ACTIVITY STREAM
                  </h3>
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-[#00ff66] text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66] animate-pulse" />
                    <span>REAL-TIME STREAMING</span>
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-1">
                  Comprehensive real-time telemetry of all participant actions: registrations, logins, readiness gates, flag submissions, hint unlocks, and artifact inspections.
                </p>
              </div>

              {/* Quick Stat Counter Cards */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="px-3 py-1.5 rounded-lg bg-[#080b12] border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-500">TOTAL ACTIONS</div>
                  <div className="font-black text-sm text-white">{logs.activityFeed.length}</div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-[#080b12] border border-emerald-500/30 text-center">
                  <div className="text-[10px] text-emerald-400">SOLVES</div>
                  <div className="font-black text-sm text-[#00ff66]">{solveCount}</div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-[#080b12] border border-rose-500/30 text-center">
                  <div className="text-[10px] text-rose-400">WRONG FLAGS</div>
                  <div className="font-black text-sm text-rose-300">{failCount}</div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-[#080b12] border border-cyan-500/30 text-center">
                  <div className="text-[10px] text-cyan-400">HINTS UNLOCKED</div>
                  <div className="font-black text-sm text-cyan-300">{hintCount}</div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-[#080b12] border border-blue-500/30 text-center">
                  <div className="text-[10px] text-blue-400">AUTH & READY</div>
                  <div className="font-black text-sm text-blue-300">{authCount}</div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-[#080b12] border border-teal-500/30 text-center">
                  <div className="text-[10px] text-teal-400">ARTIFACT VIEWS</div>
                  <div className="font-black text-sm text-teal-300">{artifactCount}</div>
                </div>
              </div>
            </div>

            {/* Filter Controls & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: `ALL (${logs.activityFeed.length})` },
                  { id: 'SOLVES', label: `SOLVES (${solveCount})` },
                  { id: 'FAILS', label: `WRONG FLAGS (${failCount})` },
                  { id: 'HINTS', label: `HINTS (${hintCount})` },
                  { id: 'AUTH', label: `LOGINS & READY (${authCount})` },
                  { id: 'ARTIFACTS', label: `ARTIFACTS (${artifactCount})` },
                  { id: 'SYSTEM', label: `SYSTEM & AUDIT (${systemCount})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      playCyberBlip(700);
                      setActivityFilter(f.id as any);
                    }}
                    className={`px-3 py-1.5 rounded transition-all cursor-pointer text-[11px] font-bold ${
                      activityFilter === f.id
                        ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                        : 'bg-[#0d111a] text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Filter by team, challenge, keyword..."
                  value={activitySearchQuery}
                  onChange={(e) => setActivitySearchQuery(e.target.value)}
                  className="w-full bg-[#0d111a] border border-slate-800 focus:border-cyan-500 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none"
                />
                {activitySearchQuery && (
                  <button
                    onClick={() => setActivitySearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Activities Stream Feed */}
            <div className="rounded-xl bg-[#0d111a] border border-slate-800 overflow-hidden shadow-2xl">
              <div className="divide-y divide-slate-800/70 max-h-[700px] overflow-y-auto">
                {filteredActivities.map((act) => {
                  const date = new Date(act.timestamp);
                  const timeFormatted = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  return (
                    <div
                      key={act.id}
                      className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-[#080b12] border border-slate-800 shrink-0 mt-0.5">
                          {getActivityIcon(act.type)}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {getActivityBadge(act.type)}
                            <span className="font-bold text-white text-xs sm:text-sm">
                              {act.teamName}
                            </span>
                            {act.challengeTitle && (
                              <span className="text-slate-400 text-xs">
                                · on <strong className="text-cyan-300">{act.challengeTitle}</strong>
                              </span>
                            )}
                          </div>

                          <div className="text-slate-300 text-xs mt-1.5 leading-relaxed font-sans sm:font-mono">
                            {act.message}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pl-11 sm:pl-0">
                        {act.points !== undefined && act.points !== 0 && (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                            act.points > 0
                              ? 'bg-emerald-950/80 text-[#00ff66] border border-emerald-500/50'
                              : 'bg-rose-950/80 text-rose-300 border border-rose-500/50'
                          }`}>
                            {act.points > 0 ? `+${act.points} PTS` : `${act.points} PTS`}
                          </span>
                        )}

                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                          <Clock className="w-3 h-3 text-slate-600" />
                          <span>{timeFormatted}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredActivities.length === 0 && (
                  <div className="py-16 text-center text-slate-500">
                    <Activity className="w-10 h-10 text-slate-700 mx-auto mb-2 animate-pulse" />
                    <p className="font-bold text-slate-400">No user activities found matching filter.</p>
                    <p className="text-[11px] text-slate-600 mt-1">Actions performed by students will stream live here automatically.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB: PRECISE TIMESTAMPED AUDIT LOGS */}
      {activeTab === 'AUDIT' && (() => {
        const filteredAudit = auditLogs.filter((log) => {
          if (auditActorFilter !== 'ALL' && log.actorType !== auditActorFilter) {
            return false;
          }
          if (auditActionFilter !== 'ALL' && log.actionType !== auditActionFilter) {
            return false;
          }
          if (auditSearchQuery.trim()) {
            const q = auditSearchQuery.toLowerCase();
            return (
              log.actorIdentifier.toLowerCase().includes(q) ||
              log.actionType.toLowerCase().includes(q) ||
              log.ipAddress.toLowerCase().includes(q) ||
              log.details.toLowerCase().includes(q) ||
              log.logId.toLowerCase().includes(q)
            );
          }
          return true;
        });

        const studentCount = auditLogs.filter((l) => l.actorType === 'STUDENT').length;
        const adminCount = auditLogs.filter((l) => l.actorType === 'ADMIN').length;
        const systemCount = auditLogs.filter((l) => l.actorType === 'SYSTEM').length;
        const disqCount = auditLogs.filter((l) => l.actionType === 'DISQUALIFICATION' || l.actionType === 'ADMIN_DISQUALIFY_TEAM').length;

        const getActionBadgeColor = (action: string) => {
          switch (action) {
            case 'REGISTRATION':
              return 'bg-purple-950/80 text-purple-300 border-purple-500/50';
            case 'LOGIN':
              return 'bg-blue-950/80 text-blue-300 border-blue-500/50';
            case 'READY_TO_START':
              return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50';
            case 'TAB_BLUR_WARNING':
              return 'bg-amber-950/80 text-amber-300 border-amber-500/50';
            case 'STRIKE_INCREMENT':
              return 'bg-orange-950/80 text-orange-300 border-orange-500/50';
            case 'DISQUALIFICATION':
            case 'ADMIN_DISQUALIFY_TEAM':
              return 'bg-red-950/90 text-red-300 border-red-500/60 font-black animate-pulse';
            case 'REINSTATE_TEAM':
            case 'ADMIN_CLEAR_STRIKES':
              return 'bg-teal-950/80 text-teal-300 border-teal-500/50';
            case 'FLAG_SUBMISSION':
              return 'bg-emerald-950/80 text-[#00ff66] border-emerald-500/50';
            case 'HINT_UNLOCK':
              return 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50';
            case 'SCREENSHOT_INTERCEPTED':
              return 'bg-rose-950/90 text-rose-300 border-rose-500/60 font-bold';
            case 'BROADCAST_SENT':
              return 'bg-yellow-950/80 text-yellow-300 border-yellow-500/50 font-bold';
            default:
              return 'bg-slate-800 text-slate-300 border-slate-700';
          }
        };

        return (
          <div className="space-y-4">
            {/* Header with Title and Export Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d111a] border border-slate-800 rounded-xl p-4">
              <div>
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-mono text-base font-bold text-white tracking-wide">
                    SYSTEM-WIDE TIMESTAMPED AUDIT LOGS
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                    {auditLogs.length} EVENTS PERSISTED
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-sans">
                  Microsecond-precision UTC audit trail captured directly in database. Every student and admin action is persistently recorded.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportAuditCSV}
                  className="px-3 py-1.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-[#00e5ff] border border-cyan-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-[0_0_12px_rgba(0,229,255,0.15)]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>EXPORT AUDIT CSV</span>
                </button>
                <button
                  onClick={fetchAdminData}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  title="Refresh Audit Trail"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Stats Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-[#0d111a] border border-slate-800">
                <div className="text-slate-400 text-[11px]">STUDENT ACTIONS</div>
                <div className="text-lg font-bold text-purple-400 mt-1">{studentCount}</div>
              </div>
              <div className="p-3 rounded-lg bg-[#0d111a] border border-slate-800">
                <div className="text-slate-400 text-[11px]">ADMIN OPERATIONS</div>
                <div className="text-lg font-bold text-amber-400 mt-1">{adminCount}</div>
              </div>
              <div className="p-3 rounded-lg bg-[#0d111a] border border-slate-800">
                <div className="text-slate-400 text-[11px]">SYSTEM AUTOMATIONS</div>
                <div className="text-lg font-bold text-cyan-400 mt-1">{systemCount}</div>
              </div>
              <div className="p-3 rounded-lg bg-[#0d111a] border border-slate-800">
                <div className="text-slate-400 text-[11px]">DISQUALIFICATIONS</div>
                <div className="text-lg font-bold text-rose-400 mt-1">{disqCount}</div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-[#0d111a] border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
              {/* Actor Filter Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500 mr-1 text-[11px]">ACTOR:</span>
                {(['ALL', 'STUDENT', 'ADMIN', 'SYSTEM'] as const).map((actor) => (
                  <button
                    key={actor}
                    onClick={() => setAuditActorFilter(actor)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      auditActorFilter === actor
                        ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                        : 'bg-[#080b12] text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {actor}
                  </button>
                ))}
              </div>

              {/* Action Filter Selector */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11px]">ACTION:</span>
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="bg-[#080b12] border border-slate-800 text-slate-200 rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">ALL ACTIONS</option>
                  <option value="REGISTRATION">REGISTRATION</option>
                  <option value="LOGIN">LOGIN</option>
                  <option value="READY_TO_START">READY_TO_START</option>
                  <option value="TAB_BLUR_WARNING">TAB_BLUR_WARNING</option>
                  <option value="STRIKE_INCREMENT">STRIKE_INCREMENT</option>
                  <option value="DISQUALIFICATION">DISQUALIFICATION</option>
                  <option value="REINSTATE_TEAM">REINSTATE_TEAM</option>
                  <option value="FLAG_SUBMISSION">FLAG_SUBMISSION</option>
                  <option value="HINT_UNLOCK">HINT_UNLOCK</option>
                  <option value="SCREENSHOT_INTERCEPTED">SCREENSHOT_INTERCEPTED</option>
                  <option value="ARTIFACT_INSPECTED">ARTIFACT_INSPECTED</option>
                  <option value="ADMIN_TIMER_START">ADMIN_TIMER_START</option>
                  <option value="ADMIN_TIMER_PAUSE">ADMIN_TIMER_PAUSE</option>
                  <option value="ADMIN_TIMER_RESUME">ADMIN_TIMER_RESUME</option>
                  <option value="ADMIN_TIMER_RESTART">ADMIN_TIMER_RESTART</option>
                  <option value="ADMIN_TIMER_SET">ADMIN_TIMER_SET</option>
                  <option value="ADMIN_SCORE_ADJUST">ADMIN_SCORE_ADJUST</option>
                  <option value="ADMIN_DISQUALIFY_TEAM">ADMIN_DISQUALIFY_TEAM</option>
                  <option value="ADMIN_CLEAR_STRIKES">ADMIN_CLEAR_STRIKES</option>
                  <option value="ADMIN_CHALLENGE_CREATE">ADMIN_CHALLENGE_CREATE</option>
                  <option value="ADMIN_CHALLENGE_UPDATE">ADMIN_CHALLENGE_UPDATE</option>
                  <option value="ADMIN_CHALLENGE_DELETE">ADMIN_CHALLENGE_DELETE</option>
                  <option value="BROADCAST_SENT">BROADCAST_SENT</option>
                </select>
              </div>

              {/* Search Query Input */}
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search actor, action, IP, metadata..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  className="w-full bg-[#080b12] border border-slate-800 rounded px-3 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            {/* Audit Logs Stream List */}
            <div className="rounded-xl bg-[#0d111a] border border-slate-800 divide-y divide-slate-800/80 font-mono text-xs overflow-hidden">
              {filteredAudit.map((log) => {
                let parsedDetails: any = null;
                try {
                  parsedDetails = JSON.parse(log.details);
                } catch {
                  parsedDetails = log.details;
                }

                return (
                  <div
                    key={log.logId}
                    className="p-3.5 hover:bg-slate-800/30 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Actor Type Pill */}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.actorType === 'ADMIN'
                            ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                            : log.actorType === 'STUDENT'
                            ? 'bg-purple-950 text-purple-300 border border-purple-500/50'
                            : 'bg-cyan-950 text-cyan-300 border border-cyan-500/50'
                        }`}>
                          {log.actorType}
                        </span>

                        {/* Action Type Badge */}
                        <span className={`px-2 py-0.5 rounded text-[10px] border font-bold ${getActionBadgeColor(log.actionType)}`}>
                          {log.actionType}
                        </span>

                        {/* Actor Identifier */}
                        <span className="font-bold text-white text-xs">
                          {log.actorIdentifier}
                        </span>

                        {/* IP Badge */}
                        <span className="text-[11px] text-slate-500 font-mono">
                          IP: {log.ipAddress}
                        </span>

                        {/* Log ID Truncated */}
                        <span className="text-[10px] text-slate-600 font-mono" title={log.logId}>
                          #{log.logId.slice(0, 8)}
                        </span>
                      </div>

                      {/* Details / Metadata Rendering */}
                      <div className="text-slate-300 text-xs font-mono bg-[#080b12] border border-slate-900 rounded p-2 overflow-x-auto">
                        {typeof parsedDetails === 'object' && parsedDetails !== null ? (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                            {Object.entries(parsedDetails).map(([k, v]) => (
                              <div key={k} className="flex items-center gap-1">
                                <span className="text-slate-500">{k}:</span>
                                <span className="text-cyan-300 font-bold">
                                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-slate-300 text-[11px]">{String(parsedDetails)}</div>
                        )}
                      </div>
                    </div>

                    {/* Exact Timestamp (UTC ISO Datetime) */}
                    <div className="text-right shrink-0 md:pl-3">
                      <div className="text-[11px] text-[#00ff66] font-mono font-bold">
                        {log.timestamp}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} local
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredAudit.length === 0 && (
                <div className="py-16 text-center text-slate-500">
                  <History className="w-10 h-10 text-slate-700 mx-auto mb-2 animate-pulse" />
                  <p className="font-bold text-slate-400">No audit logs matching active filter.</p>
                  <p className="text-[11px] text-slate-600 mt-1">Actions by students and admins are automatically saved to SQLite.</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB: VALUABLE USER FEEDBACK ARCHIVE */}
      {activeTab === 'FEEDBACK' && (() => {
        const filteredFeedbacks = feedbacks.filter((fb) => {
          if (!feedbackSearchQuery.trim()) return true;
          const q = feedbackSearchQuery.toLowerCase().trim();
          return (
            fb.teamName.toLowerCase().includes(q) ||
            fb.favoriteHighlight.toLowerCase().includes(q) ||
            fb.suggestionsRound3.toLowerCase().includes(q) ||
            fb.challengeDifficulty.toLowerCase().includes(q)
          );
        });

        const avgUi = feedbacks.length
          ? (feedbacks.reduce((acc, f) => acc + f.ratingUi, 0) / feedbacks.length).toFixed(1)
          : '5.0';
        const avgStability = feedbacks.length
          ? (feedbacks.reduce((acc, f) => acc + f.platformStability, 0) / feedbacks.length).toFixed(1)
          : '5.0';
        const avgClarity = feedbacks.length
          ? (feedbacks.reduce((acc, f) => acc + f.clarityRulesHints, 0) / feedbacks.length).toFixed(1)
          : '5.0';

        return (
          <div className="space-y-4 font-mono animate-fadeIn">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-[#080b12] border border-pink-500/30">
                <div className="text-[10px] text-slate-400 font-bold uppercase">TOTAL SUBMISSIONS</div>
                <div className="text-2xl font-black text-pink-400 mt-1">{feedbacks.length}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Community voices</div>
              </div>

              <div className="p-4 rounded-xl bg-[#080b12] border border-cyan-500/30">
                <div className="text-[10px] text-slate-400 font-bold uppercase">AVG UI / UX RATING</div>
                <div className="text-2xl font-black text-cyan-400 mt-1">{avgUi} / 5.0</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Design &amp; clarity</div>
              </div>

              <div className="p-4 rounded-xl bg-[#080b12] border border-emerald-500/30">
                <div className="text-[10px] text-slate-400 font-bold uppercase">AVG STABILITY</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">{avgStability} / 5.0</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Real-time latency</div>
              </div>

              <div className="p-4 rounded-xl bg-[#080b12] border border-amber-500/30">
                <div className="text-[10px] text-slate-400 font-bold uppercase">AVG RULES CLARITY</div>
                <div className="text-2xl font-black text-amber-400 mt-1">{avgClarity} / 5.0</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Section A/B &amp; hints</div>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#080b12] border border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquareHeart className="w-4 h-4 text-pink-400" />
                <h3 className="text-sm font-bold text-white tracking-wider">
                  PARTICIPANT FEEDBACK &amp; HONEST REPLIES ({filteredFeedbacks.length})
                </h3>
              </div>

              <div className="w-full sm:w-72">
                <input
                  type="text"
                  value={feedbackSearchQuery}
                  onChange={(e) => setFeedbackSearchQuery(e.target.value)}
                  placeholder="Search team, favorite challenge, suggestions..."
                  className="w-full px-3 py-1.5 rounded-lg bg-[#040810] border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-pink-400 transition-colors"
                />
              </div>
            </div>

            {/* Feedback Cards List */}
            <div className="space-y-4">
              {filteredFeedbacks.map((fb) => (
                <div
                  key={fb.id}
                  className="p-5 rounded-2xl bg-[#08111d]/90 border border-slate-800 hover:border-slate-700 transition-all space-y-4"
                >
                  {/* Top Bar: Squad Name & Submission Time */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-pink-400 shadow-[0_0_8px_#f472b6]" />
                      <span className="text-base font-black text-white">Team {fb.teamName}</span>
                      <span className="text-[10px] text-slate-500">ID: {fb.teamId}</span>
                    </div>

                    <div className="text-xs text-slate-400 font-mono">
                      {new Date(fb.submittedAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {/* 5 Rating Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#040810] border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 uppercase">1. UI Design</div>
                      <div className="font-bold text-cyan-400 mt-0.5">{fb.ratingUi} / 5 ⭐</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#040810] border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 uppercase">2. Difficulty</div>
                      <div className="font-bold text-amber-400 mt-0.5 capitalize">
                        {fb.challengeDifficulty.replace('_', ' ')}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#040810] border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 uppercase">3. Stability</div>
                      <div className="font-bold text-emerald-400 mt-0.5">{fb.platformStability} / 5 ⚡</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#040810] border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 uppercase">4. Fair Play</div>
                      <div className="font-bold text-purple-400 mt-0.5 capitalize">
                        {fb.fairPlaySecurity.replace('_', ' ')}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#040810] border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 uppercase">5. Clarity</div>
                      <div className="font-bold text-cyan-400 mt-0.5">{fb.clarityRulesHints} / 5 📖</div>
                    </div>
                  </div>

                  {/* Question 6: Favorite Challenge */}
                  {fb.favoriteHighlight && (
                    <div className="p-3.5 rounded-xl bg-[#050e18] border border-cyan-500/30 text-xs">
                      <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 fill-cyan-400/30" />
                        <span>6. Favorite Challenge / Platform Feature:</span>
                      </div>
                      <p className="text-slate-200 font-sans leading-relaxed">{fb.favoriteHighlight}</p>
                    </div>
                  )}

                  {/* Question 7: Candid Suggestions for Round 3 */}
                  {fb.suggestionsRound3 && (
                    <div className="p-3.5 rounded-xl bg-[#140810] border border-rose-500/30 text-xs">
                      <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <MessageSquareHeart className="w-3.5 h-3.5" />
                        <span>7. Candid Suggestions for Round 3 (Honest Reply):</span>
                      </div>
                      <p className="text-slate-200 font-sans leading-relaxed whitespace-pre-wrap">
                        {fb.suggestionsRound3}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {filteredFeedbacks.length === 0 && (
                <div className="py-16 text-center text-slate-500 rounded-2xl bg-[#080b12] border border-slate-800">
                  <MessageSquareHeart className="w-10 h-10 text-slate-700 mx-auto mb-2 animate-pulse" />
                  <p className="font-bold text-slate-400">No valuable feedback submissions yet.</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    When participants fill out the 7-question feedback form, responses will stream here live.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB 5: LOGS & TELEMETRY */}
      {activeTab === 'LOGS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-sm font-bold text-white">
              SECURITY AUDIT & TELEMETRY STREAM ({logs.securityLogs.length} EVENTS)
            </h3>
            {logs.securityLogs.length > 0 && (
              <button
                type="button"
                onClick={handleClearSecurityLogs}
                disabled={isClearingLogs}
                className="px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-500/40 text-red-400 hover:bg-red-900/60 hover:text-white font-mono text-xs transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearingLogs ? 'PURGING...' : 'PURGE INCIDENT LOGS'}</span>
              </button>
            )}
          </div>

          <div className="rounded-xl bg-[#0d111a] border border-slate-800 p-4 space-y-2 text-xs font-mono">
            {logs.securityLogs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded border flex items-start justify-between gap-3 ${
                  log.severity === 'high'
                    ? 'bg-red-950/20 border-red-500/40 text-red-300'
                    : 'bg-[#080b12] border-slate-800 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">[{log.type}]</span>
                    {log.teamName && (
                      <span className="text-amber-400 font-bold">Team: {log.teamName}</span>
                    )}
                    <span className="text-slate-500">IP: {log.ip}</span>
                  </div>
                  <div className="mt-1">{log.details}</div>
                </div>

                <div className="text-[10px] text-slate-500 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}

            {logs.securityLogs.length === 0 && (
              <div className="py-8 text-center text-slate-500">
                No security incidents logged. Perimeter secure.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Challenge Edit Modal */}
      {isEditingChallenge && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-[#0d111a] border-2 border-emerald-500/50 rounded-xl p-6 max-w-xl w-full max-h-[85vh] overflow-y-auto font-mono text-xs shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">
                {editingChallenge.id ? 'EDIT CHALLENGE' : 'ADD NEW CHALLENGE'}
              </h4>
              <button
                onClick={() => setIsEditingChallenge(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveChallenge} className="space-y-3 mt-4">
              <div>
                <label className="text-slate-400 block mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editingChallenge.title || ''}
                  onChange={(e) => setEditingChallenge({ ...editingChallenge, title: e.target.value })}
                  className="w-full bg-[#080b12] border border-slate-700 rounded px-3 py-1.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Section</label>
                  <select
                    value={editingChallenge.section}
                    onChange={(e) => setEditingChallenge({ ...editingChallenge, section: e.target.value as any })}
                    className="w-full bg-[#080b12] border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="Section A">Section A</option>
                    <option value="Section B">Section B</option>
                    <option value="Section A (Find the Clue, Find the Key)">Section A (Find the Clue, Find the Key)</option>
                    <option value="Section B (The Decode Chamber)">Section B (The Decode Chamber)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Category</label>
                  <select
                    value={editingChallenge.category}
                    onChange={(e) => setEditingChallenge({ ...editingChallenge, category: e.target.value as any })}
                    className="w-full bg-[#080b12] border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    {['CRYPTO', 'STEGO', 'FORENSICS', 'REV', 'OSINT', 'AUDIO', 'WEB', 'MISC'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Points</label>
                  <input
                    type="number"
                    value={editingChallenge.points || 100}
                    onChange={(e) => setEditingChallenge({ ...editingChallenge, points: Number(e.target.value) })}
                    className="w-full bg-[#080b12] border border-slate-700 rounded px-2 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Max Attempts</label>
                  <input
                    type="number"
                    value={editingChallenge.maxAttempts || 5}
                    onChange={(e) => setEditingChallenge({ ...editingChallenge, maxAttempts: Number(e.target.value) })}
                    className="w-full bg-[#080b12] border border-slate-700 rounded px-2 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Difficulty</label>
                  <select
                    value={editingChallenge.difficulty}
                    onChange={(e) => setEditingChallenge({ ...editingChallenge, difficulty: e.target.value as any })}
                    className="w-full bg-[#080b12] border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                    <option value="Insane">Insane</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Secret Flag</label>
                <input
                  type="text"
                  required
                  value={editingChallenge.flag || ''}
                  onChange={(e) => setEditingChallenge({ ...editingChallenge, flag: e.target.value })}
                  className="w-full bg-[#080b12] border border-slate-700 rounded px-3 py-1.5 text-amber-300 font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editingChallenge.description || ''}
                  onChange={(e) => setEditingChallenge({ ...editingChallenge, description: e.target.value })}
                  className="w-full bg-[#080b12] border border-slate-700 rounded px-3 py-1.5 text-white"
                />
              </div>

              {/* Challenge Hints Marketplace Configuration */}
              <div className="border border-slate-800 p-3.5 rounded-xl bg-[#080b12] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-slate-200 font-bold block text-xs">
                      CHALLENGE HINTS (OPTIONAL MARKETPLACE)
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Add clues that students can unlock with point deductions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const currentHints = editingChallenge.hints || [];
                      const nextIdx = currentHints.length + 1;
                      setEditingChallenge({
                        ...editingChallenge,
                        hints: [
                          ...currentHints,
                          {
                            id: `hint-${Date.now()}-${nextIdx}`,
                            title: `Hint #${nextIdx}`,
                            cost: 20,
                            content: '',
                          },
                        ],
                      });
                    }}
                    className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ADD HINT</span>
                  </button>
                </div>

                {(!editingChallenge.hints || editingChallenge.hints.length === 0) ? (
                  <div className="text-[11px] text-slate-500 italic py-2 text-center border border-dashed border-slate-800 rounded-lg">
                    No hints added yet. Click "+ ADD HINT" above to give students unlockable clues with customizable point costs.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {editingChallenge.hints.map((hint, idx) => (
                      <div
                        key={hint.id || idx}
                        className="p-2.5 rounded-lg bg-[#0d111a] border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                            HINT #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedHints = (editingChallenge.hints || []).filter((_, i) => i !== idx);
                              setEditingChallenge({
                                ...editingChallenge,
                                hints: updatedHints,
                              });
                            }}
                            className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                            title="Remove this hint"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-slate-400 block mb-0.5">Hint Title</label>
                            <input
                              type="text"
                              value={hint.title}
                              onChange={(e) => {
                                const updated = [...(editingChallenge.hints || [])];
                                updated[idx] = { ...updated[idx], title: e.target.value };
                                setEditingChallenge({ ...editingChallenge, hints: updated });
                              }}
                              placeholder={`e.g. Analysis Clue #${idx + 1}`}
                              className="w-full bg-[#050811] border border-slate-700 rounded px-2 py-1 text-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Unlock Cost (PTS)</label>
                            <input
                              type="number"
                              min="0"
                              max={editingChallenge.points || 1000}
                              value={hint.cost}
                              onChange={(e) => {
                                const updated = [...(editingChallenge.hints || [])];
                                updated[idx] = { ...updated[idx], cost: Number(e.target.value) };
                                setEditingChallenge({ ...editingChallenge, hints: updated });
                              }}
                              className="w-full bg-[#050811] border border-slate-700 rounded px-2 py-1 text-amber-300 font-bold text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Revealed Content / Clue</label>
                          <textarea
                            rows={2}
                            value={hint.content}
                            onChange={(e) => {
                              const updated = [...(editingChallenge.hints || [])];
                              updated[idx] = { ...updated[idx], content: e.target.value };
                              setEditingChallenge({ ...editingChallenge, hints: updated });
                            }}
                            placeholder="Enter the secret clue revealed when students unlock this hint..."
                            className="w-full bg-[#050811] border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5.) Secure File Attachment Upload */}
              <div className="border border-slate-800 p-3 rounded bg-[#080b12]">
                <label className="text-slate-300 font-bold block mb-1 flex items-center justify-between">
                  <span>SECURE CHALLENGE ARTIFACT (ATTACHMENT)</span>
                  <span className="text-[10px] text-emerald-400 font-normal">MAX 5MB · WHITELIST CHECK</span>
                </label>
                <div className="text-[10px] text-slate-500 mb-2">
                  Permitted: .png, .jpg, .wav, .txt, .log, .py, .bin, .raw, .pcap, .zip | Blocked: .exe, .sh, .php, .svg
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.gif,.svg,.wav,.mp3,.txt,.log,.py,.c,.cpp,.bin,.raw,.pcap,.zip,.json,.dump"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      // Security size check
                      if (file.size > 5 * 1024 * 1024) {
                        setAttachmentError('Security Violation: File payload exceeds 5MB limit.');
                        e.target.value = '';
                        return;
                      }

                      // Security extension check
                      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
                      const forbidden = ['.php', '.phtml', '.exe', '.sh', '.bat', '.cmd', '.msi', '.vbs', '.html', '.js'];
                      if (forbidden.includes(ext)) {
                        setAttachmentError(`Security Violation: File extension ${ext} is strictly blacklisted.`);
                        e.target.value = '';
                        return;
                      }

                      setAttachmentError(null);
                      const isTextFile = /\.(txt|log|py|c|cpp|json|svg|md)$/i.test(ext);
                      const reader = new FileReader();
                      reader.onload = () => {
                        let content = reader.result as string;
                        if (!isTextFile && typeof content === 'string') {
                          const commaIndex = content.indexOf(',');
                          if (commaIndex !== -1) {
                            content = 'base64:' + content.slice(commaIndex + 1);
                          }
                        }
                        setEditingChallenge({
                          ...editingChallenge,
                          attachment: {
                            fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
                            mimeType: file.type || 'application/octet-stream',
                            size: (file.size / 1024).toFixed(1) + ' KB',
                            content: typeof content === 'string' ? content : '',
                          },
                        });
                      };
                      if (isTextFile) {
                        reader.readAsText(file);
                      } else {
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-slate-800 file:text-emerald-400 hover:file:bg-slate-700"
                  />

                  {editingChallenge.attachment && (
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                      <span>✓ {editingChallenge.attachment.fileName}</span>
                      <span className="text-slate-500">({editingChallenge.attachment.size})</span>
                    </div>
                  )}
                </div>

                {attachmentError && (
                  <div className="mt-2 text-[10px] text-red-400 font-mono flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    <span>{attachmentError}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingChallenge(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#00ff66] text-black font-bold"
                >
                  Save Challenge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Score Adjust Modal */}
      {scoreAdjustTeam && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0d111a] border border-amber-500/40 rounded-xl p-5 max-w-sm w-full font-mono text-xs">
            <h4 className="font-bold text-white text-sm mb-3">
              ADJUST SCORE: {scoreAdjustTeam.teamName}
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Point Delta (+/-)</label>
                <input
                  type="number"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(Number(e.target.value))}
                  placeholder="e.g. +50 or -25"
                  className="w-full bg-[#080b12] border border-slate-700 rounded px-3 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Reason for Audit Log</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Rule breach penalty"
                  className="w-full bg-[#080b12] border border-slate-700 rounded px-3 py-1.5 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setScoreAdjustTeam(null)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmScoreAdjust}
                  className="px-3 py-1.5 rounded bg-amber-500 text-black font-bold"
                >
                  Apply Delta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Reset Competition */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0d111a] border-2 border-red-500/60 rounded-xl p-6 max-w-md w-full font-mono text-xs shadow-2xl">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
              <span>CONFIRM FULL COMPETITION RESET</span>
            </div>
            <p className="text-slate-300 font-sans text-xs leading-relaxed mb-4">
              DANGER: This action will permanently erase all registered teams, participant activities, screenshot alerts, audit logs/trails, submissions, and reset all exported CSV datasets for a fresh tournament session. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-bold shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              >
                Confirm Full Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Challenge */}
      {challengeToDelete && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0d111a] border-2 border-red-500/50 rounded-xl p-6 max-w-sm w-full font-mono text-xs shadow-2xl">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2">
              <Trash2 className="w-4 h-4 text-red-400" />
              <span>DELETE CHALLENGE</span>
            </div>
            <p className="text-slate-300 text-xs mb-4">
              Are you sure you want to delete <strong className="text-white">"{challengeToDelete.title}"</strong>? All associated solve records will be cleared.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setChallengeToDelete(null)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteChallenge}
                className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold"
              >
                Delete Challenge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Disqualify Team */}
      {teamToDisqualify && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0d111a] border-2 border-red-500/70 rounded-xl p-6 max-w-lg w-full font-mono text-xs shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-red-500/30 pb-3">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
                <span>ADMIN DISQUALIFICATION ARBITRATION</span>
              </div>
              <button
                onClick={() => setTeamToDisqualify(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-red-950/20 border border-red-500/30 rounded-lg p-3 space-y-1.5">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Target Squad:</div>
              <div className="text-sm font-black text-white flex items-center gap-2">
                <span className="text-red-400">[{teamToDisqualify.teamName}]</span>
                <span className="text-[10px] text-slate-400 font-normal">ID: {teamToDisqualify.id}</span>
              </div>
              {teamToDisqualify.members && teamToDisqualify.members.length > 0 && (
                <div className="text-[10px] text-slate-400">
                  Members: <span className="text-slate-300">{teamToDisqualify.members.join(', ')}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold block text-[11px]">
                Disqualification Reason (Displayed on student portal & audit log):
              </label>
              <textarea
                value={disqualifyReason}
                onChange={(e) => setDisqualifyReason(e.target.value)}
                rows={3}
                className="w-full bg-[#050811] border border-slate-700 focus:border-red-500 rounded p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                placeholder="Enter formal arbitration reason..."
              />
            </div>

            {/* Quick Reason Presets */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Quick Presets:</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Repeated screen capture & screenshot violation',
                  'Unauthorized tab switching & devtools access',
                  'Flag sharing & unauthorized team collusion',
                  'Violation of competition rules & fair play policy',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDisqualifyReason(preset)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-950/20 border border-amber-500/30 rounded p-2.5 text-[11px] text-amber-300/90 leading-relaxed">
              <strong>Admin Note:</strong> Disqualification immediately caps strikes at 10, invalidates active sessions, and locks challenge submissions for this team. You can reverse this at any time by clicking <strong>Reinstate</strong> on the Teams roster.
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTeamToDisqualify(null)}
                className="px-3.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisqualifyTeam}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Confirm Disqualification</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Restart Timer */}
      {showRestartModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0d111a] border-2 border-cyan-500/60 rounded-xl p-6 max-w-md w-full font-mono text-xs shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <RotateCcw className="w-5 h-5 text-cyan-400" />
              <span>RESTART COMPETITION TIMER</span>
            </div>

            <p className="text-slate-300 text-xs leading-relaxed">
              Restarting will reset the countdown clock to your chosen duration and immediately resume competition submissions for all participants.
            </p>

            <div className="space-y-2">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Select Restart Duration:
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '1 Hour', mins: 60 },
                  { label: '2 Hours (Std)', mins: 120 },
                  { label: '3 Hours', mins: 180 },
                ].map((preset) => (
                  <button
                    key={preset.mins}
                    type="button"
                    onClick={() => {
                      setRestartDurationMinutes(preset.mins);
                    }}
                    className={`py-2 px-3 rounded-lg border text-center font-bold text-xs transition-colors cursor-pointer ${
                      restartDurationMinutes === preset.mins
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Minutes Option */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setRestartDurationMinutes(-1)}
                  className={`text-xs text-left mb-1.5 font-bold transition-colors cursor-pointer ${
                    restartDurationMinutes === -1 ? 'text-cyan-300' : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  Custom Duration:
                </button>
                {restartDurationMinutes === -1 && (
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={customRestartInput}
                    onChange={(e) => setCustomRestartInput(e.target.value)}
                    placeholder="Enter custom minutes (e.g. 45)..."
                    className="w-full bg-[#050811] border border-cyan-500/60 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-cyan-400"
                    autoFocus
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowRestartModal(false)}
                className="px-3.5 py-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestartTimer}
                className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>CONFIRM & RESTART NOW</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
