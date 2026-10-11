/**
 * Fullscreen API utility helper with cross-browser support
 */

export const requestAppFullscreen = async (): Promise<boolean> => {
  try {
    if (typeof document === 'undefined') return false;

    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      return true;
    }

    const docEl = document.documentElement as any;
    if (docEl.requestFullscreen) {
      await docEl.requestFullscreen();
      return true;
    } else if (docEl.webkitRequestFullscreen) {
      await docEl.webkitRequestFullscreen();
      return true;
    } else if (docEl.msRequestFullscreen) {
      await docEl.msRequestFullscreen();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Browser rejected fullscreen request:', err);
    return false;
  }
};

export const exitAppFullscreen = async (): Promise<boolean> => {
  try {
    if (typeof document === 'undefined') return true;

    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      return true;
    }

    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return true;
    } else if ((document as any).webkitExitFullscreen) {
      await (document as any).webkitExitFullscreen();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Failed to exit fullscreen:', err);
    return false;
  }
};

export const isAppFullscreen = (): boolean => {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
};
