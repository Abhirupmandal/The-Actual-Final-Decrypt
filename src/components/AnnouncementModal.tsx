import React from 'react';
import { Megaphone, X, ShieldAlert } from 'lucide-react';
import { playCyberBlip } from '../utils/audio.ts';

interface AnnouncementModalProps {
  announcement: {
    id: string;
    title: string;
    message: string;
    timestamp: number;
  } | null;
  onDismiss: (id?: string) => void;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  announcement,
  onDismiss,
}) => {
  if (!announcement) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-[#0f1422]/95 border border-cyan-500/70 shadow-[0_0_45px_rgba(6,182,212,0.35)] rounded-2xl p-6 sm:p-7 max-w-md w-full font-mono text-xs relative backdrop-blur-xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent opacity-80" />
        <button
          onClick={() => {
            playCyberBlip(600);
            onDismiss(announcement.id);
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Dismiss announcement"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-cyan-400 mb-2">
          <Megaphone className="w-5 h-5 animate-bounce" />
          <span className="font-bold tracking-wider text-sm">
            COMMAND HQ BROADCAST
          </span>
        </div>

        <h3 className="text-base font-bold text-white mb-3">
          {announcement.title}
        </h3>

        <div className="bg-[#080b12] border border-cyan-500/30 p-4 rounded-lg text-cyan-100 font-sans text-sm leading-relaxed mb-4">
          {announcement.message}
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800 pt-3">
          <span>PRIORITY: ALL TEAMS DIRECTIVE</span>
          <span>{new Date(announcement.timestamp).toLocaleTimeString()}</span>
        </div>

        <button
          onClick={() => {
            playCyberBlip(750);
            onDismiss(announcement.id);
          }}
          className="w-full mt-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-colors uppercase tracking-wider"
        >
          ACKNOWLEDGE & DISMISS
        </button>
      </div>
    </div>
  );
};
