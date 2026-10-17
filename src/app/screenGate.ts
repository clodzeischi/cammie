import { useSyncExternalStore } from 'react';

/** Below this width nothing fits, whatever the input device. */
const MIN_WIDTH = 600;
/** Touch-only devices under this width are phones, not tablets. */
const MIN_TOUCH_WIDTH = 768;

/** SPEC.md §11: phones get a message instead of the app. Tablets and desktops pass. */
export function isScreenTooSmall(width: number, coarsePointerOnly: boolean): boolean {
  return width < MIN_WIDTH || (coarsePointerOnly && width < MIN_TOUCH_WIDTH);
}

const COARSE_QUERY = '(pointer: coarse)';

function read(): boolean {
  const coarse = window.matchMedia?.(COARSE_QUERY).matches ?? false;
  return isScreenTooSmall(window.innerWidth, coarse);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

/** Re-evaluates on resize and rotation. */
export function useScreenTooSmall(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
