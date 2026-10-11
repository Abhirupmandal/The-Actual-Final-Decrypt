import React, { useEffect, useRef } from 'react';

/**
 * BinaryRainBackground
 * 
 * Matrix-style animated HTML5 Canvas background streaming pure binary digits ('0' and '1').
 * Engineered for 60fps smoothness, zero input blocking, full viewport responsiveness,
 * and high-contrast readability across all light & dark CTF views.
 */
interface BinaryRainBackgroundProps {
  speed?: number;
}

export const BinaryRainBackground: React.FC<BinaryRainBackgroundProps> = ({ speed = 1.0 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speedRef = useRef<number>(speed);

  useEffect(() => {
    speedRef.current = Math.max(0.1, Math.min(5.0, speed));
  }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = 0;

    interface ColumnState {
      y: number; // Current vertical position in rows
      speed: number; // Column fall speed multiplier
      chars: string[]; // Recent characters in column
    }

    let columns: ColumnState[] = [];
    let width = 0;
    let height = 0;
    let fontSize = 15;
    let colSpacing = 15;
    let targetFps = 36;
    let frameInterval = 1000 / targetFps;

    const initCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const isMobile = width < 768;

      // On mobile devices, conserve CPU/battery:
      // 1. Cap DPR to 1 (prevents massive 3x retina overdraw for background canvas)
      // 2. Reduce target FPS from 36 to 26
      // 3. Double column width spacing (colSpacing 30px instead of 15px)
      const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      targetFps = isMobile ? 26 : 36;
      frameInterval = 1000 / targetFps;

      fontSize = isMobile ? 16 : 15;
      colSpacing = isMobile ? 30 : 15;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
      const font = `${fontSize}px 'Share Tech Mono', Consolas, 'Courier New', monospace`;
      ctx.font = font;

      // Fill initial backdrop
      ctx.fillStyle = '#07090e';
      ctx.fillRect(0, 0, width, height);

      const numColumns = Math.ceil(width / colSpacing);
      columns = [];
      for (let i = 0; i < numColumns; i++) {
        columns.push({
          y: Math.floor(Math.random() * -(height / fontSize)), // Stagger initial starts off-screen
          speed: 0.6 + Math.random() * 0.8, // Speed variation (0.6x - 1.4x)
          chars: [],
        });
      }
    };

    initCanvas();

    const handleResize = () => {
      initCanvas();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    const render = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(render);

      const delta = currentTime - lastTime;
      if (delta < frameInterval) return;
      lastTime = currentTime - (delta % frameInterval);

      // Semi-transparent dark background clear to produce smooth trailing fade paths
      ctx.fillStyle = 'rgba(7, 9, 14, 0.085)';
      ctx.fillRect(0, 0, width, height);

      const isMobile = width < 768;
      ctx.font = `${fontSize}px 'Share Tech Mono', Consolas, 'Courier New', monospace`;
      ctx.textBaseline = 'top';

      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const x = i * colSpacing;
        const yPos = col.y * fontSize;

        // Generate binary digit with 50/50 probability
        const bit = Math.random() > 0.5 ? '1' : '0';

        // 1. Draw leading head digit (bright white-green with glow)
        if (yPos >= -fontSize && yPos <= height + fontSize) {
          ctx.save();
          ctx.shadowColor = '#00FF66';
          ctx.shadowBlur = isMobile ? 4 : 8; // Reduced glow blur on mobile saves composite overhead
          ctx.fillStyle = '#E6FFF0';
          ctx.fillText(bit, x, yPos);
          ctx.restore();
        }

        // 2. Draw trailing digit just above the head (vibrant hacker neon green)
        const trailY = (col.y - 1) * fontSize;
        if (trailY >= -fontSize && trailY <= height + fontSize) {
          const trailBit = Math.random() > 0.5 ? '1' : '0';
          ctx.fillStyle = '#00FF66';
          ctx.fillText(trailBit, x, trailY);
        }

        // 3. Occasional bit mutation in older trailing positions for authentic digital flicker
        if (Math.random() < 0.15 && col.y > 3) {
          const randomPastRow = Math.floor(Math.random() * col.y);
          const pastY = randomPastRow * fontSize;
          if (pastY >= 0 && pastY <= height) {
            ctx.fillStyle = Math.random() > 0.3 ? 'rgba(0, 255, 102, 0.5)' : 'rgba(0, 200, 80, 0.3)';
            ctx.fillText(Math.random() > 0.5 ? '1' : '0', x, pastY);
          }
        }

        // Advance column position with dynamic speed multiplier
        col.y += col.speed * speedRef.current;

        // Reset column to top once it falls past screen with randomized interval
        if (col.y * fontSize > height && Math.random() > 0.965) {
          col.y = -Math.floor(Math.random() * 5); // Start slightly above screen
          col.speed = 0.6 + Math.random() * 0.8;
        }
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden"
      style={{
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* HTML5 Binary Rain Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full pointer-events-none"
      />

      {/* Atmospheric Vignette & Contrast Shading to ensure 100% foreground text clarity */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(7, 9, 14, 0.45) 0%, rgba(5, 7, 12, 0.82) 100%)',
        }}
      />
    </div>
  );
};
