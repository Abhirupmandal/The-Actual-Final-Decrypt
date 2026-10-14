import React, { useState } from 'react';
import {
  Radio,
  Flame,
  CheckCircle2,
  HelpCircle,
  Megaphone,
  Terminal,
  Clock,
  Sparkles,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';
import type { ActivityFeedEvent } from '../types.ts';
import { playCyberBlip } from '../utils/audio.ts';

interface ActivityFeedProps {
  events: ActivityFeedEvent[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ events }) => {
  const [filter, setFilter] = useState<'ALL' | 'SOLVE' | 'FIRST_BLOOD' | 'ANNOUNCEMENT'>('ALL');

  const filteredEvents = events.filter((ev) => {
    if (filter === 'FIRST_BLOOD' && ev.type !== 'first_blood') return false;
    if (filter === 'SOLVE' && ev.type !== 'solve' && ev.type !== 'first_blood') return false;
    if (filter === 'ANNOUNCEMENT' && ev.type !== 'announcement') return false;
    return true;
  });

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getEventIcon = (type: ActivityFeedEvent['type']) => {
    switch (type) {
      case 'first_blood':
        return (
          <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)]">
            <Flame className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" />
          </div>
        );
      case 'solve':
        return (
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-[#00ff66] shadow-[0_0_12px_rgba(0,255,102,0.3)]">
            <CheckCircle2 className="w-4 h-4 text-[#00ff66]" />
          </div>
        );
      case 'hint_unlocked':
        return (
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]">
            <HelpCircle className="w-4 h-4 text-amber-400" />
          </div>
        );
      case 'announcement':
        return (
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.4)]">
            <Megaphone className="w-4 h-4 text-cyan-400 animate-bounce" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <Terminal className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-[#0d111a]/90 backdrop-blur-xl border border-purple-500/30 p-5 sm:p-7 shadow-[0_0_30px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(168,85,247,0.04)] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#a855f7] to-transparent opacity-80" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#a855f7] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#a855f7] animate-ping" />
              <Radio className="w-4 h-4" />
              <span>DEFENSE INTELLIGENCE: LIVE TRANSMISSION TELEMETRY</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-mono text-white mt-1.5 tracking-wide flex items-center gap-2">
              <span>LIVE ACTIVITY FEED</span>
              <span className="text-xs font-mono font-bold text-[#a855f7] bg-[#a855f7]/15 px-2.5 py-0.5 rounded-full border border-[#a855f7]/40 shadow-[0_0_10px_rgba(168,85,247,0.25)]">
                STREAM ACTIVE
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-sans mt-1 max-w-2xl leading-relaxed">
              Real-time WebSocket event stream broadcasting flag decryptions, First Blood breakthroughs, hint unlocks, and HQ command broadcasts.
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 bg-[#080b12] p-1.5 rounded-xl border border-slate-800 text-xs font-mono shrink-0 overflow-x-auto no-scrollbar max-w-full">
            {(['ALL', 'SOLVE', 'FIRST_BLOOD', 'ANNOUNCEMENT'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  playCyberBlip(600);
                  setFilter(t);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                  filter === t
                    ? 'bg-[#a855f7] text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Terminal Stream Box */}
      <div className="rounded-2xl bg-[#0d111a]/85 backdrop-blur-md border border-slate-800 p-5 sm:p-6 shadow-2xl font-mono text-xs">
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-800 text-slate-400">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#00ff66]" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              INTERCEPTED EVENT CHRONOLOGY ({filteredEvents.length})
            </span>
          </div>
          <div className="text-[11px] text-[#00ff66] flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-[#00ff66] animate-pulse" />
            <span>SOCKET.IO: ACTIVE</span>
          </div>
        </div>

        <div className="space-y-3">
          {filteredEvents.map((ev) => {
            const isFirstBlood = ev.type === 'first_blood';
            const isAnnouncement = ev.type === 'announcement';

            return (
              <div
                key={ev.id}
                className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition-all ${
                  isFirstBlood
                    ? 'bg-red-950/25 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                    : isAnnouncement
                    ? 'bg-cyan-950/25 border-cyan-500/50 shadow-[0_0_20px_rgba(0,240,255,0.2)]'
                    : 'bg-[#080b12]/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="shrink-0">{getEventIcon(ev.type)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                      <span className="text-emerald-400 font-mono">[{ev.teamName}]</span>
                      {isFirstBlood && (
                        <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-md border border-red-500/50 font-black shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                          FIRST BLOOD
                        </span>
                      )}
                      {isAnnouncement && (
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-md border border-cyan-500/50 font-black shadow-[0_0_8px_rgba(0,240,255,0.4)]">
                          HQ DIRECTIVE
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 shrink-0 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{formatTime(ev.timestamp)}</span>
                    </span>
                  </div>

                  <p
                    className={`mt-1 text-xs leading-relaxed font-sans ${
                      isFirstBlood
                        ? 'text-red-200 font-medium'
                        : isAnnouncement
                        ? 'text-cyan-200 font-bold'
                        : 'text-slate-300'
                    }`}
                  >
                    {ev.message}
                  </p>
                </div>
              </div>
            );
          })}

          {filteredEvents.length === 0 && (
            <div className="py-16 text-center text-slate-500 font-mono space-y-2">
              <Radio className="w-8 h-8 mx-auto text-slate-600 animate-pulse" />
              <p className="text-slate-400 font-bold">NO MATCHING TRANSMISSIONS</p>
              <p className="text-xs text-slate-600">Real-time submissions and team activity will stream into this terminal automatically.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
