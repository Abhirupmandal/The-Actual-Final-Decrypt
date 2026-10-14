import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquareHeart,
  Star,
  CheckCircle2,
  Sparkles,
  Send,
  RotateCcw,
  Shield,
  HelpCircle,
  Zap,
  Award,
  Layers,
  Heart,
  Smile,
  Lock,
  ArrowRight,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Team, FeedbackSubmission } from '../types.ts';
import { playSuccessChime, playCyberBlip, playErrorBuzz } from '../utils/audio.ts';

interface FeedbackSectionProps {
  team: { id: string; teamName: string; [key: string]: any } | null;
  onOpenAuthModal?: () => void;
  isMandatoryIntermission?: boolean;
  onUnlockFinalDashboard?: () => void;
  onFeedbackSubmitted?: () => void;
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({
  team,
  onOpenAuthModal,
  isMandatoryIntermission = false,
  onUnlockFinalDashboard,
  onFeedbackSubmitted,
}) => {
  const [ratingUi, setRatingUi] = useState<number>(5);
  const [challengeDifficulty, setChallengeDifficulty] = useState<string>('balanced');
  const [platformStability, setPlatformStability] = useState<number>(5);
  const [fairPlaySecurity, setFairPlaySecurity] = useState<string>('seamless');
  const [clarityRulesHints, setClarityRulesHints] = useState<number>(5);
  const [favoriteHighlight, setFavoriteHighlight] = useState<string>('');
  const [suggestionsRound3, setSuggestionsRound3] = useState<string>('');
  const [customTeamName, setCustomTeamName] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(() => {
    try {
      if (localStorage.getItem('ctf_feedback_submitted') === 'true') return true;
      if (team?.id && localStorage.getItem('ctf_feedback_submitted_' + team.id) === 'true') return true;
      return false;
    } catch {
      return false;
    }
  });
  const [submittedTeamName, setSubmittedTeamName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const onUnlockFinalDashboardRef = useRef(onUnlockFinalDashboard);
  onUnlockFinalDashboardRef.current = onUnlockFinalDashboard;

  // Mandatory Countdown Redirect to Final Leaderboard after submission
  useEffect(() => {
    if (redirectCountdown === null) return;
    if (redirectCountdown <= 0) {
      if (onUnlockFinalDashboardRef.current) {
        onUnlockFinalDashboardRef.current();
      }
      return;
    }
    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearTimeout(timer);
  }, [redirectCountdown]);

  // Sync existing feedback on load
  useEffect(() => {
    const fetchExisting = async () => {
      const token = localStorage.getItem('ctf_team_token');
      if (!token) return;
      try {
        const res = await fetch('/api/feedback/my', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.feedback) {
            const fb: FeedbackSubmission = data.feedback;
            setRatingUi(fb.ratingUi);
            setChallengeDifficulty(fb.challengeDifficulty);
            setPlatformStability(fb.platformStability);
            setFairPlaySecurity(fb.fairPlaySecurity);
            setClarityRulesHints(fb.clarityRulesHints);
            setFavoriteHighlight(fb.favoriteHighlight);
            setSuggestionsRound3(fb.suggestionsRound3);
            setSubmittedTeamName(fb.teamName);
            setIsSubmitted(true);
            try {
              localStorage.setItem('ctf_feedback_submitted', 'true');
              if (team?.id) {
                localStorage.setItem('ctf_feedback_submitted_' + team.id, 'true');
              }
            } catch {}
          }
        }
      } catch {}
    };
    fetchExisting();
  }, [team?.id]);

  const triggerCelebration = () => {
    try {
      playSuccessChime();
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#00ff66', '#00f0ff', '#f59e0b', '#ec4899', '#ffffff'],
      });
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Strict client-side lockout check
    if (isSubmitted) {
      setError('Feedback has already been submitted for your squad. The feedback form can only be given once.');
      playErrorBuzz();
      return;
    }

    const activeTeamName = team?.teamName || customTeamName.trim();
    if (!activeTeamName) {
      setError('Please provide your squad or participant name so we can attribute your feedback.');
      playErrorBuzz();
      return;
    }

    if (!suggestionsRound3.trim() && !favoriteHighlight.trim()) {
      setError('Please provide at least a short reply for question 6 or 7 so we can learn from your thoughts.');
      playErrorBuzz();
      return;
    }

    setIsSubmitting(true);
    playCyberBlip(750);

    const token = localStorage.getItem('ctf_team_token');
    const payload = {
      teamName: activeTeamName,
      ratingUi,
      challengeDifficulty,
      platformStability,
      fairPlaySecurity,
      clarityRulesHints,
      favoriteHighlight: favoriteHighlight.trim(),
      suggestionsRound3: suggestionsRound3.trim(),
    };

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmittedTeamName(activeTeamName);
        setIsSubmitted(true);
        try {
          localStorage.setItem('ctf_feedback_submitted', 'true');
          if (team?.id) {
            localStorage.setItem('ctf_feedback_submitted_' + team.id, 'true');
          }
        } catch {}
        triggerCelebration();
        onFeedbackSubmitted?.();

        // Start visible 4-second mandatory redirect countdown to the final leaderboard
        setRedirectCountdown(4);
      } else if (res.status === 409 || data?.alreadySubmitted) {
        setSubmittedTeamName(activeTeamName);
        setIsSubmitted(true);
        try {
          localStorage.setItem('ctf_feedback_submitted', 'true');
          if (team?.id) {
            localStorage.setItem('ctf_feedback_submitted_' + team.id, 'true');
          }
        } catch {}
        setError(data.error || 'Your squad has already submitted feedback. The feedback form can only be given once.');
        onFeedbackSubmitted?.();
        setRedirectCountdown(3);
      } else {
        setError(data.error || 'Failed to transmit feedback. Please try again.');
        playErrorBuzz();
      }
    } catch {
      setError('Connection refused. Please verify server connectivity.');
      playErrorBuzz();
    } finally {
      setIsSubmitting(false);
    }
  };

  const difficultyOptions = [
    { id: 'too_easy', label: 'Too Easy', desc: 'Could use more complex puzzles', color: 'text-emerald-400 border-emerald-500/40' },
    { id: 'balanced', label: 'Well-Balanced', desc: 'Engaging, fair & rewarding', color: 'text-cyan-400 border-cyan-500/40' },
    { id: 'challenging', label: 'Challenging', desc: 'Required deep problem solving', color: 'text-amber-400 border-amber-500/40' },
    { id: 'too_hard', label: 'Extremely Hard', desc: 'Felt overly steep or blocked', color: 'text-rose-400 border-rose-500/40' },
  ];

  const fairPlayOptions = [
    { id: 'seamless', label: 'Seamless & Fair', desc: 'Maintained integrity without getting in the way', icon: Shield },
    { id: 'balanced', label: 'Balanced', desc: 'Noticeable protections, fair play preserved', icon: CheckCircle2 },
    { id: 'strict', label: 'A Bit Strict', desc: 'Protections felt slightly sensitive', icon: HelpCircle },
    { id: 'needs_tuning', label: 'Needs Tuning', desc: 'Feedback on shortcuts / alerts', icon: Zap },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono pb-16 animate-fadeIn">
      {/* Mandatory Post-Event Intermission Gate Banner */}
      {isMandatoryIntermission && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/90 via-[#181105] to-amber-950/90 border-2 border-amber-500/80 p-5 sm:p-6 text-center space-y-3 shadow-[0_0_40px_rgba(245,158,11,0.3)] animate-pulse">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[11px] font-bold uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>MANDATORY POST-EVENT DEBRIEF: UNLOCK GATEWAY</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
            COMPLETE FEEDBACK TO UNLOCK FINAL LEADERBOARD
          </h2>
          <p className="text-xs sm:text-sm text-amber-200/90 font-sans max-w-xl mx-auto leading-relaxed">
            The competition has concluded! To maintain platform integrity and analyze challenge metrics, all participants must submit this brief 7-question debrief. Once submitted, the official final standings will immediately unlock (official challenge writeups will be accessible once released by competition administrators).
          </p>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#05111c] via-[#081726] to-[#040b13] border border-cyan-500/30 p-6 sm:p-8 shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 text-xs font-bold shadow-[0_0_12px_rgba(6,182,212,0.25)]">
            <MessageSquareHeart className="w-3.5 h-3.5 animate-pulse text-cyan-300" />
            <span>COMMUNITY VOICE &amp; DEFENSE MATRIX</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight flex flex-wrap items-center gap-2">
            <span>YOUR VALUABLE FEEDBACK</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed max-w-2xl">
            Please share your authentic, honest reply to these 7 questions. The{' '}
            <span className="text-cyan-400 font-semibold">IEEE NMIET RAS Developer Team</span> reads every submission
            to continuously refine our challenges, anti-cheat engine, and platform experience.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>7 Honest Questions</span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Takes ~2 Minutes</span>
            </span>
          </div>
        </div>
      </div>

      {/* Completion Banner (When Submitted) */}
      {isSubmitted && (
        <div className="rounded-3xl bg-gradient-to-r from-emerald-950/90 via-[#072418] to-emerald-950/90 border-2 border-[#00ff66] p-8 sm:p-12 text-center space-y-6 shadow-[0_0_50px_rgba(0,255,102,0.4)] animate-fadeIn">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-[#00ff66]/15 border-2 border-[#00ff66] flex items-center justify-center text-[#00ff66] shadow-[0_0_35px_rgba(0,255,102,0.6)] animate-bounce">
            <Award className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00ff66]/15 text-[#00ff66] border border-[#00ff66]/40 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>FEEDBACK SUBMITTED (1 OF 1 ALLOWED)</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-wide uppercase drop-shadow">
              THANK YOU FOR SUBMITTING THE FEEDBACK FORM!
            </h2>
            <p className="text-sm sm:text-base text-emerald-300 font-sans max-w-xl mx-auto font-medium">
              Thank you for filling the feedback! Your authentic response has been recorded into the official evaluation registry. The feedback form can only be given once per squad.
            </p>
          </div>

          {/* Live countdown notice */}
          {redirectCountdown !== null && (
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#040d16] border border-emerald-500/50 text-xs sm:text-sm text-emerald-400 font-mono shadow-inner">
              <Clock className="w-4 h-4 text-[#00ff66] animate-spin" />
              <span>
                Redirecting to Final Leaderboard in <strong className="text-white font-black">{redirectCountdown}s</strong>...
              </span>
            </div>
          )}

          {/* Mandatory Direct Action to Final Leaderboard */}
          {onUnlockFinalDashboard && (
            <div className="pt-2">
              <button
                onClick={() => {
                  playCyberBlip(800);
                  onUnlockFinalDashboard();
                }}
                className="w-full sm:w-auto mx-auto px-10 py-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-[#00ff66] hover:from-emerald-400 hover:to-[#00ff66] text-black font-black uppercase text-xs sm:text-sm tracking-wider shadow-[0_0_35px_rgba(0,255,102,0.6)] hover:shadow-[0_0_50px_rgba(0,255,102,0.9)] flex items-center justify-center gap-3 transition-all transform hover:scale-105 cursor-pointer"
              >
                <span>PROCEED TO FINAL LEADERBOARD {redirectCountdown !== null ? `(${redirectCountdown}s)` : ''}</span>
                <ArrowRight className="w-5 h-5 text-black" />
              </button>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 text-slate-400 border border-slate-800 text-[11px] font-mono">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Feedback is sealed &amp; recorded. The feedback form can only be given once per team.</span>
            </div>
            <button
              onClick={triggerCelebration}
              className="px-4 py-2 rounded-xl bg-[#00ff66]/20 hover:bg-[#00ff66]/30 text-[#00ff66] border border-[#00ff66]/60 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(0,255,102,0.3)]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Celebrate With Team</span>
            </button>
          </div>
        </div>
      )}

      {/* Main 7-Question Form */}
      {!isSubmitted && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identity confirmation */}
          <div className="rounded-2xl bg-[#08121d]/90 border border-slate-800 p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Smile className="w-4 h-4 text-cyan-400" />
                  <span>Submitting As Squad:</span>
                </label>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                  {team
                    ? `Logged in as [${team.teamName}] with ${team.members.length} operator(s).`
                    : 'You are submitting as a guest. Please specify your squad name.'}
                </p>
              </div>

              {!team && onOpenAuthModal && (
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-[#00ff66] border border-emerald-500/40 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
                >
                  Sign In First
                </button>
              )}
            </div>

            {!team && (
              <input
                type="text"
                value={customTeamName}
                onChange={(e) => setCustomTeamName(e.target.value)}
                placeholder="Enter your Team / Squad Name (e.g., CyberKnights)"
                className="w-full px-4 py-2.5 rounded-xl bg-[#040810] border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 transition-colors font-mono"
                required
              />
            )}
          </div>

          {/* Question 1: Platform UI & Experience (Rating 1-5) */}
          <div className="rounded-2xl bg-[#08121d]/90 border border-slate-800 p-5 sm:p-6 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-black">
                    1
                  </span>
                  <span>Overall Website &amp; Interface Experience</span>
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  How would you rate the cyberpunk aesthetic, visual clarity, responsiveness, and dashboard usability?
                </p>
              </div>
              <span className="text-sm font-bold text-cyan-400 tabular-nums">{ratingUi} / 5</span>
            </div>

            <div className="grid grid-cols-5 gap-2 pt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => {
                    setRatingUi(star);
                    playCyberBlip(500 + star * 60);
                  }}
                  className={`py-3 px-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    ratingUi >= star
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : 'bg-[#040810] border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  <Star className={`w-5 h-5 ${ratingUi >= star ? 'fill-cyan-400 text-cyan-400' : 'text-slate-600'}`} />
                  <span className="text-[10px] font-bold">
                    {star === 1 ? 'Poor' : star === 2 ? 'Fair' : star === 3 ? 'Good' : star === 4 ? 'Great' : 'Superb'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Question 2: Challenge Quality & Difficulty Balance */}
          <div className="rounded-2xl bg-[#08121d]/90 border border-slate-800 p-5 sm:p-6 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-black">
                  2
                </span>
                <span>Challenge Quality &amp; Difficulty Balance</span>
              </h3>
              <p className="text-xs text-slate-400 font-sans mt-1">
                How balanced and intellectually stimulating did you find the challenges across categories (Crypto, Forensics, Rev, Web, Stego)?
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {difficultyOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => {
                    setChallengeDifficulty(opt.id);
                    playCyberBlip(600);
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    challengeDifficulty === opt.id
                      ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : 'bg-[#040810] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">{opt.label}</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${challengeDifficulty === opt.id ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-700'}`} />
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Question 3: Platform Speed & Real-Time Stability */}
          <div className="rounded-2xl bg-[#08121d]/90 border border-slate-800 p-5 sm:p-6 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-black">
                    3
                  </span>
                  <span>Website Speed, Latency &amp; Real-Time Responsiveness</span>
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  Did you experience any lag, disconnects, or delay with timer countdowns, live score sync, and flag submissions?
                </p>
              </div>
              <span className="text-sm font-bold text-cyan-400 tabular-nums">{platformStability} / 5</span>
            </div>

            <div className="grid grid-cols-5 gap-2 pt-2">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => {
                    setPlatformStability(lvl);
                    playCyberBlip(500 + lvl * 60);
                  }}
                  className={`py-3 px-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    platformStability >= lvl
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : 'bg-[#040810] border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  <Zap className={`w-5 h-5 ${platformStability >= lvl ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span className="text-[10px] font-bold">
                    {lvl === 1 ? 'Laggy' : lvl === 2 ? 'Slow' : lvl === 3 ? 'Decent' : lvl === 4 ? 'Fast' : 'Instant'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Question 4: Fair Play & Security Protections */}
          <div className="rounded-2xl bg-[#08121d]/90 border border-slate-800 p-5 sm:p-6 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-black">
                  4
                </span>
                <span>Fair Play &amp; Security Protections</span>
              </h3>
              <p className="text-xs text-slate-400 font-sans mt-1">
                How did you feel about the competition integrity measures (screenshot blackout, warning telemetry, fair play arbitration)?
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {fairPlayOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => {
                      setFairPlaySecurity(opt.id);
                      playCyberBlip(600);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      fairPlaySecurity === opt.id
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                        : 'bg-[#040810] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-cyan-400" />
                      <span className="font-bold text-xs text-white">{opt.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans mt-1">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 5: Rules, Section Flow & Guidance */}
          <div className="rounded-2xl bg-[#08121d]/90 border border-slate-800 p-5 sm:p-6 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-black">
                    5
                  </span>
                  <span>Rules, Section A/B Divisions &amp; Hint Mechanics</span>
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  Were the section divisions (Section A: Find the Clue vs Section B: Decode Chamber) and hint unlocks clear and helpful?
                </p>
              </div>
              <span className="text-sm font-bold text-cyan-400 tabular-nums">{clarityRulesHints} / 5</span>
            </div>

            <div className="grid grid-cols-5 gap-2 pt-2">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => {
                    setClarityRulesHints(lvl);
                    playCyberBlip(500 + lvl * 60);
                  }}
                  className={`py-3 px-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    clarityRulesHints >= lvl
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                      : 'bg-[#040810] border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  <Layers className={`w-5 h-5 ${clarityRulesHints >= lvl ? 'text-amber-400' : 'text-slate-600'}`} />
                  <span className="text-[10px] font-bold">
                    {lvl === 1 ? 'Confusing' : lvl === 2 ? 'Unclear' : lvl === 3 ? 'Adequate' : lvl === 4 ? 'Clear' : 'Pristine'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Question 6: Favorite Challenge or Feature */}
          <div className="rounded-2xl bg-[#08121d]/90 border border-slate-800 p-5 sm:p-6 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-black">
                  6
                </span>
                <span>Favorite Challenge, Category or Feature</span>
              </h3>
              <p className="text-xs text-slate-400 font-sans mt-1">
                Which challenge, cipher theme, forensic puzzle, or UI feature did your squad enjoy solving the most?
              </p>
            </div>

            <input
              type="text"
              value={favoriteHighlight}
              onChange={(e) => setFavoriteHighlight(e.target.value)}
              placeholder="e.g., Matrix Memory Forensics, Steganography Decode, Live Leaderboard sound blips..."
              className="w-full px-4 py-3 rounded-xl bg-[#040810] border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 transition-colors font-mono"
            />

            {/* Quick Pill Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500">Suggestions:</span>
              {['Section B Decode Chamber', 'Stego Forensics', 'Cryptography Ciphers', 'Real-time Leaderboard', 'Audio & Cyber Matrix FX'].map((pill) => (
                <button
                  type="button"
                  key={pill}
                  onClick={() => {
                    setFavoriteHighlight(pill);
                    playCyberBlip(550);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 text-[10px] transition-colors cursor-pointer"
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>

          {/* Question 7: Candid Suggestions for Round 3 (Unfiltered Honest Reply) */}
          <div className="rounded-2xl bg-[#08121d]/90 border border-slate-800 p-5 sm:p-6 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 text-xs flex items-center justify-center font-black">
                    7
                  </span>
                  <span>Candid Suggestions & Improvements (Honest Reply)</span>
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  What is one thing we should improve, remove, add, or alter? Please be totally honest—we appreciate constructive criticism!
                </p>
              </div>
              <span className="text-[10px] text-slate-500 tabular-nums">{suggestionsRound3.length} / 2000</span>
            </div>

            <textarea
              rows={4}
              value={suggestionsRound3}
              onChange={(e) => setSuggestionsRound3(e.target.value)}
              placeholder="Tell us honestly: What worked well? What frustrated you? What challenges would you love to see next?..."
              className="w-full px-4 py-3 rounded-xl bg-[#040810] border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-rose-400 transition-colors font-sans resize-y leading-relaxed"
            />
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500 text-red-300 text-xs flex items-center gap-2 animate-shake">
              <HelpCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[50px] py-3.5 bg-gradient-to-r from-[#00ff66] via-emerald-400 to-[#00f0ff] hover:opacity-95 text-black font-mono font-black tracking-wider uppercase text-sm rounded-xl flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(0,255,102,0.4)] hover:shadow-[0_0_35px_rgba(0,255,102,0.7)] transition-all cursor-pointer disabled:opacity-50 active:scale-98"
            >
              <Send className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'TRANSMITTING VALUABLE FEEDBACK...'
                  : `SUBMIT FEEDBACK FOR TEAM [${team?.teamName || customTeamName || 'SQUAD'}]`}
              </span>
            </button>
            <p className="text-center text-[11px] text-slate-500 mt-2 font-sans">
              Submissions are compiled directly for the IEEE NMIET RAS Developer Team.
            </p>
          </div>
        </form>
      )}
    </div>
  );
};
