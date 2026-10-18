import { unionNonZero } from '../clipper/clipper';
import { flattenCubic, quadToCubic } from '../geometry/bezier';
import type { Path, Vec2 } from '../geometry/path';
import type { TextShape } from '../job/job';

/** The parts of an opentype.js font that layout needs (kept small for testing). */
export interface FontLike {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  tables: { os2?: { sCapHeight?: number }; hhea?: { lineGap?: number } };
  charToGlyph(char: string): GlyphLike;
  getKerningValue(leftIndex: number, rightIndex: number): number;
}

export interface GlyphLike {
  index: number;
  advanceWidth?: number;
  getPath(x: number, y: number, fontSize: number): { commands: PathCommand[] };
  getBoundingBox(): { y2: number };
}

export type PathCommand =
  | { type: 'M' | 'L'; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'Z' };

export interface TextLayout {
  /** Closed outlines in mm, Y down, first baseline at y = 0. */
  paths: Path[];
  /** Characters the font has no letter for (they are left out). */
  missing: string[];
}

/** Max distance (mm) between a letter's true curve and the segments drawn for it. */
const CURVE_TOLERANCE = 0.005;

/** Height of a capital letter in font units. */
function capHeightUnits(font: FontLike): number {
  const fromTable = font.tables.os2?.sCapHeight;
  if (fromTable) return fromTable;
  const h = font.charToGlyph('H');
  return h.index > 0 ? h.getBoundingBox().y2 : font.unitsPerEm * 0.7;
}

/**
 * Lays text out line by line and turns the letters into outlines (SPEC.md
 * §6.1). Overlapping letters (joined script, tight spacing) are merged, so a
 * pocket or V-carve doesn't cut the overlap twice.
 */
export function layoutText(font: FontLike, shape: TextShape): TextLayout {
  const fontSize = (shape.capHeight * font.unitsPerEm) / capHeightUnits(font);
  const scale = fontSize / font.unitsPerEm;
  const lineGap = font.tables.hhea?.lineGap ?? 0;
  const lineHeight = (font.ascender - font.descender + lineGap) * scale * shape.lineSpacing;

  const missing = new Set<string>();
  for (const char of shape.text) {
    if (char.trim() && font.charToGlyph(char).index === 0) missing.add(char);
  }

  const lines = shape.text.split('\n').map((line) => placeGlyphs(font, line, scale, shape));
  const widest = Math.max(0, ...lines.map((l) => l.width));
  const shift = { left: 0, center: 0.5, right: 1 }[shape.align];

  const outlines: Path[] = [];
  lines.forEach((line, row) => {
    const dx = (widest - line.width) * shift;
    for (const { glyph, x } of line.glyphs) {
      if (glyph.index === 0) continue;
      outlines.push(...commandsToPaths(glyph.getPath(x + dx, row * lineHeight, fontSize).commands));
    }
  });
  return { paths: unionNonZero(outlines), missing: [...missing] };
}

interface PlacedLine {
  glyphs: Array<{ glyph: GlyphLike; x: number }>;
  width: number;
}

function placeGlyphs(font: FontLike, line: string, scale: number, shape: TextShape): PlacedLine {
  // One glyph per character. opentype.js's own shaping (ligatures, contextual
  // forms) throws on some fonts' substitution tables, so it isn't used.
  const glyphs = Array.from(line, (char) => font.charToGlyph(char));
  const placed: PlacedLine['glyphs'] = [];
  let x = 0;
  glyphs.forEach((glyph, i) => {
    placed.push({ glyph, x });
    x += (glyph.advanceWidth ?? 0) * scale;
    const next = glyphs[i + 1];
    if (next) x += font.getKerningValue(glyph.index, next.index) * scale + shape.letterSpacing;
  });
  return { glyphs: placed, width: x };
}

/** Flattens a glyph's outline commands into closed polylines. */
export function commandsToPaths(commands: readonly PathCommand[]): Path[] {
  const paths: Path[] = [];
  let points: Vec2[] = [];
  const close = () => {
    if (points.length >= 3) paths.push({ closed: true, points });
    points = [];
  };
  for (const cmd of commands) {
    const last = points[points.length - 1];
    if (cmd.type === 'M') {
      close();
      points.push({ x: cmd.x, y: cmd.y });
    } else if (cmd.type === 'L') {
      points.push({ x: cmd.x, y: cmd.y });
    } else if (cmd.type === 'C' && last) {
      const to = { x: cmd.x, y: cmd.y };
      points.push(
        ...flattenCubic(
          last,
          { x: cmd.x1, y: cmd.y1 },
          { x: cmd.x2, y: cmd.y2 },
          to,
          CURVE_TOLERANCE,
        ),
      );
    } else if (cmd.type === 'Q' && last) {
      const to = { x: cmd.x, y: cmd.y };
      const [c1, c2] = quadToCubic(last, { x: cmd.x1, y: cmd.y1 }, to);
      points.push(...flattenCubic(last, c1, c2, to, CURVE_TOLERANCE));
    } else if (cmd.type === 'Z') {
      close();
    }
  }
  close();
  return paths;
}
