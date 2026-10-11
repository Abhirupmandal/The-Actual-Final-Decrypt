import React from 'react';

interface WatermarkProps {
  teamName?: string;
  sessionId?: string;
  userName?: string;
}

export const Watermark: React.FC<WatermarkProps> = ({ teamName, sessionId, userName }) => {
  const displayIdentifier = teamName || userName || 'COMPETITOR';
  const displaySession = sessionId ? sessionId.slice(0, 8) : 'SESSION';
  const label = `${displayIdentifier} · ${displaySession}`;

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-[9990] overflow-hidden opacity-30">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-16 gap-y-20 p-6 transform -rotate-12 translate-y-8 select-none">
        {Array.from({ length: 48 }).map((_, i) => (
          <div
            key={i}
            className="text-[10px] font-mono tracking-widest text-[#00ff66]/20 whitespace-nowrap select-none font-bold"
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};
