import React, { useState, useEffect, useRef, useCallback } from 'react';
import { playErrorBuzz } from '../utils/audio.ts';

interface SecurityGuardProps {
  teamLoggedIn?: boolean;
  team?: {
    id: string;
    teamName: string;
    members?: string[];
    strikes?: number;
  } | null;
  isAdmin?: boolean;
  isReadyToStart?: boolean;
  isViewingArtifact?: boolean;
  onStrikeTriggered: (
    strikes: number,
    isDisqualified: boolean,
    reason: string,
    isCritical?: boolean
  ) => void;
}

export const SecurityGuard: React.FC<SecurityGuardProps> = ({
  teamLoggedIn,
  team,
  isAdmin,
  isReadyToStart,
  isViewingArtifact,
  onStrikeTriggered,
}) => {
  const [isBlankoutActive, setIsBlankoutActive] = useState<boolean>(false);
  const blankoutTimerRef = useRef<any>(null);
  const lastScreenshotReportTime = useRef<number>(0);
  const isCaptureInProgressRef = useRef<boolean>(false);
  const lastCaptureTimeRef = useRef<number>(0);
  const metaShiftPressedTime = useRef<number>(0);
  const printScreenPressedTime = useRef<number>(0);
  const ctrlShiftPressedTime = useRef<number>(0);

  const clearBlackout = useCallback(() => {
    if (blankoutTimerRef.current) {
      clearTimeout(blankoutTimerRef.current);
      blankoutTimerRef.current = null;
    }
    const curtain = document.getElementById('drm-global-blackout-curtain');
    if (curtain && curtain.parentNode) {
      curtain.parentNode.removeChild(curtain);
    }
    document.documentElement.classList.remove('drm-blackout-active');
    document.body.classList.remove('drm-blackout-active');
    document.body.style.backgroundColor = '';
    document.documentElement.style.backgroundColor = '';
    setIsBlankoutActive(false);
    isCaptureInProgressRef.current = false;
  }, []);

  // Synchronously blackout the entire screen so any captured screenshot image is 100% pitch black
  const triggerScreenshotBlackout = useCallback((durationMs = 3000) => {
    // Zero blackout in the admin section OR when student has not started the competition
    if (isAdmin || !teamLoggedIn || !isReadyToStart) return;

    // 1. Immediately inject root body blackout shield curtain directly onto DOM (outside #root)
    let curtain = document.getElementById('drm-global-blackout-curtain');
    if (!curtain) {
      curtain = document.createElement('div');
      curtain.id = 'drm-global-blackout-curtain';
      curtain.style.cssText =
        'position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100vh!important;background:#000000!important;background-color:#000000!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;opacity:1!important;visibility:visible!important;';
      document.body.appendChild(curtain);
    } else {
      curtain.style.display = 'block';
      curtain.style.opacity = '1';
      curtain.style.visibility = 'visible';
    }

    // 2. Add classes to html and body, set pitch-black backgrounds
    document.documentElement.classList.add('drm-blackout-active');
    document.body.classList.add('drm-blackout-active');
    document.body.style.backgroundColor = '#000000';
    document.documentElement.style.backgroundColor = '#000000';
    setIsBlankoutActive(true);

    // Force synchronous layout reflow so the browser paints the black frame BEFORE screenshot snapshot
    void document.documentElement.offsetHeight;

    // 3. Overwrite / wipe clipboard text to prevent copying
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText('');
      }
    } catch {}

    if (blankoutTimerRef.current) {
      clearTimeout(blankoutTimerRef.current);
      blankoutTimerRef.current = null;
    }

    if (durationMs > 0) {
      blankoutTimerRef.current = setTimeout(() => {
        // If window is currently blurred because of an active snip, DO NOT clear until focus returns
        if (isCaptureInProgressRef.current) return;
        clearBlackout();
      }, durationMs);
    }
  }, [isAdmin, teamLoggedIn, isReadyToStart, clearBlackout]);

  useEffect(() => {
    // Zero blackout and zero restrictions on login/landing page, before starting, or in admin section
    if (isAdmin || !teamLoggedIn || !isReadyToStart) {
      clearBlackout();
      return;
    }

    // Report incident telemetry to server silently (ONLY for competing teams, NEVER for admin)
    const reportScreenshotAttempt = async (shortcutKey: string, details: string) => {
      if (isAdmin) return;
      // Warnings only begin after the test competition starts
      if (!isReadyToStart) return;

      const now = Date.now();
      if (now - lastScreenshotReportTime.current < 1200) {
        return;
      }
      lastScreenshotReportTime.current = now;

      try {
        playErrorBuzz();
      } catch {}

      const currentStrikes = team?.strikes || 0;
      const nextStrikes = currentStrikes + 1;
      const warningReason = `⚠️ SCREENSHOT DETECTED: Screen capture attempt (${shortcutKey}) was blocked and blacked out.`;

      onStrikeTriggered(nextStrikes, false, warningReason, false);

      const token = localStorage.getItem('ctf_team_token');
      try {
        const res = await fetch('/api/telemetry/screenshot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            key: shortcutKey,
            details,
            teamId: team?.id,
            teamName: team?.teamName,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (typeof data.strikes === 'number') {
            onStrikeTriggered(data.strikes, false, warningReason, false);
          }
        }
      } catch (err) {
        console.warn('Failed to transmit screenshot alert telemetry:', err);
      }
    };

    const isPrintScreen = (e: KeyboardEvent): boolean => {
      return (
        e.key === 'PrintScreen' ||
        e.key === 'Snapshot' ||
        e.code === 'PrintScreen' ||
        e.keyCode === 44 ||
        e.which === 44 ||
        (typeof e.key === 'string' && e.key.toLowerCase().includes('printscreen')) ||
        (typeof e.code === 'string' && e.code.toLowerCase().includes('printscreen'))
      );
    };

    // 1. KeyDown: Instantly black out on any screenshot attempt
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAdmin) return;

      // Explicit bypass for Stealth Admin Hotkeys: Ctrl+Shift+G / Ctrl+Shift+A / Alt+G / Alt+A
      const hasCtrlOrMeta = e.ctrlKey || e.metaKey;
      const keyLower = e.key ? e.key.toLowerCase() : '';
      const code = e.code || '';
      if (
        (hasCtrlOrMeta && e.shiftKey && (['g', 'a'].includes(keyLower) || ['KeyG', 'KeyA'].includes(code))) ||
        (e.altKey && (['g', 'a'].includes(keyLower) || ['KeyG', 'KeyA'].includes(code)))
      ) {
        return;
      }

      // PrintScreen detected directly on keydown
      if (isPrintScreen(e)) {
        e.preventDefault();
        e.stopPropagation();
        printScreenPressedTime.current = Date.now();
        lastCaptureTimeRef.current = Date.now();
        isCaptureInProgressRef.current = true;
        triggerScreenshotBlackout(3500);
        reportScreenshotAttempt('PrintScreen', 'PrintScreen key pressed. Viewport blacked out.');
        return;
      }

      // Detect Windows key + Shift combo (Windows Snipping Tool: Win+Shift+S)
      if (
        (e.metaKey && e.shiftKey) ||
        (e.key === 'Meta' && e.shiftKey) ||
        (e.shiftKey && (e.code === 'MetaLeft' || e.code === 'MetaRight')) ||
        (e.metaKey && (e.code === 'ShiftLeft' || e.code === 'ShiftRight'))
      ) {
        metaShiftPressedTime.current = Date.now();
        lastCaptureTimeRef.current = Date.now();
        isCaptureInProgressRef.current = true;
        triggerScreenshotBlackout(3500);
        reportScreenshotAttempt('Win+Shift+S', 'Screen capture attempt (Win+Shift+S) blocked and blacked out.');
        return;
      }

      // Detect Ctrl + Shift + S (Browser Web Capture)
      if (e.ctrlKey && e.shiftKey && (keyLower === 's' || code === 'KeyS')) {
        e.preventDefault();
        e.stopPropagation();
        ctrlShiftPressedTime.current = Date.now();
        lastCaptureTimeRef.current = Date.now();
        isCaptureInProgressRef.current = true;
        triggerScreenshotBlackout(3500);
        reportScreenshotAttempt('Ctrl+Shift+S', 'Screen capture (Ctrl+Shift+S) blocked and blacked out.');
        return;
      }

      // Detect macOS Screen Capture (Cmd+Shift+3/4/5/6)
      if (e.metaKey && e.shiftKey && ['3', '4', '5', '6'].includes(keyLower)) {
        e.preventDefault();
        e.stopPropagation();
        lastCaptureTimeRef.current = Date.now();
        isCaptureInProgressRef.current = true;
        triggerScreenshotBlackout(3500);
        reportScreenshotAttempt(`Cmd+Shift+${keyLower}`, 'Screen capture blocked and blacked out.');
        return;
      }

      // Intercept Copy / Cut / Select-All keyboard shortcuts on challenge body content (Student only)
      const target = e.target as HTMLElement;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        Boolean(target.closest('input, textarea, [contenteditable="true"]'))
      );

      if (!isInput && hasCtrlOrMeta) {
        if (['c', 'x', 'u'].includes(keyLower) || (keyLower === 'a' && !e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          if (['c', 'x'].includes(keyLower)) {
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText('');
              }
            } catch {}
          }
        }
      }

      // Silent devtools shortcut protection
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key))) {
        e.preventDefault();
      }
    };

    // 2. KeyUp: Catch keyboards that send PrintScreen exclusively on release
    const handleKeyUp = (e: KeyboardEvent) => {
      if (isAdmin) return;

      if (isPrintScreen(e)) {
        e.preventDefault();
        e.stopPropagation();
        printScreenPressedTime.current = Date.now();
        lastCaptureTimeRef.current = Date.now();
        isCaptureInProgressRef.current = true;
        triggerScreenshotBlackout(3500);
        reportScreenshotAttempt('PrintScreen', 'PrintScreen key released. Viewport blacked out.');
      }
    };

    // 3. Window Blur: If Snipping Tool, Win+Shift+S, or screen capture activates, OS blurs browser
    // The screen must REMAIN 100% black as long as the window is blurred!
    const handleBlur = () => {
      if (isAdmin) return;
      const now = Date.now();
      const isRecentSnip =
        isCaptureInProgressRef.current ||
        (metaShiftPressedTime.current > 0 && now - metaShiftPressedTime.current < 5000) ||
        (printScreenPressedTime.current > 0 && now - printScreenPressedTime.current < 5000) ||
        (ctrlShiftPressedTime.current > 0 && now - ctrlShiftPressedTime.current < 5000) ||
        (lastCaptureTimeRef.current > 0 && now - lastCaptureTimeRef.current < 5000);

      if (isRecentSnip) {
        isCaptureInProgressRef.current = true;
        triggerScreenshotBlackout(0);
      }
    };

    // 4. Window Focus: Once student returns to browser, safely restore screen immediately
    const handleFocus = () => {
      if (isCaptureInProgressRef.current) {
        setTimeout(() => {
          isCaptureInProgressRef.current = false;
          lastCaptureTimeRef.current = 0;
          metaShiftPressedTime.current = 0;
          printScreenPressedTime.current = 0;
          ctrlShiftPressedTime.current = 0;
          clearBlackout();
        }, 400);
      } else {
        clearBlackout();
      }
    };

    // 5. Intercept Copy & Cut attempts to prevent copying challenge text (Student only)
    const handleCopy = (e: ClipboardEvent) => {
      if (isAdmin) return;
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (!isInput) {
        e.preventDefault();
        if (e.clipboardData) {
          e.clipboardData.setData('text/plain', '');
        }
      }
    };

    const handleCut = (e: ClipboardEvent) => {
      if (isAdmin) return;
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (!isInput) {
        e.preventDefault();
        if (e.clipboardData) {
          e.clipboardData.setData('text/plain', '');
        }
      }
    };

    // 6. Disable right click context menu on questions/challenges/artifacts (Student only)
    const handleContextMenu = (e: MouseEvent) => {
      if (isAdmin) return;
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (!isInput) {
        e.preventDefault();
      }
    };

    // 7. Disable text dragging and selection on protected areas (Student only)
    const handleDragStart = (e: DragEvent) => {
      if (isAdmin) return;
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (!isInput) {
        e.preventDefault();
      }
    };

    const handleSelectStart = (e: Event) => {
      if (isAdmin) return;
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (!isInput) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleBlur, true);
    window.addEventListener('focus', handleFocus, true);
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCut, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('dragstart', handleDragStart, true);
    document.addEventListener('selectstart', handleSelectStart, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleBlur, true);
      window.removeEventListener('focus', handleFocus, true);
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      document.removeEventListener('selectstart', handleSelectStart, true);
      clearBlackout();
    };
  }, [teamLoggedIn, isReadyToStart, isAdmin, team?.id, team?.teamName, team?.strikes, isViewingArtifact, onStrikeTriggered, triggerScreenshotBlackout, clearBlackout]);

  // When blackout is active during a screenshot capture, render 100% pitch-black screen (ONLY when student has started)
  if (isBlankoutActive && !isAdmin && teamLoggedIn && isReadyToStart) {
    return (
      <div
        id="screenshot-blackout-shield"
        className="drm-blackout-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#000000',
          zIndex: 2147483647,
          pointerEvents: 'none',
        }}
      />
    );
  }

  return null;
};
