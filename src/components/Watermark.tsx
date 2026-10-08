import React from 'react';

interface WatermarkProps {
  teamName?: string;
  sessionId?: string;
}

export const Watermark: React.FC<WatermarkProps> = ({ teamName, sessionId }) => {
  if (!teamName) return null;

  const displaySession = sessionId ? sessionId.slice(0, 8) : 'session';
  const label = `Team: ${teamName} · ID: ${displaySession}`;

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-[999] overflow-hidden opacity-25">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-24 p-8 transform -rotate-12 translate-y-12">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="text-[11px] font-mono tracking-widest text-emerald-500/20 whitespace-nowrap"
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};
