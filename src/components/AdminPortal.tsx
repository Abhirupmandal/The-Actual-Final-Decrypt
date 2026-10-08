import React, { useState, useEffect } from 'react';
import {
  Lock,
  Play,
  Pause,
  RotateCcw,
  Megaphone,
  Download,
  Users,
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
  X,
} from 'lucide-react';
import type { Challenge, Team, SecurityLog, ActivityFeedEvent, CompetitionState } from '../types.ts';
import { playCyberBlip, playSuccessChime, playErrorBuzz } from '../utils/audio.ts';

interface AdminPortalProps {
  adminToken: string;
  competitionState: CompetitionState;
  onRefreshState: () => void;
  onLogoutAdmin: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  adminToken,
  competitionState,
  onRefreshState,
  onLogoutAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'CONTROLS' | 'CHALLENGES' | 'TEAMS' | 'LOGS'>('CONTROLS');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [logs, setLogs] = useState<{ securityLogs: SecurityLog[]; activityFeed: ActivityFeedEvent[] }>({
    securityLogs: [],
    activityFeed: [],
  });

  // UI Notification & Confirmation Modal States
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [challengeToDelete, setChallengeToDelete] = useState<Challenge | null>(null);
  const [teamToDisqualify, setTeamToDisqualify] = useState<Team | null>(null);

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
    } catch (e) {
      console.error('Failed to load admin data', e);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 4000);
    return () => clearInterval(interval);
  }, [adminToken]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Timer Handlers
  const handleTimerAction = async (action: 'start' | 'pause' | 'add', seconds?: number) => {
    playCyberBlip(800);
    await fetch('/api/admin/timer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ action, seconds }),
    });
    onRefreshState();
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

  // Save Challenge
  const handleSaveChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    playCyberBlip(800);

    const isExisting = Boolean(editingChallenge.id);
    const url = isExisting
      ? `/api/admin/challenges/${editingChallenge.id}`
      : '/api/admin/challenges';
    const method = isExisting ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify(editingChallenge),
    });

    setIsEditingChallenge(false);
    fetchAdminData();
    onRefreshState();
    playSuccessChime();
    setNotification({ type: 'success', text: isExisting ? 'Challenge updated.' : 'New challenge created.' });
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

  // Disqualify Team
  const handleConfirmDisqualifyTeam = async () => {
    if (!teamToDisqualify) return;
    const teamId = teamToDisqualify.id;
    const teamName = teamToDisqualify.teamName;
    setTeamToDisqualify(null);
    playErrorBuzz();
    await fetch(`/api/admin/teams/${teamId}/disqualify`, {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
    });
    setNotification({ type: 'info', text: `Team [${teamName}] disqualified.` });
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
              <span>COMMAND HQ · MASTER ADMIN CONTROL PANEL</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
              CTF ARBITRATION & CONTROL
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-sans mt-0.5">
              Full authoritative access: manage timer, push instant broadcasts, audit security anomalies, and configure challenges.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-[#00ff66] border border-emerald-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT SCOREBOARD CSV</span>
            </button>
            <button
              onClick={onLogoutAdmin}
              className="px-3.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
            >
              Exit HQ
            </button>
          </div>
        </div>

        {/* Admin Subtabs */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap gap-2 text-xs font-mono">
          {(['CONTROLS', 'CHALLENGES', 'TEAMS', 'LOGS'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                playCyberBlip(650);
                setActiveTab(tab);
              }}
              className={`px-3 py-1.5 rounded transition-all ${
                activeTab === tab
                  ? 'bg-amber-500 text-black font-bold shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'bg-[#080b12] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: CONTROLS */}
      {activeTab === 'CONTROLS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Global Timer Card */}
          <div className="rounded-xl bg-[#0d111a] border border-slate-800 p-5 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                GLOBAL COMPETITION TIMER
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${competitionState.status === 'running' ? 'bg-emerald-500/20 text-[#00ff66]' : 'bg-amber-500/20 text-amber-400'}`}>
                {competitionState.status}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Current Remaining Time:</span>
              <span className="text-xl font-bold text-[#00ff66] tracking-widest">
                {Math.floor(competitionState.remainingSeconds / 60)}m {competitionState.remainingSeconds % 60}s
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {competitionState.status === 'running' ? (
                <button
                  onClick={() => handleTimerAction('pause')}
                  className="px-3.5 py-2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 flex items-center gap-1.5 font-bold"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>PAUSE TIMER</span>
                </button>
              ) : (
                <button
                  onClick={() => handleTimerAction('start')}
                  className="px-3.5 py-2 rounded bg-emerald-500/20 text-[#00ff66] border border-emerald-500/50 hover:bg-emerald-500/30 flex items-center gap-1.5 font-bold"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>START / RESUME TIMER</span>
                </button>
              )}

              <button
                onClick={() => handleTimerAction('add', 900)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                +15 Min
              </button>
              <button
                onClick={() => handleTimerAction('add', 1800)}
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                +30 Min
              </button>
            </div>
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
            </div>

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
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>BROADCAST TO ALL SCREENS</span>
              </button>
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

          {/* Danger Zone: Reset Competition */}
          <div className="rounded-xl bg-red-950/20 border border-red-500/40 p-5 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-red-500/30">
              <span className="font-bold text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                DANGER ZONE: COMPETITION RESET
              </span>
            </div>

            <p className="text-slate-300 font-sans text-xs">
              Wipes all submissions, resets team scores to zero, clears unlocked hints, and unlocks locked cards for a fresh tournament session.
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
                      <div className="font-bold text-white">{c.title}</div>
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

      {/* TAB 3: TEAMS */}
      {activeTab === 'TEAMS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-sm font-bold text-white">
              REGISTERED TEAMS & TELEMETRY ({teams.length})
            </h3>
          </div>

          <div className="rounded-xl bg-[#0d111a] border border-slate-800 overflow-x-auto text-xs font-mono">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#080b12] border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-4">TEAM NAME</th>
                  <th className="py-3 px-4">OPERATORS</th>
                  <th className="py-3 px-4 text-center">SCORE</th>
                  <th className="py-3 px-4 text-center">STRIKES (5-RULE)</th>
                  <th className="py-3 px-4 text-center">FAILED ATTEMPTS</th>
                  <th className="py-3 px-4">IP / ANOMALY</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {teams.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm">{t.teamName}</div>
                      <div className="text-[10px] text-slate-500">ID: {t.id}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {t.members.join(', ')}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-[#00ff66]">
                      {t.score} PTS
                    </td>
                    <td className="py-3 px-4 text-center">
                      {t.isDisqualified ? (
                        <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-500 font-bold text-[10px]">
                          DISQUALIFIED
                        </span>
                      ) : (
                        <span className={`font-bold ${t.strikes > 2 ? 'text-amber-400' : 'text-slate-300'}`}>
                          {t.strikes || 0} / 5
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-400">
                      {t.totalFailedAttempts}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-400">{t.ip}</div>
                      {t.isFlaggedAnomaly && (
                        <div className="text-[10px] text-red-400 flex items-center gap-1 font-bold">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{t.anomalyReason || 'Velocity flag'}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => {
                            setScoreAdjustTeam(t);
                            setAdjustDelta(0);
                            setAdjustReason('');
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                        >
                          Adjust Pts
                        </button>
                        {t.strikes > 0 || t.isDisqualified ? (
                          <button
                            onClick={() => handleClearStrikes(t.id)}
                            className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px]"
                            title="Reset strikes and reinstate team"
                          >
                            Reset Strikes
                          </button>
                        ) : (
                          <button
                            onClick={() => setTeamToDisqualify(t)}
                            className="px-2 py-1 rounded bg-red-900/30 text-red-400 border border-red-800 text-[11px]"
                            title="Disqualify team from tournament"
                          >
                            Disqualify
                          </button>
                        )}
                        {t.isFlaggedAnomaly && (
                          <button
                            onClick={() => handleClearAnomaly(t.id)}
                            className="px-2 py-1 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[11px]"
                          >
                            Clear Flag
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LOGS & TELEMETRY */}
      {activeTab === 'LOGS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-sm font-bold text-white">
              SECURITY AUDIT & TELEMETRY STREAM ({logs.securityLogs.length} EVENTS)
            </h3>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d111a] border-2 border-emerald-500/40 rounded-xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto font-mono text-xs shadow-2xl">
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
                    <option value="Section A (Find the Clue, Find the Key)">Section A</option>
                    <option value="Section B (The Decode Chamber)">Section B</option>
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
                    accept=".png,.jpg,.jpeg,.gif,.wav,.mp3,.txt,.log,.py,.c,.cpp,.bin,.raw,.pcap,.zip,.json,.dump"
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
                      const forbidden = ['.php', '.phtml', '.exe', '.sh', '.bat', '.cmd', '.msi', '.vbs', '.svg', '.html', '.js'];
                      if (forbidden.includes(ext)) {
                        setAttachmentError(`Security Violation: File extension ${ext} is strictly blacklisted.`);
                        e.target.value = '';
                        return;
                      }

                      setAttachmentError(null);
                      const reader = new FileReader();
                      reader.onload = () => {
                        const content = reader.result as string;
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
                      reader.readAsText(file);
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d111a] border-2 border-red-500/60 rounded-xl p-6 max-w-md w-full font-mono text-xs shadow-2xl">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
              <span>CONFIRM FULL COMPETITION RESET</span>
            </div>
            <p className="text-slate-300 font-sans text-xs leading-relaxed mb-4">
              DANGER: This action will permanently erase all team submissions, clear solves and first-blood records, and reset the competition to an uninitialized clean state. This cannot be undone.
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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d111a] border-2 border-red-500/60 rounded-xl p-6 max-w-sm w-full font-mono text-xs shadow-2xl">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>DISQUALIFY TEAM</span>
            </div>
            <p className="text-slate-300 text-xs mb-4">
              Immediately disqualify <strong className="text-white">[{teamToDisqualify.teamName}]</strong>? This will revoke their session token and lock all submissions.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setTeamToDisqualify(null)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisqualifyTeam}
                className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold"
              >
                Disqualify Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
