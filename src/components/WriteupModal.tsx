import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  X,
  Check,
  Copy,
  Terminal,
  Key,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { PublicChallengeView } from '../types.ts';
import { playCyberBlip } from '../utils/audio.ts';

interface WriteupModalProps {
  isOpen?: boolean;
  challenge: PublicChallengeView | null;
  challenges?: PublicChallengeView[];
  onSelectChallenge?: (challenge: PublicChallengeView) => void;
  onClose: () => void;
}

export const WriteupModal: React.FC<WriteupModalProps> = ({
  isOpen = true,
  challenge,
  challenges = [],
  onSelectChallenge,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  // Sync selected challenge ID and reset dismissed state when incoming challenge changes
  useEffect(() => {
    if (challenge) {
      setLocalSelectedId(challenge.id);
      setIsDismissed(false);
    } else {
      setLocalSelectedId(null);
      setIsDismissed(true);
    }
  }, [challenge]);

  // Close handler: reset local state and invoke parent onClose
  const handleClose = (e?: React.MouseEvent | KeyboardEvent) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsDismissed(true);
    setLocalSelectedId(null);
    try {
      playCyberBlip(750);
    } catch {}
    onClose();
  };

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen || !challenge || isDismissed) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, challenge, isDismissed]);

  // Filter and sort all challenges that have a writeup
  const writeupChallenges = useMemo(() => {
    const list = challenges.filter((c) => Boolean(c.writeup));
    if (list.length > 0) {
      return [...list].sort((a, b) => a.id.localeCompare(b.id));
    }
    return challenge && challenge.writeup ? [challenge] : [];
  }, [challenges, challenge]);

  // Determine currently active challenge
  const activeChallenge = useMemo(() => {
    if (!challenge && !localSelectedId) return null;
    if (localSelectedId) {
      const found = writeupChallenges.find((c) => c.id === localSelectedId);
      if (found) return found;
    }
    return challenge;
  }, [localSelectedId, writeupChallenges, challenge]);

  // Strict Visibility Guard: If modal is not open, dismissed, challenge is null, or active challenge has no writeup -> do not render
  if (!isOpen || isDismissed || !challenge || !activeChallenge || !activeChallenge.writeup) {
    return null;
  }

  const currentIndex = writeupChallenges.findIndex((c) => c.id === activeChallenge.id);

  const handleSelect = (c: PublicChallengeView) => {
    playCyberBlip(850);
    setLocalSelectedId(c.id);
    onSelectChallenge?.(c);
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      handleSelect(writeupChallenges[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < writeupChallenges.length - 1) {
      handleSelect(writeupChallenges[currentIndex + 1]);
    }
  };

  // Extract flag from steps or summary
  const flagMatch =
    activeChallenge.writeup.steps.join('\n').match(/CTF\{[a-zA-Z0-9_#$%-]+\}/) ||
    activeChallenge.writeup.summary.match(/CTF\{[a-zA-Z0-9_#$%-]+\}/);
  const flagText = flagMatch ? flagMatch[0] : '';

  const handleCopyFlag = () => {
    if (!flagText) return;
    playCyberBlip(900);
    navigator.clipboard.writeText(flagText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose(e);
      }}
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-[150] flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-[#0d111a]/95 border-2 border-cyan-500/60 shadow-[0_0_60px_rgba(0,240,255,0.25)] rounded-2xl p-5 sm:p-7 max-w-3xl w-full my-auto max-h-[92dvh] overflow-y-auto font-mono text-xs relative backdrop-blur-xl space-y-5">
        {/* Top Glowing Beam */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent opacity-90 shadow-[0_0_15px_#00f0ff]" />

        {/* Header Controls */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 mb-1">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span className="font-bold tracking-wider">OFFICIAL WRITEUP &amp; DEBRIEF</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/40">
                {currentIndex >= 0 ? currentIndex + 1 : 1} OF {writeupChallenges.length}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Browse complete solution walkthroughs, formulas &amp; flag derivations for all challenges.
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => handleClose(e)}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
            aria-label="Close writeup"
            title="Close Writeup (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 20-Challenge Navigation Switcher (Dropdown + Prev/Next Controls) */}
        {writeupChallenges.length > 1 && (
          <div className="p-3 rounded-xl bg-[#080d16] border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-cyan-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>CHALLENGE SELECTOR ({writeupChallenges.length} SOLUTIONS AVAILABLE):</span>
              </span>

              {/* Prev / Next Quick Arrows */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentIndex <= 0}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white border border-slate-800 flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer"
                  title="Previous challenge solution"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentIndex >= writeupChallenges.length - 1}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white border border-slate-800 flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer"
                  title="Next challenge solution"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Dropdown Select */}
            <select
              value={activeChallenge.id}
              onChange={(e) => {
                const found = writeupChallenges.find((c) => c.id === e.target.value);
                if (found) handleSelect(found);
              }}
              className="w-full bg-[#050811] border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-400 transition-colors cursor-pointer"
            >
              <optgroup label="Section A (Find the Clue, Find the Key)">
                {writeupChallenges
                  .filter((c) => c.section.includes('Section A') || c.id.startsWith('chal-r2-0'))
                  .map((c) => {
                    const idx = writeupChallenges.findIndex((w) => w.id === c.id);
                    return (
                      <option key={c.id} value={c.id}>
                        #{idx + 1}. {c.title} [{c.category}] — {c.points} PTS
                      </option>
                    );
                  })}
              </optgroup>
              <optgroup label="Section B (Decrypt the Secret, Break the Cipher)">
                {writeupChallenges
                  .filter((c) => !c.section.includes('Section A') && !c.id.startsWith('chal-r2-0'))
                  .map((c) => {
                    const idx = writeupChallenges.findIndex((w) => w.id === c.id);
                    return (
                      <option key={c.id} value={c.id}>
                        #{idx + 1}. {c.title} [{c.category}] — {c.points} PTS
                      </option>
                    );
                  })}
              </optgroup>
            </select>

            {/* Quick 20-Pill Number Bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
              {writeupChallenges.map((c, idx) => {
                const isActive = c.id === activeChallenge.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all cursor-pointer ${
                      isActive
                        ? 'bg-cyan-500 text-black shadow-[0_0_10px_#00f0ff]'
                        : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80'
                    }`}
                    title={`#${idx + 1} ${c.title} (${c.points} pts)`}
                  >
                    #{idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Challenge Metadata Header */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black text-white tracking-tight">
              {activeChallenge.title}
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              {activeChallenge.points} PTS
            </span>
          </div>

          <div className="text-slate-400 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-cyan-400 font-bold">{activeChallenge.category}</span>
            <span>·</span>
            <span className="text-amber-400">{activeChallenge.difficulty}</span>
            <span>·</span>
            <span>{activeChallenge.section}</span>
          </div>
        </div>

        {/* Summary Card */}
        <div className="rounded-xl bg-[#080b12] border border-cyan-500/30 p-4 space-y-1.5 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
          <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>EXECUTIVE ANALYSIS &amp; ROOT CAUSE:</span>
          </div>
          <p className="text-slate-200 font-sans leading-relaxed text-xs sm:text-sm">
            {activeChallenge.writeup.summary}
          </p>
        </div>

        {/* Step-by-Step Breakdown */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>EXPLOITATION &amp; EXTRACTION METHODOLOGY:</span>
          </div>

          <div className="space-y-2">
            {activeChallenge.writeup.steps.map((step, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#080d16] border border-slate-800 text-slate-200 leading-relaxed font-mono text-xs hover:border-slate-700 transition-colors"
              >
                {step}
              </div>
            ))}
          </div>
        </div>

        {/* Flag Verification Card */}
        {flagText && (
          <div className="p-3.5 rounded-xl bg-[#051410] border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <div className="text-[10px] text-emerald-400/80 font-bold uppercase">VERIFIED OFFICIAL FLAG:</div>
                <div className="font-mono font-black text-emerald-300 text-sm select-all">
                  {flagText}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyFlag}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-black" />
                  <span>COPIED!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-black" />
                  <span>COPY FLAG</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer with Prev / Next Navigation & Dedicated Close Button */}
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white border border-slate-800 flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Solution</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex >= writeupChallenges.length - 1}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white border border-slate-800 flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Next Solution</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={(e) => handleClose(e)}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer shadow-md active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
