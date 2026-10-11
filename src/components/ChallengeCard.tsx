import React, { useState } from 'react';
import {
  Download,
  Key,
  Flame,
  CheckCircle2,
  Lock,
  Unlock,
  HelpCircle,
  AlertCircle,
  FileText,
  BookOpen,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Terminal,
  Copy,
  Check,
  ShieldAlert,
  Eye,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { PublicChallengeView } from '../types.ts';
import { playCyberBlip, playSuccessChime, playErrorBuzz, playHintUnlockSound } from '../utils/audio.ts';

interface ChallengeCardProps {
  challenge: PublicChallengeView;
  teamLoggedIn: boolean;
  onOpenAuthModal: () => void;
  onViewWriteup: (challenge: PublicChallengeView) => void;
  onRefreshState: () => void;
  onViewArtifact?: (challengeId: string) => void;
}

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  teamLoggedIn,
  onOpenAuthModal,
  onViewWriteup,
  onRefreshState,
  onViewArtifact,
}) => {
  const [flagInput, setFlagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Accordion drawer for Hint Marketplace
  const [isHintsExpanded, setIsHintsExpanded] = useState(false);

  // Hint confirmation modal
  const [hintToUnlock, setHintToUnlock] = useState<{
    id: string;
    cost: number;
    title: string;
    index: number;
  } | null>(null);
  const [isUnlockingHint, setIsUnlockingHint] = useState(false);
  const [copiedHintId, setCopiedHintId] = useState<string | null>(null);

  const handleFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamLoggedIn) {
      onOpenAuthModal();
      return;
    }

    if (!flagInput.trim()) return;

    playCyberBlip(900);
    setIsSubmitting(true);
    setStatusMessage(null);

    const token = localStorage.getItem('ctf_team_token');

    try {
      const res = await fetch('/api/submit-flag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          challengeId: challenge.id,
          flag: flagInput.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        playSuccessChime();
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.65 },
          colors: ['#00ff66', '#10b981', '#00f0ff', '#ffffff', '#f59e0b'],
        });

        setStatusMessage({
          type: 'success',
          text: data.message || 'FLAG DECRYPTED! Points added to team score.',
        });
        setFlagInput('');
        onRefreshState();
      } else {
        playErrorBuzz();
        setStatusMessage({
          type: 'error',
          text: data.error || 'Invalid flag submission.',
        });
        onRefreshState();
      }
    } catch (err) {
      playErrorBuzz();
      setStatusMessage({
        type: 'error',
        text: 'Network transmission failure. Check console.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmUnlockHint = async () => {
    if (!hintToUnlock) return;
    const token = localStorage.getItem('ctf_team_token');
    if (!token) {
      onOpenAuthModal();
      return;
    }

    setIsUnlockingHint(true);
    try {
      const res = await fetch('/api/unlock-hint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          challengeId: challenge.id,
          hintId: hintToUnlock.id,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        playHintUnlockSound();
        setHintToUnlock(null);
        setStatusMessage({
          type: 'info',
          text: `Hint unlocked: -${hintToUnlock.cost} points deducted from final reward!`,
        });
        onRefreshState();
      } else {
        playErrorBuzz();
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to unlock hint.',
        });
        setHintToUnlock(null);
      }
    } catch (e) {
      playErrorBuzz();
      setStatusMessage({
        type: 'error',
        text: 'Network error unlocking hint. Please retry.',
      });
      setHintToUnlock(null);
    } finally {
      setIsUnlockingHint(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHintId(id);
    playCyberBlip(1000);
    setTimeout(() => setCopiedHintId(null), 2000);
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff) {
      case 'Easy':
        return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_8px_rgba(0,255,102,0.2)]';
      case 'Medium':
        return 'text-amber-400 border-amber-500/40 bg-amber-500/10 shadow-[0_0_8px_rgba(245,158,11,0.2)]';
      case 'Hard':
        return 'text-rose-400 border-rose-500/40 bg-rose-500/10 shadow-[0_0_8px_rgba(244,63,94,0.2)]';
      case 'Insane':
        return 'text-purple-400 border-purple-500/40 bg-purple-500/10 shadow-[0_0_8px_rgba(168,85,247,0.25)]';
      default:
        return 'text-slate-400 border-slate-700 bg-slate-800';
    }
  };

  // Color-coded category tags with distinct glowing neon neon borders
  const getCategoryBadge = (cat: string) => {
    switch (cat.toUpperCase()) {
      case 'CRYPTO':
        return 'text-[#00f0ff] border-[#00f0ff] bg-[#00f0ff]/10 shadow-[0_0_12px_rgba(0,240,255,0.35)]';
      case 'STEGO':
        return 'text-[#00ff66] border-[#00ff66] bg-[#00ff66]/10 shadow-[0_0_12px_rgba(0,255,102,0.35)]';
      case 'FORENSICS':
        return 'text-[#c084fc] border-[#a855f7] bg-[#a855f7]/12 shadow-[0_0_12px_rgba(168,85,247,0.35)]';
      case 'WEB':
        return 'text-[#38bdf8] border-[#38bdf8] bg-[#38bdf8]/10 shadow-[0_0_12px_rgba(56,189,248,0.35)]';
      case 'REV':
        return 'text-[#fb7185] border-[#f43f5e] bg-[#f43f5e]/12 shadow-[0_0_12px_rgba(244,63,94,0.35)]';
      case 'OSINT':
        return 'text-[#2dd4bf] border-[#14b8a6] bg-[#14b8a6]/10 shadow-[0_0_12px_rgba(20,184,166,0.35)]';
      case 'AUDIO':
        return 'text-[#fb923c] border-[#f97316] bg-[#f97316]/12 shadow-[0_0_12px_rgba(249,115,22,0.35)]';
      default:
        return 'text-[#fbbf24] border-[#f59e0b] bg-[#f59e0b]/10 shadow-[0_0_12px_rgba(245,158,11,0.35)]';
    }
  };

  return (
    <div
      className={`relative rounded-xl backdrop-blur-md transition-all duration-300 overflow-hidden flex flex-col justify-between group protected-challenge-card drm-screen-shield ${
        challenge.isSolved
          ? 'bg-[#0d111a]/90 border border-emerald-500/70 shadow-[0_0_25px_rgba(0,255,102,0.2),inset_0_0_20px_rgba(0,255,102,0.08)]'
          : challenge.isLocked
          ? 'scanline-red bg-[#140808]/90 border border-red-500/70 shadow-[0_0_25px_rgba(239,68,68,0.3),inset_0_0_20px_rgba(239,68,68,0.1)]'
          : 'bg-[#0d111a]/80 border border-[#00ff66]/20 hover:border-[#00ff66]/60 shadow-[0_0_20px_rgba(0,0,0,0.7)] hover:shadow-[0_0_25px_rgba(0,255,102,0.2)]'
      }`}
    >
      {/* Top Header Card */}
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-mono">
            {/* Category Badge Pill with Distinct Glowing Neon Border */}
            <span
              className={`px-3 py-0.5 rounded-full text-[11px] font-black border tracking-wider uppercase ${getCategoryBadge(
                challenge.category
              )}`}
            >
              {challenge.category}
            </span>

            {/* Difficulty Badge */}
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border tracking-wider ${getDifficultyBadge(
                challenge.difficulty
              )}`}
            >
              {challenge.difficulty}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {challenge.firstBloodTeam && (
              <div
                className="flex items-center gap-1.5 text-[10px] font-mono font-black text-amber-300 px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                title={`First Blood claimed by ${challenge.firstBloodTeam}`}
              >
                <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500 animate-pulse shrink-0" />
                <span className="hidden sm:inline">1ST BLOOD:</span>
                <span className="truncate max-w-[85px]">{challenge.firstBloodTeam}</span>
              </div>
            )}

            {/* Point Value in Monospace */}
            <div className="text-right">
              <span className="font-mono text-xl font-black text-[#00ff66] drop-shadow-[0_0_10px_rgba(0,255,102,0.6)]">
                {challenge.points}
              </span>
              <span className="text-[10px] font-mono text-slate-400 ml-1">PTS</span>
            </div>
          </div>
        </div>

        {/* Challenge Title */}
        <h3 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center justify-between gap-2 font-sans">
          <span className="group-hover:text-emerald-300 transition-colors">{challenge.title}</span>
          {challenge.isSolved && (
            <span className="flex items-center gap-1.5 text-[11px] font-mono font-black text-[#00ff66] bg-[#00ff66]/15 px-2.5 py-0.5 rounded-md border border-[#00ff66]/50 shrink-0 shadow-[0_0_12px_rgba(0,255,102,0.4)] animate-in slide-in-from-right-2 duration-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff66]" />
              <span>SOLVED</span>
            </span>
          )}
          {challenge.isLocked && !challenge.isSolved && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono font-black text-red-400 bg-red-950/80 px-2 py-0.5 rounded-md border border-red-500/80 shrink-0 shadow-[0_0_12px_rgba(239,68,68,0.4)]">
              <Lock className="w-3 h-3 text-red-400" />
              <span>LOCKED</span>
            </span>
          )}
        </h3>

        {/* Section Subtitle */}
        <div className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-wider">
          {challenge.section}
        </div>

        {/* Description in Clean Sans-Serif */}
        <p className="mt-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
          {challenge.description}
        </p>

        {/* Secure In-Browser Artifact Display & Download Bar */}
        {challenge.hasAttachment && challenge.attachmentInfo && (
          <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-slate-300 truncate max-w-[200px]">
              <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate font-medium">{challenge.attachmentInfo.fileName}</span>
              <span className="text-slate-500 text-[10px]">({challenge.attachmentInfo.size})</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onViewArtifact && (
                <button
                  type="button"
                  onClick={() => {
                    playCyberBlip(750);
                    onViewArtifact(challenge.id);
                  }}
                  className="flex items-center gap-1.5 text-cyan-300 hover:text-white px-2.5 py-1 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-[11px] font-mono font-bold transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)] cursor-pointer"
                  title="Inspect artifact directly in browser (Whitelisted: Zero focus lost warnings)"
                >
                  <Eye className="w-3 h-3" />
                  <span>VIEW ARTIFACT</span>
                </button>
              )}

              <a
                href={`/api/challenges/${challenge.id}/attachment`}
                download={challenge.attachmentInfo.fileName}
                className="flex items-center gap-1 text-slate-400 hover:text-white p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] transition-colors cursor-pointer"
                title="Download offline copy"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Hint Marketplace Drawer with Clean Accordion Styling */}
        {challenge.hints.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                playCyberBlip(700);
                setIsHintsExpanded(!isHintsExpanded);
              }}
              className="w-full min-h-[44px] flex items-center justify-between text-xs font-mono text-amber-300 hover:text-amber-200 py-2 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5 font-bold">
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  HINT MARKETPLACE ({challenge.hints.filter((h) => h.isUnlocked).length}/
                  {challenge.hints.length} UNLOCKED)
                </span>
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>{isHintsExpanded ? 'Collapse' : 'Expand'}</span>
                {isHintsExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </span>
            </button>

            {isHintsExpanded && (
              <div className="mt-2.5 space-y-2 animate-fadeIn">
                {challenge.hints.map((hint, idx) => (
                  <div
                    key={hint.id}
                    className="rounded-xl bg-[#080b12] border border-slate-800/90 p-3 text-xs font-mono transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-slate-300 font-bold flex items-center gap-1.5">
                        {hint.isUnlocked ? (
                          <Unlock className="w-3.5 h-3.5 text-[#00ff66]" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span>
                          Hint #{idx + 1}: {hint.title}
                        </span>
                      </span>

                      {hint.isUnlocked ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30">
                          PURCHASED
                        </span>
                      ) : (
                        <button
                          onClick={() =>
                            setHintToUnlock({
                              id: hint.id,
                              cost: hint.cost,
                              title: hint.title,
                              index: idx + 1,
                            })
                          }
                          disabled={challenge.isSolved || challenge.isLocked}
                          className="min-h-[40px] text-[11px] font-bold text-amber-300 hover:text-amber-100 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-2 rounded-lg border border-amber-500/40 transition-all shadow-[0_0_8px_rgba(245,158,11,0.2)] disabled:opacity-40 cursor-pointer"
                        >
                          Unlock Hint #{idx + 1} [-{hint.cost} pts]
                        </button>
                      )}
                    </div>

                    {hint.isUnlocked && hint.content && (
                      <div className="mt-2 text-slate-200 text-[11px] bg-[#0c101c] p-2.5 rounded-lg border border-emerald-500/30 leading-relaxed font-mono flex items-start justify-between gap-2">
                        <div className="break-words flex-1 font-mono">{hint.content}</div>
                        <button
                          onClick={() => copyToClipboard(hint.content!, hint.id)}
                          className="p-2 min-w-[40px] min-h-[40px] rounded hover:bg-slate-800 text-slate-400 hover:text-white shrink-0 flex items-center justify-center cursor-pointer"
                          title="Copy hint to clipboard"
                        >
                          {copiedHintId === hint.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="p-5 sm:p-6 pt-0">
        {/* Flag format banner & attempt indicator in Monospace */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold">FORMAT:</span>
            <code className="text-emerald-400 bg-black/60 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
              {challenge.flagFormat}
            </code>
          </div>
          <div
            className={`font-mono ${
              challenge.attemptsRemaining <= 1 && !challenge.isSolved
                ? 'text-red-400 font-bold animate-pulse'
                : 'text-slate-400'
            }`}
          >
            ATTEMPTS: <span className="text-white font-bold">{challenge.attemptsUsed}</span>/
            {challenge.maxAttempts}
          </div>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div
            className={`p-2.5 rounded-lg mb-3 text-xs font-mono flex items-start gap-2 shadow-lg animate-fadeIn ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-300'
                : 'bg-red-950/80 border border-red-500/60 text-red-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <span className="break-words leading-relaxed">{statusMessage.text}</span>
          </div>
        )}

        {/* Interactive Solved / Locked / Terminal Prompt States */}
        {challenge.isSolved ? (
          <div className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-emerald-500/15 border border-emerald-500/70 text-[#00ff66] font-mono text-xs font-black tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,255,102,0.3),inset_0_0_15px_rgba(0,255,102,0.1)]">
            <CheckCircle2 className="w-4 h-4 text-[#00ff66]" />
            <span>[DECRYPTED & CAPTURED]</span>
          </div>
        ) : challenge.isLocked ? (
          <div className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-red-950/70 border border-red-500/80 text-red-300 font-mono text-xs font-black tracking-wider flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(239,68,68,0.4),inset_0_0_15px_rgba(239,68,68,0.15)] animate-pulse">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>[LOCKED - 0/{challenge.maxAttempts} ATTEMPTS]</span>
          </div>
        ) : (
          <form onSubmit={handleFlagSubmit} className="flex gap-2">
            {/* Terminal Command-Line Prompt Input */}
            <div className="relative flex-1 group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-500 pointer-events-none font-mono text-xs">
                <span className="text-[#00ff66] font-bold">$</span>
              </div>
              <input
                type="text"
                value={flagInput}
                onChange={(e) => setFlagInput(e.target.value)}
                placeholder="CTF{enter_flag_here}"
                disabled={isSubmitting}
                className="w-full min-h-[44px] bg-[#080b12] border border-slate-700/80 focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl pl-8 pr-3 py-2.5 text-xs font-mono text-white placeholder-slate-600 outline-none transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] focus:shadow-[0_0_15px_rgba(0,255,102,0.3)] disabled:opacity-50"
              />
            </div>

            {/* Crisp Neon Green Primary Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !flagInput.trim()}
              className="min-h-[44px] px-4 sm:px-5 py-2.5 bg-[#00ff66] hover:bg-[#00ff66]/80 text-black font-mono font-bold tracking-wider uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,255,102,0.4)] hover:shadow-[0_0_25px_rgba(0,255,102,0.7)] active:scale-95 disabled:opacity-40 shrink-0 cursor-pointer"
            >
              <span>{isSubmitting ? '...' : 'SUBMIT'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Writeup Mode Access Drawer */}
        {challenge.writeup && (
          <div className="mt-3">
            <button
              onClick={() => onViewWriteup(challenge)}
              className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 hover:text-white text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_12px_rgba(0,240,255,0.2)] cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>VIEW OFFICIAL WRITEUP & DEBRIEF</span>
            </button>
          </div>
        )}
      </div>

      {/* Hint Purchase Confirmation Dialog Modal */}
      {hintToUnlock && (
        <div className="absolute inset-0 bg-black/92 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center animate-fadeIn border-2 border-amber-500/70">
          <HelpCircle className="w-10 h-10 text-amber-400 mb-2 animate-bounce" />
          <h4 className="text-sm font-bold font-mono text-white">
            UNLOCK HINT #{hintToUnlock.index}: {hintToUnlock.title}?
          </h4>
          <p className="mt-2 text-xs text-amber-300 font-mono leading-relaxed max-w-xs">
            Caution: <strong>-{hintToUnlock.cost} points</strong> will be deducted from this
            challenge's reward upon final capture.
          </p>
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={() => setHintToUnlock(null)}
              disabled={isUnlockingHint}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-mono text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmUnlockHint}
              disabled={isUnlockingHint}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-mono font-black text-xs shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all"
            >
              {isUnlockingHint ? 'PURCHASING...' : `Confirm (-${hintToUnlock.cost} pts)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
