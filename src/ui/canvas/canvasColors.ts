import { useSyncExternalStore } from 'react';
import type { CutKind } from '../../core/job/objectFactory';

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
  /** Behind the stock (the 3D view's backdrop). */
  background: string;
  /** Pieces that come loose, in the 3D view. */
  warning: string;
  /** One colour per exported file / bit. */
  toolpaths: string[];
  /** One colour per kind of cut, as in the toolpath list (see cutKinds). */
  cuts: Record<CutKind, string>;
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
  background: '--canvas-bg',
  warning: '--warning',
} as const;

const TOOLPATH_TOKENS = ['--canvas-toolpath-1', '--canvas-toolpath-2', '--canvas-toolpath-3'];

const CUT_TOKENS: Record<CutKind, string> = {
  on: '--cut-on',
  outside: '--cut-outside',
  inside: '--cut-inside',
  pocket: '--cut-pocket',
  vcarve: '--cut-vcarve',
  chamfer: '--cut-chamfer',
  drill: '--cut-drill',
};

let cached: CanvasColors | null = null;

function read(): CanvasColors {
  if (cached) return cached;
  const style = getComputedStyle(document.documentElement);
  const get = (name: string) => style.getPropertyValue(name).trim() || '#888';
  const colors = Object.fromEntries(
    Object.entries(TOKENS).map(([key, token]) => [key, get(token)]),
  ) as Omit<CanvasColors, 'toolpaths' | 'cuts'>;
  const cuts = Object.fromEntries(
    Object.entries(CUT_TOKENS).map(([kind, token]) => [kind, get(token)]),
  ) as Record<CutKind, string>;
  cached = { ...colors, toolpaths: TOOLPATH_TOKENS.map(get), cuts };
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
