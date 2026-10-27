import type { ReactNode } from 'react';

/** Soft fill for the "material" part of an icon; reads in both themes. */
const F = { fill: 'currentColor', fillOpacity: 0.18 } as const;

/**
 * Cammie's icon set: 24 × 24 grid, 1.6 px rounded strokes, drawn in
 * `currentColor` so they follow the text colour and theme.
 */
const ICONS = {
  import: (
    <>
      <path d="M12 4v10" />
      <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  text: (
    <>
      <path d="M5 7V5h14v2" />
      <path d="M12 5v14" />
      <path d="M9 19h6" />
    </>
  ),
  rect: <rect x="4" y="6" width="16" height="12" rx="1.5" />,
  ellipse: <ellipse cx="12" cy="12" rx="8.5" ry="6.5" />,
  group: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" strokeDasharray="2 2.5" />
      <rect x="7" y="7" width="6" height="6" rx="1" />
      <circle cx="14.5" cy="14.5" r="3" />
    </>
  ),
  ungroup: (
    <>
      <rect x="3.5" y="3.5" width="8" height="8" rx="1" />
      <circle cx="16" cy="16" r="4" />
    </>
  ),
  duplicate: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4.5h6V7" />
      <path d="M6.5 7l1 13h9l1-13" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  ),
  redo: (
    <>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </>
  ),
  engrave: (
    <>
      <path d="M4 17c3-8 6-10 8-5s5 3 8-5" strokeWidth={4.5} strokeOpacity={0.2} />
      <path d="M4 17c3-8 6-10 8-5s5 3 8-5" />
    </>
  ),
  profile: (
    <>
      <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" {...F} />
      <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" />
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" strokeDasharray="2.2 2.4" />
    </>
  ),
  profileIn: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" {...F} />
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <rect x="8" y="8" width="8" height="8" rx="1" strokeDasharray="2.2 2.4" />
    </>
  ),
  pocket: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M7.5 7.5h9v3h-9v3h9v3h-9" />
    </>
  ),
  preview: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m10 8.5 5.5 3.5-5.5 3.5z" {...F} />
      <path d="m10 8.5 5.5 3.5-5.5 3.5z" />
    </>
  ),
  stock: (
    <>
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" {...F} />
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" />
      <path d="M4 8.5 12 13l8-4.5M12 13v7" />
    </>
  ),
  material: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10c4 0 5-2 9-2s5 2 9 2" />
      <path d="M3 15c3 0 5-2.5 9-2.5s6 2.5 9 2.5" />
    </>
  ),
  bits: (
    <>
      <path d="M5 3h3v17H5z" />
      <path d="M10.5 3h3v10l-1.5 6-1.5-6z" />
      <path d="M16 3h3v13a1.5 1.5 0 0 1-3 0z" />
    </>
  ),
  machine: (
    <>
      <path d="M3 20h18" />
      <path d="M5 20V5h14v15" />
      <path d="M5 8h14" />
      <rect x="10" y="8" width="4" height="5" rx="1" />
      <path d="M12 13v3" />
    </>
  ),
  export: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M12 10v7" />
      <path d="m9 14 3 3 3-3" />
    </>
  ),
  bitChange: (
    <>
      <path d="M4.6 10a7.8 7.8 0 0 1 13.6-3.6" />
      <path d="M18.6 2.8v3.8h-3.8" />
      <path d="M19.4 14a7.8 7.8 0 0 1-13.6 3.6" />
      <path d="M5.4 21.2v-3.8h3.8" />
      <path d="M10.5 8.5h3v4L12 15.5l-1.5-3z" />
    </>
  ),
  flatBit: (
    <>
      <rect x="9" y="2.5" width="6" height="9" rx="1" />
      <path d="M9.5 11.5h5V21h-5z" {...F} />
      <path d="M9.5 11.5h5V21h-5z" />
      <path d="m9.5 14 5 2.2M9.5 17.6l5 2.2" />
    </>
  ),
  vBit: (
    <>
      <rect x="9" y="2.5" width="6" height="10" rx="1" />
      <path d="M9 12.5h6L12 21z" {...F} />
      <path d="M9 12.5h6L12 21z" />
    </>
  ),
  chevronUp: <path d="m6 15 6-6 6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  warning: (
    <>
      <path d="M12 4 2.8 19.5h18.4z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}
