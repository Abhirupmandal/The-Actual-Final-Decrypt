import React, { useState } from 'react';
import { BookOpen, X, Check, Copy, Terminal, Key } from 'lucide-react';
import type { PublicChallengeView } from '../types.ts';
import { playCyberBlip } from '../utils/audio.ts';

interface WriteupModalProps {
  challenge: PublicChallengeView | null;
  onClose: () => void;
}

export const WriteupModal: React.FC<WriteupModalProps> = ({
  challenge,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!challenge || !challenge.writeup) return null;

  const handleCopyFlag = () => {
    playCyberBlip(900);
    // Extract flag from steps or summary
    const flagMatch = challenge.writeup?.steps.join('\n').match(/CTF\{[a-zA-Z0-9_#$%-]+\}/);
    const flagText = flagMatch ? flagMatch[0] : '';
    if (flagText) {
      navigator.clipboard.writeText(flagText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d111a] border-2 border-cyan-500/50 shadow-[0_0_35px_rgba(6,182,212,0.25)] rounded-xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto font-mono text-xs relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
          aria-label="Close writeup"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-cyan-400 mb-1">
          <BookOpen className="w-4 h-4" />
          <span className="font-bold tracking-wider">OFFICIAL WRITEUP & DEBRIEF</span>
        </div>

        <h3 className="text-lg font-bold text-white mb-1">
          {challenge.title}
        </h3>
        <div className="text-slate-400 mb-4 flex items-center gap-2">
          <span>{challenge.category}</span>
          <span>·</span>
          <span className="text-[#00ff66]">{challenge.points} PTS</span>
          <span>·</span>
          <span>{challenge.section}</span>
        </div>

        {/* Summary Card */}
        <div className="rounded-lg bg-[#080b12] border border-slate-800 p-4 mb-4">
          <div className="text-[11px] font-bold text-cyan-400 mb-1">
            EXECUTIVE ANALYSIS & ROOT CAUSE:
          </div>
          <p className="text-slate-300 font-sans leading-relaxed text-sm">
            {challenge.writeup.summary}
          </p>
        </div>

        {/* Step-by-Step Breakdown */}
        <div className="space-y-3 mb-6">
          <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>EXPLOITATION & EXTRACTION METHODOLOGY:</span>
          </div>

          <div className="space-y-2">
            {challenge.writeup.steps.map((step, idx) => (
              <div
                key={idx}
                className="p-3 rounded bg-[#080b12] border border-slate-800 text-slate-300 leading-relaxed font-mono"
              >
                {step}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            CHALLENGE DEBRIEF COMPLETE · WRITEUP MODE ACTIVE
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
