import React, { useEffect, useState, useRef } from 'react';
import { Send, Sparkles, Zap, ArrowRight, ShieldCheck, Radio } from 'lucide-react';
import { playSpaceshipFlybySound, playCyberBlip } from '../utils/audio.ts';

interface SpaceshipFlightAnimationProps {
  isOpen: boolean;
  teamName: string;
  onComplete?: () => void;
}

export const SpaceshipFlightAnimation: React.FC<SpaceshipFlightAnimationProps> = ({
  isOpen,
  teamName,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'approaching' | 'warp' | 'done'>('approaching');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const isDoneRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setPhase('approaching');
      isDoneRef.current = false;
      return;
    }

    isDoneRef.current = false;
    setPhase('approaching');

    // Trigger procedural spaceship flyby audio
    try {
      playSpaceshipFlybySound();
    } catch {}

    // Hyperspace warp jump flash at 2.4s
    const warpTimer = setTimeout(() => {
      setPhase('warp');
    }, 2400);

    // Complete animation at 3.8s
    const doneTimer = setTimeout(() => {
      if (!isDoneRef.current) {
        isDoneRef.current = true;
        setPhase('done');
        onCompleteRef.current?.();
      }
    }, 3800);

    return () => {
      clearTimeout(warpTimer);
      clearTimeout(doneTimer);
    };
  }, [isOpen]);

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    try {
      playCyberBlip(800);
    } catch {}
    setPhase('done');
    onCompleteRef.current?.();
  };

  if (!isOpen || phase === 'done') return null;

  return (
    <div className="fixed inset-0 z-[125] pointer-events-none flex flex-col justify-between overflow-hidden font-mono select-none">
      {/* Cosmic Warp Speed Starfield */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Cosmic Aurora Glow */}
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/10 via-emerald-500/10 to-transparent blur-[100px] rounded-full" />

        {/* Diagonal Warp Speed Particles */}
        <div className="absolute inset-0">
          {Array.from({ length: 35 }).map((_, i) => {
            const left = (i * 3.1) % 100;
            const top = (i * 5.7) % 100;
            const duration = (i % 3) * 0.3 + 0.5;
            const length = Math.floor((i % 4) * 25 + 35);
            return (
              <div
                key={i}
                className="absolute bg-gradient-to-r from-transparent via-cyan-300 to-white rounded-full opacity-70"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${length}px`,
                  height: '2px',
                  transform: 'rotate(-38deg)',
                  animation: `warpStreak ${duration}s linear infinite`,
                  boxShadow: '0 0 8px rgba(6, 182, 212, 0.8)',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Top Notification HUD Badge */}
      <div className="relative z-30 w-full max-w-4xl mx-auto pt-8 px-4 flex items-center justify-between pointer-events-auto">
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#08121e]/90 border border-cyan-500/50 text-cyan-300 text-xs font-bold uppercase tracking-wider shadow-[0_0_25px_rgba(6,182,212,0.4)] backdrop-blur-md animate-fadeIn">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>TRANSMISSION SECURED: FEEDBACK TELEMETRY DISPATCHED TO HQ</span>
        </div>

        <button
          onClick={handleSkip}
          className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-cyan-500/50 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
        >
          <span>SKIP</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Spaceship Flying Trajectory Container */}
      <div className="relative flex-1 w-full pointer-events-none">
        <div className="spaceship-flight-path absolute">
          {/* Spaceship Wrapper with Tilting & Exhaust Trail */}
          <div className="relative flex items-center justify-center -rotate-45">
            {/* Hyperspace Warp Ring Burst (Expands during warp jump) */}
            {phase === 'warp' && (
              <div className="absolute w-48 h-48 rounded-full border-4 border-cyan-400/80 animate-ping shadow-[0_0_50px_#06b6d4]" />
            )}

            {/* Glowing Ion Plasma Engine Plumes */}
            <div className="absolute top-[108px] flex items-center justify-center gap-7 pointer-events-none">
              {/* Left Thruster Plume */}
              <div className="flex flex-col items-center">
                <div className="w-5 h-20 rounded-full bg-gradient-to-b from-white via-cyan-400 to-transparent blur-[2px] ion-flame-flicker" />
                <div className="w-2.5 h-10 rounded-full bg-white -mt-20 blur-[1px]" />
              </div>
              {/* Right Thruster Plume */}
              <div className="flex flex-col items-center">
                <div className="w-5 h-20 rounded-full bg-gradient-to-b from-white via-cyan-400 to-transparent blur-[2px] ion-flame-flicker" />
                <div className="w-2.5 h-10 rounded-full bg-white -mt-20 blur-[1px]" />
              </div>
            </div>

            {/* Stardust Exhaust Wake Trail */}
            <div className="absolute top-36 w-16 h-48 bg-gradient-to-b from-cyan-400/40 via-emerald-400/20 to-transparent blur-md rounded-full pointer-events-none" />

            {/* High-Tech Cyber Starfighter Spaceship Vector SVG */}
            <div className="relative w-36 h-36 drop-shadow-[0_0_30px_rgba(6,182,212,0.8)]">
              <svg viewBox="0 0 160 160" className="w-full h-full overflow-visible">
                <defs>
                  {/* Cyber Metallic Hull Gradient */}
                  <linearGradient id="shipHull" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f8fafc" />
                    <stop offset="45%" stopColor="#cbd5e1" />
                    <stop offset="85%" stopColor="#334155" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>

                  {/* Neon Cyan Wing Shield Gradient */}
                  <linearGradient id="shieldEdge" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#00ff66" />
                  </linearGradient>

                  {/* Cockpit Canopy Mirror */}
                  <linearGradient id="cockpitGlass" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#a5f3fc" />
                    <stop offset="30%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#0369a1" />
                  </linearGradient>
                </defs>

                {/* Left Forward-Swept Wing */}
                <path
                  d="M 80 40 L 15 110 L 35 125 L 70 100 Z"
                  fill="url(#shipHull)"
                  stroke="#475569"
                  strokeWidth="1.5"
                />
                {/* Left Wing Neon Leading Edge */}
                <path d="M 80 40 L 15 110" stroke="url(#shieldEdge)" strokeWidth="3" strokeLinecap="round" />

                {/* Right Forward-Swept Wing */}
                <path
                  d="M 80 40 L 145 110 L 125 125 L 90 100 Z"
                  fill="url(#shipHull)"
                  stroke="#475569"
                  strokeWidth="1.5"
                />
                {/* Right Wing Neon Leading Edge */}
                <path d="M 80 40 L 145 110" stroke="url(#shieldEdge)" strokeWidth="3" strokeLinecap="round" />

                {/* Central Aerodynamic Fuselage Body */}
                <path
                  d="M 80 10 L 98 65 L 96 118 L 64 118 L 62 65 Z"
                  fill="url(#shipHull)"
                  stroke="#1e293b"
                  strokeWidth="2"
                />

                {/* Nose Cone Tip */}
                <path d="M 80 10 L 87 35 L 73 35 Z" fill="#06b6d4" />

                {/* Glass Cockpit Canopy */}
                <polygon
                  points="80,32 90,62 80,72 70,62"
                  fill="url(#cockpitGlass)"
                  stroke="#0284c7"
                  strokeWidth="1.5"
                />
                <ellipse cx="78" cy="48" rx="2.5" ry="6" fill="#ffffff" opacity="0.8" />

                {/* Twin Ion Engine Nacelles */}
                <rect x="52" y="100" width="14" height="18" rx="3" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />
                <rect x="94" y="100" width="14" height="18" rx="3" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />

                {/* Thruster Nozzle Glow Ring */}
                <ellipse cx="59" cy="118" rx="6" ry="2.5" fill="#38bdf8" />
                <ellipse cx="101" cy="118" rx="6" ry="2.5" fill="#38bdf8" />

                {/* Wingtip Navigation Strobe Lights */}
                <circle cx="15" cy="110" r="3.5" fill="#00ff66" className="animate-ping" />
                <circle cx="145" cy="110" r="3.5" fill="#ef4444" className="animate-ping" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Dispatch Confirmation HUD Card */}
      <div className="relative z-30 w-full max-w-md mx-auto pb-8 px-4 pointer-events-auto">
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#071320]/95 via-[#0c1a29]/95 to-[#071320]/95 border-2 border-emerald-500/60 shadow-[0_0_35px_rgba(0,255,102,0.3)] text-center space-y-1.5 backdrop-blur-md animate-fadeIn">
          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>PAYLOAD DELIVERED: {teamName}</span>
          </div>
          <p className="text-[11px] text-slate-300 font-sans">
            Your evaluation is en route to the engineering deck. Hyperspace coordinates confirmed.
          </p>
        </div>
      </div>

      {/* Custom Keyframes for Spaceship Flight Trajectory */}
      <style>{`
        @keyframes warpStreak {
          0% { transform: rotate(-38deg) translateX(-120px); opacity: 0; }
          20% { opacity: 0.9; }
          100% { transform: rotate(-38deg) translateX(120vw); opacity: 0; }
        }

        .spaceship-flight-path {
          animation: flyAcrossScreen 3.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @keyframes flyAcrossScreen {
          0% {
            left: -20vw;
            bottom: -20vh;
            transform: scale(0.6);
            opacity: 0;
          }
          15% {
            opacity: 1;
            transform: scale(0.9);
          }
          50% {
            left: 45vw;
            bottom: 45vh;
            transform: scale(1.15);
          }
          75% {
            left: 70vw;
            bottom: 70vh;
            transform: scale(1.05);
          }
          100% {
            left: 125vw;
            bottom: 125vh;
            transform: scale(0.4);
            opacity: 0;
          }
        }

        .ion-flame-flicker {
          animation: ionFlicker 0.1s ease-in-out infinite alternate;
          transform-origin: top center;
        }

        @keyframes ionFlicker {
          0% { transform: scaleY(0.9) scaleX(0.95); opacity: 0.85; }
          100% { transform: scaleY(1.3) scaleX(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
