import React, { useEffect, useState, useRef } from 'react';
import { Rocket, Sparkles, Zap, Shield, ArrowRight, X } from 'lucide-react';
import { playRocketLaunchSound, playCyberBlip } from '../utils/audio.ts';

interface RocketLaunchModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const RocketLaunchModal: React.FC<RocketLaunchModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const [stage, setStage] = useState<'countdown' | 'launching' | 'orbit' | 'complete'>('countdown');
  const [count, setCount] = useState<number>(3);
  const [telemetryAltitude, setTelemetryAltitude] = useState<number>(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const isDoneRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setStage('countdown');
      setCount(3);
      setTelemetryAltitude(0);
      isDoneRef.current = false;
      return;
    }

    isDoneRef.current = false;
    setStage('countdown');
    setCount(3);
    setTelemetryAltitude(0);

    // Play rocket launch sound
    try {
      playRocketLaunchSound();
    } catch {}

    // Countdown 3... 2... 1...
    const countTimer1 = setTimeout(() => setCount(2), 500);
    const countTimer2 = setTimeout(() => setCount(1), 1000);

    // Liftoff at 1.5s
    const launchTimer = setTimeout(() => {
      setStage('launching');
    }, 1500);

    // Orbit reached at 3.8s
    const orbitTimer = setTimeout(() => {
      setStage('orbit');
    }, 3800);

    // Reveal Winners at 5.0s
    const completeTimer = setTimeout(() => {
      if (!isDoneRef.current) {
        isDoneRef.current = true;
        setStage('complete');
        onCompleteRef.current();
      }
    }, 5000);

    return () => {
      clearTimeout(countTimer1);
      clearTimeout(countTimer2);
      clearTimeout(launchTimer);
      clearTimeout(orbitTimer);
      clearTimeout(completeTimer);
    };
  }, [isOpen]);

  // Altitude counter during launching phase
  useEffect(() => {
    if (stage !== 'launching') return;
    const interval = setInterval(() => {
      setTelemetryAltitude((prev) => {
        if (prev >= 420000) return 420000;
        return prev + Math.floor(Math.random() * 25000 + 15000);
      });
    }, 80);
    return () => clearInterval(interval);
  }, [stage]);

  // Keyboard escape shortcut to skip
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSkip = () => {
    if (isDoneRef.current) return;
    isDoneRef.current = true;
    try {
      playCyberBlip(900);
    } catch {}
    onComplete();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-black flex flex-col items-center justify-between overflow-hidden font-mono select-none">
      {/* Dynamic Starfield / Warp Speed Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Ambient Nebula Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-600/15 via-amber-500/10 to-purple-600/15 blur-[120px] rounded-full" />
        
        {/* Parallax Star Trails */}
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${
            stage === 'launching' ? 'opacity-90' : 'opacity-40'
          }`}
        >
          {Array.from({ length: 45 }).map((_, i) => {
            const left = (i * 2.3 + 1) % 100;
            const top = (i * 7.7) % 100;
            const duration = stage === 'launching' ? (i % 3) * 0.2 + 0.4 : (i % 4) * 0.8 + 2;
            const height = stage === 'launching' ? `${Math.floor((i % 5) * 15 + 30)}px` : '2px';
            return (
              <div
                key={i}
                className="absolute bg-white rounded-full transition-all"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: stage === 'launching' ? '2px' : `${(i % 3) + 1}px`,
                  height,
                  opacity: (i % 5) * 0.15 + 0.3,
                  boxShadow: '0 0 6px rgba(255, 255, 255, 0.8)',
                  animation: `starFall ${duration}s linear infinite`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Top HUD Bar */}
      <div className="relative z-20 w-full max-w-6xl px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <span className="text-xs font-black tracking-widest text-amber-400 uppercase">
            MISSION CONTROL // EVENT FINALIZATION PROTOCOL
          </span>
        </div>

        <button
          onClick={handleSkip}
          className="px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-amber-500/60 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(0,0,0,0.6)]"
        >
          <span>SKIP TO WINNERS</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Central Launch Area */}
      <div className="relative z-10 flex-1 w-full flex flex-col items-center justify-center p-4">
        {/* Stage 1: Countdown Display */}
        {stage === 'countdown' && (
          <div className="text-center space-y-4 animate-fadeIn">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs font-bold tracking-widest uppercase">
              <Zap className="w-3.5 h-3.5 animate-pulse" />
              <span>ARENA TIME CONCLUDED · INITIATING LIFTOFF</span>
            </div>

            <div className="relative">
              <div className="text-7xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-300 to-amber-500 tracking-tight drop-shadow-[0_0_40px_rgba(245,158,11,0.6)] scale-110 transition-transform">
                {count > 0 ? count : 'GO!'}
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              Igniting victory thrusters to calculate final leaderboard standings...
            </p>
          </div>
        )}

        {/* Stage 2 & 3: Rocket & Thrusters */}
        {(stage === 'launching' || stage === 'countdown') && (
          <div
            className={`relative flex flex-col items-center transition-all ${
              stage === 'launching' ? 'rocket-ascend' : ''
            }`}
            style={{
              transitionDuration: '2.5s',
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* Sci-Fi Rocket Vessel SVG */}
            <div className="relative w-28 sm:w-36 h-56 sm:h-72 drop-shadow-[0_0_35px_rgba(245,158,11,0.7)]">
              <svg viewBox="0 0 100 200" className="w-full h-full overflow-visible">
                <defs>
                  {/* Hull Metallic Gradient */}
                  <linearGradient id="rocketBody" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f8fafc" />
                    <stop offset="50%" stopColor="#cbd5e1" />
                    <stop offset="100%" stopColor="#64748b" />
                  </linearGradient>

                  {/* Cockpit Glow */}
                  <linearGradient id="cockpitGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#0284c7" />
                  </linearGradient>

                  {/* Thruster Flame Gradient */}
                  <linearGradient id="flameCore" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="25%" stopColor="#fef08a" />
                    <stop offset="60%" stopColor="#f59e0b" />
                    <stop offset="85%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>

                  {/* Plasma Outer Glow */}
                  <linearGradient id="plasmaGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>

                {/* Left Fin */}
                <path
                  d="M 32 125 L 8 165 L 28 165 L 34 140 Z"
                  fill="#dc2626"
                  stroke="#991b1b"
                  strokeWidth="1.5"
                />

                {/* Right Fin */}
                <path
                  d="M 68 125 L 92 165 L 72 165 L 66 140 Z"
                  fill="#dc2626"
                  stroke="#991b1b"
                  strokeWidth="1.5"
                />

                {/* Center Rocket Hull */}
                <path
                  d="M 50 15 
                     C 65 50, 70 100, 70 155 
                     L 30 155 
                     C 30 100, 35 50, 50 15 Z"
                  fill="url(#rocketBody)"
                  stroke="#334155"
                  strokeWidth="2"
                />

                {/* Cyber Decal Accent Stripe */}
                <path
                  d="M 33 115 L 67 115 L 69 135 L 31 135 Z"
                  fill="#f59e0b"
                  opacity="0.9"
                />

                {/* Rocket Nose Cone Accent */}
                <path
                  d="M 50 15 C 56 32, 60 48, 62 55 L 38 55 C 40 48, 44 32, 50 15 Z"
                  fill="#dc2626"
                />

                {/* Cockpit Window */}
                <circle cx="50" cy="75" r="9" fill="url(#cockpitGlow)" stroke="#0284c7" strokeWidth="2" />
                <circle cx="48" cy="72" r="3.5" fill="#ffffff" opacity="0.8" />

                {/* Thruster Nozzle */}
                <path d="M 38 155 L 62 155 L 66 168 L 34 168 Z" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />

                {/* Blazing Flame Plume (Active during launch) */}
                <g className={stage === 'launching' ? 'rocket-flame-intense' : 'rocket-flame-warmup'}>
                  {/* Outer Plasma Fringe */}
                  <ellipse cx="50" cy="195" rx="16" ry="32" fill="url(#plasmaGlow)" opacity="0.6" />
                  {/* Main Flame Tongue */}
                  <path
                    d="M 36 168 Q 50 240, 50 250 Q 50 240, 64 168 Z"
                    fill="url(#flameCore)"
                  />
                  {/* White-Hot Core */}
                  <ellipse cx="50" cy="180" rx="6" ry="16" fill="#ffffff" />
                </g>
              </svg>
            </div>

            {/* Launchpad Smoke Billows */}
            <div className="relative w-64 h-12 -mt-4 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-10 rounded-full bg-gradient-to-r from-amber-500/30 via-orange-500/40 to-amber-500/30 blur-xl animate-pulse" />
              <div className="absolute w-36 h-6 rounded-full bg-white/40 blur-md" />
            </div>
          </div>
        )}

        {/* Stage 3: Orbit Burst & Transition to Winners */}
        {stage === 'orbit' && (
          <div className="text-center space-y-5 animate-scaleUp">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500/30 via-yellow-400/40 to-cyan-500/30 border-2 border-amber-400/80 flex items-center justify-center text-amber-300 shadow-[0_0_60px_rgba(251,191,36,0.6)] animate-pulse">
                <Sparkles className="w-12 h-12 animate-spin" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black tracking-widest text-cyan-400 uppercase">
                ORBIT ACHIEVED // FINAL RESULTS TELEMETRY LOCKED
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]">
                CHAMPIONS COMPUTED
              </h2>
              <p className="text-xs sm:text-sm text-amber-200/90 font-sans max-w-md mx-auto">
                Opening the official Arena Winners Ceremony &amp; Victory Podium...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Telemetry HUD Bar */}
      <div className="relative z-20 w-full max-w-4xl px-6 pb-6">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#090d16]/90 border border-slate-800 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3 shadow-[0_0_25px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">TELEMETRY:</span>
            <span className="text-emerald-400 font-bold">
              {stage === 'countdown'
                ? 'STANDBY // COUNTDOWN ACTIVE'
                : stage === 'launching'
                ? 'THRUSTERS 100% // ASCENT IN PROGRESS'
                : 'ORBITAL LOCK // COMPUTATION COMPLETE'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <div>
              <span className="text-slate-500">ALTITUDE:</span>{' '}
              <span className="text-amber-400 font-bold">
                {telemetryAltitude > 0 ? `${(telemetryAltitude / 1000).toFixed(1)} KM` : 'LAUNCH PAD'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">VELOCITY:</span>{' '}
              <span className="text-cyan-400 font-bold">
                {stage === 'launching' ? '7.8 KM/S' : stage === 'orbit' ? '11.2 KM/S' : '0.0 KM/S'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded CSS for Starfall and Rocket Ascend Keyframes */}
      <style>{`
        @keyframes starFall {
          0% { transform: translateY(-100px); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(110vh); opacity: 0; }
        }

        .rocket-ascend {
          animation: rocketLaunchSequence 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes rocketLaunchSequence {
          0% {
            transform: translateY(0) scale(1);
          }
          15% {
            transform: translateY(10px) scale(1.02);
          }
          40% {
            transform: translateY(-80px) scale(1.05);
          }
          70% {
            transform: translateY(-350px) scale(0.9);
          }
          100% {
            transform: translateY(-120vh) scale(0.6);
            opacity: 0;
          }
        }

        .rocket-flame-warmup {
          animation: flameFlicker 0.15s ease-in-out infinite alternate;
          transform-origin: 50px 168px;
        }

        .rocket-flame-intense {
          animation: flameIntense 0.08s ease-in-out infinite alternate;
          transform-origin: 50px 168px;
        }

        @keyframes flameFlicker {
          0% { transform: scaleY(0.8) scaleX(0.9); opacity: 0.8; }
          100% { transform: scaleY(1.1) scaleX(1.05); opacity: 1; }
        }

        @keyframes flameIntense {
          0% { transform: scaleY(1.3) scaleX(1.1); opacity: 0.95; }
          100% { transform: scaleY(1.8) scaleX(1.25); opacity: 1; }
        }

        @keyframes scaleUp {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .animate-scaleUp {
          animation: scaleUp 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
