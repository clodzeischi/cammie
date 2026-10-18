import type { DesignObject, Stock, TextShape } from '../job/job';
import { createObject } from '../job/objectFactory';
import { withGeometry } from '../shapes/shapeObjects';
import { DEFAULT_FONT_ID } from './fonts';
import type { TextLayout } from './textLayout';

export const DEFAULT_TEXT: TextShape = {
  type: 'text',
  text: 'Your text',
  fontId: DEFAULT_FONT_ID,
  capHeight: 20,
  letterSpacing: 0,
  lineSpacing: 1,
  align: 'center',
};

const NAME_LENGTH = 24;

/** Objects are named after their first line of text. */
export function textName(text: string): string {
  const firstLine = text.split('\n').find((l) => l.trim()) ?? '';
  const line = firstLine.trim();
  if (!line) return 'Text';
  return line.length > NAME_LENGTH ? `${line.slice(0, NAME_LENGTH - 1)}…` : line;
}

export function createTextObject(
  id: string,
  shape: TextShape,
  layout: TextLayout,
  stock: Stock,
): DesignObject {
  return createObject({
    id,
    name: textName(shape.text),
    kind: 'text',
    shape,
    paths: layout.paths,
    stock,
  });
}

/** Where text stays put when it changes width: its aligned edge (or centre). */
const ANCHOR_X = { left: 0, center: 0.5, right: 1 } as const;

/**
 * New text settings on an existing text object. The object keeps its place,
 * rotation and scale; the side the text is aligned to stays still, so typing
 * into centred text grows it both ways. A name the user gave is kept.
 */
export function withText(object: DesignObject, shape: TextShape, layout: TextLayout): DesignObject {
  const autoName = object.shape?.type === 'text' && object.name === textName(object.shape.text);
  const rebuilt = withGeometry(object, layout.paths, { x: ANCHOR_X[shape.align], y: 0 });
  return { ...rebuilt, shape, name: autoName ? textName(shape.text) : object.name };
}
