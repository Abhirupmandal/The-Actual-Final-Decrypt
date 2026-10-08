import React, { useEffect, useRef } from 'react';
import { playErrorBuzz } from '../utils/audio.ts';

interface SecurityGuardProps {
  teamLoggedIn: boolean;
  onStrikeTriggered: (strikes: number, isDisqualified: boolean, reason: string) => void;
}

export const SecurityGuard: React.FC<SecurityGuardProps> = ({
  teamLoggedIn,
  onStrikeTriggered,
}) => {
  const lastInfractionTime = useRef<number>(0);

  useEffect(() => {
    // Only enforce active strikes if a team is logged in and competing
    if (!teamLoggedIn) return;

    const reportInfraction = async (reason: string, shortcutKey?: string) => {
      const now = Date.now();
      // Debounce infractions to prevent multiple rapid triggers on a single event
      if (now - lastInfractionTime.current < 3000) {
        return;
      }
      lastInfractionTime.current = now;

      playErrorBuzz();

      const token = localStorage.getItem('ctf_team_token');
      try {
        const res = await fetch('/api/telemetry/strike', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ reason, key: shortcutKey }),
        });

        if (res.ok) {
          const data = await res.json();
          onStrikeTriggered(data.strikes, data.isDisqualified, data.reason || reason);
        }
      } catch (err) {
        console.warn('Failed to report security telemetry:', err);
      }
    };

    // 1. Right-click context menu interceptor
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportInfraction('Right-click context inspection attempt blocked.');
    };

    // 2. Restricted Keystrokes & DevTools Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        reportInfraction('Screen capture shortcut intercepted.', 'PrintScreen');
        return;
      }

      // F12 Developer Tools
      if (e.key === 'F12') {
        e.preventDefault();
        reportInfraction('Developer tools inspection hotkey intercepted.', 'F12');
        return;
      }

      // Ctrl+Shift+I / Cmd+Option+I / Ctrl+Shift+J / Ctrl+Shift+C
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)
      ) {
        e.preventDefault();
        reportInfraction('Developer console element inspection intercepted.', `Ctrl+Shift+${e.key.toUpperCase()}`);
        return;
      }

      // Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && ['u', 'U'].includes(e.key)) {
        e.preventDefault();
        reportInfraction('View-source document extraction intercepted.', 'Ctrl+U');
        return;
      }

      // Ctrl+P (Print document)
      if ((e.ctrlKey || e.metaKey) && ['p', 'P'].includes(e.key)) {
        e.preventDefault();
        reportInfraction('Print / PDF document capture intercepted.', 'Ctrl+P');
        return;
      }

      // Ctrl+S (Save page)
      if ((e.ctrlKey || e.metaKey) && ['s', 'S'].includes(e.key)) {
        e.preventDefault();
        reportInfraction('Save webpage locally intercepted.', 'Ctrl+S');
        return;
      }
    };

    // 3. Tab Visibility & Focus Loss Monitoring
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportInfraction('Tab switch / background visibility change detected.');
      }
    };

    const handleWindowBlur = () => {
      reportInfraction('Window focus loss / application blur detected.');
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [teamLoggedIn, onStrikeTriggered]);

  return null;
};
