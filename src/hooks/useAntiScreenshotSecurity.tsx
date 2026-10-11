import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { playErrorBuzz } from '../utils/audio.ts';

export interface AntiScreenshotState {
  isBlackedOut: boolean;
  blackoutReason: string;
  triggerSource: 'tab_switch' | 'blur' | 'screenshot_key' | 'devtools' | null;
  countdownSeconds: number | null;
  incidentCount: number;
  resumeSession: () => void;
  triggerBlackout: (reason: string, source: 'tab_switch' | 'blur' | 'screenshot_key' | 'devtools', durationSeconds?: number) => void;
}

const AntiScreenshotContext = createContext<AntiScreenshotState>({
  isBlackedOut: false,
  blackoutReason: '',
  triggerSource: null,
  countdownSeconds: null,
  incidentCount: 0,
  resumeSession: () => {},
  triggerBlackout: () => {},
});

export interface AntiScreenshotProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
  teamId?: string;
  teamName?: string;
  onSecurityIncident?: (source: string, details: string) => void;
}

export const AntiScreenshotProvider: React.FC<AntiScreenshotProviderProps> = ({
  children,
  enabled = true,
  teamId,
  teamName,
  onSecurityIncident,
}) => {
  const [isBlackedOut, setIsBlackedOut] = useState<boolean>(false);
  const [blackoutReason, setBlackoutReason] = useState<string>('');
  const [triggerSource, setTriggerSource] = useState<'tab_switch' | 'blur' | 'screenshot_key' | 'devtools' | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [incidentCount, setIncidentCount] = useState<number>(0);

  const countdownTimerRef = useRef<any>(null);
  const lastIncidentTimeRef = useRef<number>(0);
  const metaShiftTimeRef = useRef<number>(0);
  const printScreenTimeRef = useRef<number>(0);

  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdownSeconds(null);
  }, []);

  const resumeSession = useCallback(() => {
    clearCountdown();
    setIsBlackedOut(false);
    setBlackoutReason('');
    setTriggerSource(null);
  }, [clearCountdown]);

  const triggerBlackout = useCallback(
    (reason: string, source: 'tab_switch' | 'blur' | 'screenshot_key' | 'devtools', durationSeconds?: number) => {
      if (!enabled) return;

      const now = Date.now();
      if (now - lastIncidentTimeRef.current < 800) {
        return; // Debounce burst triggers
      }
      lastIncidentTimeRef.current = now;

      try {
        playErrorBuzz();
      } catch {}

      setIncidentCount((prev) => prev + 1);
      setIsBlackedOut(true);
      setBlackoutReason(reason);
      setTriggerSource(source);

      // Report incident to telemetry listener
      if (onSecurityIncident) {
        onSecurityIncident(source, reason);
      }

      // If a timed blackout is specified (e.g. 3-5s for key capture flash)
      clearCountdown();
      if (typeof durationSeconds === 'number' && durationSeconds > 0) {
        setCountdownSeconds(durationSeconds);
        countdownTimerRef.current = setInterval(() => {
          setCountdownSeconds((prev) => {
            if (prev === null || prev <= 1) {
              clearCountdown();
              setIsBlackedOut(false);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }
    },
    [enabled, onSecurityIncident, clearCountdown]
  );

  useEffect(() => {
    if (!enabled) {
      setIsBlackedOut(false);
      clearCountdown();
      return;
    }

    // 1. Page Visibility API (`document.hidden` / `visibilitychange`)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerBlackout(
          'Tab switching or window background state detected. Challenge viewport obscured.',
          'tab_switch'
        );
      } else {
        // Returned to window: allow automatic un-blackout once focused
        if (triggerSource === 'tab_switch' || triggerSource === 'blur') {
          // Keep active for brief protection moment or resume
          const t = setTimeout(() => {
            if (!document.hidden && document.hasFocus()) {
              resumeSession();
            }
          }, 600);
          return () => clearTimeout(t);
        }
      }
    };

    // 2. Window Blur Event (`window.onblur`)
    const handleWindowBlur = () => {
      const now = Date.now();
      // Check if blur happened immediately after Win+Shift+S or PrintScreen
      const timeSinceMetaShift = now - metaShiftTimeRef.current;
      const timeSincePrintScreen = now - printScreenTimeRef.current;

      if (timeSinceMetaShift < 2500 && metaShiftTimeRef.current > 0) {
        metaShiftTimeRef.current = 0;
        triggerBlackout(
          'Windows Snipping Tool (Win+Shift+S) overlay intercepted. Protective blackout activated.',
          'screenshot_key',
          4
        );
        return;
      }

      if (timeSincePrintScreen < 2500 && printScreenTimeRef.current > 0) {
        printScreenTimeRef.current = 0;
        triggerBlackout(
          'PrintScreen capture tool overlay detected. Viewport blackout engaged for 4 seconds.',
          'screenshot_key',
          4
        );
        return;
      }

      // Standard window blur / lost focus
      triggerBlackout(
        'Window lost focus or application overlay brought to foreground. Click window to resume.',
        'blur'
      );
    };

    // 3. Window Focus Event (`window.onfocus`)
    const handleWindowFocus = () => {
      if (triggerSource === 'blur' || triggerSource === 'tab_switch') {
        const timer = setTimeout(() => {
          if (document.hasFocus() && !document.hidden) {
            resumeSession();
          }
        }, 350);
        return () => clearTimeout(timer);
      }
    };

    // 4. Global Keyboard Event Listener (`keydown` & `keyup`)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Intercept PrntScrn
      const isPrntScrn =
        e.key === 'PrintScreen' ||
        e.key === 'Snapshot' ||
        e.code === 'PrintScreen' ||
        e.keyCode === 44 ||
        e.which === 44;

      if (isPrntScrn) {
        printScreenTimeRef.current = Date.now();
        e.preventDefault();
        e.stopPropagation();
        triggerBlackout(
          'PrintScreen key pressed. Protective blackout activated for 4 seconds to block image capture.',
          'screenshot_key',
          4
        );
        return;
      }

      // Track Meta+Shift for Windows Snipping Tool (Win+Shift+S)
      if (
        (e.metaKey && e.shiftKey) ||
        (e.key === 'Meta' && e.shiftKey) ||
        (e.shiftKey && (e.code === 'MetaLeft' || e.code === 'MetaRight')) ||
        (e.metaKey && (e.code === 'ShiftLeft' || e.code === 'ShiftRight'))
      ) {
        metaShiftTimeRef.current = Date.now();
      }

      const hasMetaOrCtrl = e.metaKey || e.ctrlKey;

      // Snipping Tool / Browser Snip (Ctrl+Shift+S or Win+Shift+S)
      if (
        (hasMetaOrCtrl && e.shiftKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS' || e.keyCode === 83)) ||
        (e.shiftKey && (e.key === 's' || e.key === 'S') && metaShiftTimeRef.current > 0)
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerBlackout(
          'Screen Snipping shortcut (Win/Ctrl+Shift+S) intercepted. Viewport blackout engaged for 4 seconds.',
          'screenshot_key',
          4
        );
        return;
      }

      // Mac Screen Capture (Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5)
      if (hasMetaOrCtrl && e.shiftKey && (['3', '4', '5'].includes(e.key) || ['Digit3', 'Digit4', 'Digit5'].includes(e.code))) {
        e.preventDefault();
        e.stopPropagation();
        triggerBlackout(
          `Mac Screen Capture shortcut (${e.key || e.code}) intercepted. Blackout engaged for 4 seconds.`,
          'screenshot_key',
          4
        );
        return;
      }

      // Print page / PDF export (Ctrl+P / Cmd+P)
      if (hasMetaOrCtrl && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP' || e.keyCode === 80)) {
        e.preventDefault();
        e.stopPropagation();
        triggerBlackout(
          'Print / PDF export shortcut (Ctrl+P) intercepted. Printing challenge material is forbidden.',
          'screenshot_key',
          4
        );
        return;
      }

      // Alt + PrintScreen
      if (e.altKey && isPrntScrn) {
        e.preventDefault();
        e.stopPropagation();
        triggerBlackout(
          'Alt+PrintScreen window capture intercepted. Blackout active for 4 seconds.',
          'screenshot_key',
          4
        );
        return;
      }

      // DevTools Inspection Protection (F12, Ctrl+Shift+I/J/C)
      if (
        e.key === 'F12' ||
        (hasMetaOrCtrl && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (hasMetaOrCtrl && (e.key === 'u' || e.key === 'U'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerBlackout(
          'Developer inspection shortcut intercepted. Source inspection is restricted on challenge content.',
          'devtools',
          3
        );
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const isPrntScrn =
        e.key === 'PrintScreen' ||
        e.key === 'Snapshot' ||
        e.code === 'PrintScreen' ||
        e.keyCode === 44 ||
        e.which === 44;

      if (isPrntScrn) {
        e.preventDefault();
        e.stopPropagation();
        triggerBlackout(
          'PrintScreen release intercepted. Blackout engaged for 4 seconds to shield viewport.',
          'screenshot_key',
          4
        );
        return;
      }

      // Catch Win+Shift+S when S is released
      if (
        (e.key === 's' || e.key === 'S' || e.code === 'KeyS') &&
        (e.metaKey || e.shiftKey || metaShiftTimeRef.current > 0)
      ) {
        if (Date.now() - metaShiftTimeRef.current < 2500) {
          e.preventDefault();
          e.stopPropagation();
          triggerBlackout(
            'Snipping Tool key release intercepted. Viewport blackout engaged for 4 seconds.',
            'screenshot_key',
            4
          );
        }
      }
    };

    // Attach listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      clearCountdown();
    };
  }, [enabled, triggerBlackout, resumeSession, clearCountdown, triggerSource]);

  return (
    <AntiScreenshotContext.Provider
      value={{
        isBlackedOut,
        blackoutReason,
        triggerSource,
        countdownSeconds,
        incidentCount,
        resumeSession,
        triggerBlackout,
      }}
    >
      {children}
    </AntiScreenshotContext.Provider>
  );
};

export const useAntiScreenshotSecurity = (): AntiScreenshotState => {
  return useContext(AntiScreenshotContext);
};
