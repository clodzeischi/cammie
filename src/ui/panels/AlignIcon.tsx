import type { Alignment } from '../../core/job/arrange';

/**
 * 16 px icons for the align buttons: a guide line and two bars lined up on it.
 * Bars are [x, y, width, height] for left/top alignment; the rest are mirrored or centred.
 */
const HORIZONTAL_BARS = [
  [0, 3, 10, 4],
  [0, 9, 6, 4],
] as const;

function bars(alignment: Alignment) {
  const vertical = alignment === 'top' || alignment === 'middle' || alignment === 'bottom';
  return HORIZONTAL_BARS.map(([, y, w, h]) => {
    const start = {
      left: 2,
      top: 2,
      center: 8 - w / 2,
      middle: 8 - w / 2,
      right: 14 - w,
      bottom: 14 - w,
    }[alignment];
    return vertical ? { x: y, y: start, w: h, h: w } : { x: start, y, w, h };
  });
}

const GUIDES: Record<Alignment, [number, number, number, number]> = {
  left: [1.5, 1, 1.5, 15],
  center: [8, 1, 8, 15],
  right: [14.5, 1, 14.5, 15],
  top: [1, 1.5, 15, 1.5],
  middle: [1, 8, 15, 8],
  bottom: [1, 14.5, 15, 14.5],
};

export function AlignIcon({ alignment }: { alignment: Alignment }) {
  const [x1, y1, x2, y2] = GUIDES[alignment];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {bars(alignment).map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx="1"
          fill="currentColor"
          opacity="0.55"
        />
      ))}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
