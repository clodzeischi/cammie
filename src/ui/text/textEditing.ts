import type { DesignObject, Stock, TextShape } from '../../core/job/job';
import { layoutText } from '../../core/text/textLayout';
import { createTextObject, DEFAULT_TEXT, withText } from '../../core/text/textObject';
import { useJobStore } from '../../state/jobStore';
import { loadFont } from './fontLoader';

export type TextResult =
  | { status: 'ok'; missing: string[] }
  | { status: 'empty' }
  | { status: 'stale' }
  | { status: 'failed'; message: string };

/** Latest request per object, so a slow font load can't overwrite newer typing. */
const latest = new Map<string, number>();
let counter = 0;

/**
 * Re-lays-out a text object with new settings once its font has loaded, and
 * applies the result to the object as it is by then (it may have moved).
 * Text with no visible letters is not applied.
 */
export async function applyText(id: string, shape: TextShape): Promise<TextResult> {
  const request = ++counter;
  latest.set(id, request);
  try {
    const layout = layoutText(await loadFont(shape.fontId), shape);
    if (latest.get(id) !== request) return { status: 'stale' };
    if (layout.paths.length === 0) return { status: 'empty' };
    const { objects, updateObject } = useJobStore.getState();
    const object = objects.find((o) => o.id === id);
    if (!object) return { status: 'stale' };
    const { shape: s, paths, width, height, transform, name } = withText(object, shape, layout);
    updateObject(id, { shape: s, paths, width, height, transform, name });
    return { status: 'ok', missing: layout.missing };
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

/** A new text object in the default font, centred on the stock. */
export async function newTextObject(stock: Stock): Promise<DesignObject> {
  const layout = layoutText(await loadFont(DEFAULT_TEXT.fontId), DEFAULT_TEXT);
  return createTextObject(crypto.randomUUID(), DEFAULT_TEXT, layout, stock);
}

/** The text box of an object that was just added grabs the keyboard once. */
let focusNext: string | null = null;
export const requestTextFocus = (id: string) => {
  focusNext = id;
};
export function takeTextFocus(id: string): boolean {
  if (focusNext !== id) return false;
  focusNext = null;
  return true;
}
