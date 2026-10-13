import React, { useState, useEffect } from 'react';
import { Megaphone, X, Clock } from 'lucide-react';
import { playCyberBlip } from '../utils/audio.ts';

interface AnnouncementModalProps {
  announcement: {
    id: string;
    title: string;
    message: string;
    timestamp: number;
    autoDismissSeconds?: number;
  } | null;
  onDismiss: (id?: string) => void;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  announcement,
  onDismiss,
}) => {
  if (!announcement) return null;

  const totalDuration = announcement.autoDismissSeconds || 60;
  const initialRemaining = Math.max(
    1,
    Math.min(
      totalDuration,
      totalDuration - Math.floor((Date.now() - announcement.timestamp) / 1000)
    )
  );

  const [remainingSecs, setRemainingSecs] = useState<number>(initialRemaining);

  useEffect(() => {
    // Reset timer when announcement id changes
    const initial = Math.max(
      1,
      Math.min(
        totalDuration,
        totalDuration - Math.floor((Date.now() - announcement.timestamp) / 1000)
      )
    );
    setRemainingSecs(initial);

    const timer = setInterval(() => {
      setRemainingSecs((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDismiss(announcement.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [announcement.id, announcement.timestamp, totalDuration, onDismiss]);

  const progressPercent = Math.max(0, Math.min(100, (remainingSecs / totalDuration) * 100));

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-[#0f1422]/95 border border-cyan-500/70 shadow-[0_0_45px_rgba(6,182,212,0.35)] rounded-2xl p-6 sm:p-7 max-w-md w-full font-mono text-xs relative backdrop-blur-xl overflow-hidden">
        {/* Animated Countdown Progress Bar (1 min max auto-dismiss) */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-[#00f0ff] to-cyan-300 transition-all duration-1000 ease-linear shadow-[0_0_10px_#00f0ff]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <button
          onClick={() => {
            playCyberBlip(600);
            onDismiss(announcement.id);
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Dismiss announcement"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center justify-between mb-2 pr-6">
          <div className="flex items-center gap-2 text-cyan-400">
            <Megaphone className="w-5 h-5 animate-bounce" />
            <span className="font-bold tracking-wider text-sm">
              COMMAND HQ BROADCAST
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/40 border border-amber-500/40 px-2 py-0.5 rounded">
            <Clock className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} />
            <span>{remainingSecs}s</span>
          </div>
        </div>

        <h3 className="text-base font-bold text-white mb-3">
          {announcement.title}
        </h3>

        <div className="bg-[#080b12] border border-cyan-500/30 p-4 rounded-lg text-cyan-100 font-sans text-sm leading-relaxed mb-4 shadow-inner">
          {announcement.message}
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800 pt-3">
          <span>PRIORITY: ALL TEAMS DIRECTIVE</span>
          <span>{new Date(announcement.timestamp).toLocaleTimeString()}</span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-400 font-mono">
            Auto-dismiss in <strong className="text-cyan-300">{remainingSecs}s</strong> (1 min max)
          </span>
          <button
            onClick={() => {
              playCyberBlip(750);
              onDismiss(announcement.id);
            }}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-colors uppercase tracking-wider cursor-pointer"
          >
            DISMISS NOW
          </button>
        </div>
      </div>
    </div>
  );
};
