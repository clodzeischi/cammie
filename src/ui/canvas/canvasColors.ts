import { useSyncExternalStore } from 'react';

/** Konva draws on a <canvas>, so it needs real colour strings, not CSS variables. */
export interface CanvasColors {
  stockFill: string;
  stockEdge: string;
  grid: string;
  gridMajor: string;
  path: string;
  pathSelected: string;
  axisX: string;
  axisY: string;
  rapid: string;
  /** One colour per exported file / bit. */
  toolpaths: string[];
}

const TOKENS = {
  stockFill: '--canvas-stock',
  stockEdge: '--canvas-stock-edge',
  grid: '--canvas-grid',
  gridMajor: '--canvas-grid-major',
  path: '--canvas-path',
  pathSelected: '--accent',
  axisX: '--canvas-axis-x',
  axisY: '--canvas-axis-y',
  rapid: '--canvas-rapid',
} as const;

const TOOLPATH_TOKENS = ['--canvas-toolpath-1', '--canvas-toolpath-2', '--canvas-toolpath-3'];

let cached: CanvasColors | null = null;

function read(): CanvasColors {
  if (cached) return cached;
  const style = getComputedStyle(document.documentElement);
  const get = (name: string) => style.getPropertyValue(name).trim() || '#888';
  const colors = Object.fromEntries(
    Object.entries(TOKENS).map(([key, token]) => [key, get(token)]),
  ) as Omit<CanvasColors, 'toolpaths'>;
  cached = { ...colors, toolpaths: TOOLPATH_TOKENS.map(get) };
  return cached;
}

const SCHEME_QUERY = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(SCHEME_QUERY);
  const handler = () => {
    cached = null;
    onChange();
  };
  media?.addEventListener('change', handler);
  return () => media?.removeEventListener('change', handler);
}

/** Current theme colours for canvas drawing; updates when light/dark mode flips. */
export const useCanvasColors = (): CanvasColors => useSyncExternalStore(subscribe, read, read);
