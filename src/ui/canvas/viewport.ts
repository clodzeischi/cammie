import { useState } from 'react';
import type { Stock } from '../../core/job/job';
import type { Size } from './useElementSize';

/** Screen = world (mm) × scale + offset. */
export interface Viewport {
  scale: number;
  x: number;
  y: number;
}

const MARGIN_PX = 48;
const MIN_SCALE = 0.2;
const MAX_SCALE = 200;

/** Centres the stock in the view with a margin. */
export function fitViewport(stock: Stock, size: Size): Viewport {
  const scale = Math.max(
    MIN_SCALE,
    Math.min(
      (size.width - MARGIN_PX * 2) / stock.width,
      (size.height - MARGIN_PX * 2) / stock.height,
    ),
  );
  return {
    scale,
    x: (size.width - stock.width * scale) / 2,
    y: (size.height - stock.height * scale) / 2,
  };
}

/** Zooms by `factor`, keeping the world point under `screen` in place. */
export function zoomAt(view: Viewport, screen: { x: number; y: number }, factor: number): Viewport {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
  const worldX = (screen.x - view.x) / view.scale;
  const worldY = (screen.y - view.y) / view.scale;
  return { scale, x: screen.x - worldX * scale, y: screen.y - worldY * scale };
}

/**
 * The view fits the stock until the user pans or zooms. Changing the stock
 * size or resizing the window snaps back to fit.
 */
export function useViewport(stock: Stock, size: Size) {
  const key = `${stock.width}x${stock.height}@${size.width}x${size.height}`;
  const [custom, setCustom] = useState<{ key: string; view: Viewport } | null>(null);

  const view = custom && custom.key === key ? custom.view : fitViewport(stock, size);
  return {
    view,
    setView: (next: Viewport) => setCustom({ key, view: next }),
    fit: () => setCustom(null),
  };
}
