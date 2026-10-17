/** Coordinates: 3 decimals, never "-0.000". */
export function formatCoord(value: number): string {
  const text = value.toFixed(3);
  return text === '-0.000' ? '0.000' : text;
}

/** Feeds and spindle values are whole numbers. */
export const formatInt = (value: number): string => String(Math.round(value));

/**
 * GRBL comments: parentheses, no nesting, printable ASCII only. Anything else
 * (accents, emoji, stray parens from a file name) is replaced.
 */
export function comment(text: string): string {
  const safe = text
    .replace(/°/g, ' deg')
    .replace(/×/g, 'x')
    .normalize('NFKD')
    .replace(/[()]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .trim();
  return `(${safe})`;
}

/** Splits user-written G-code into lines, dropping blank ones. */
export const userLines = (block: string): string[] =>
  block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
