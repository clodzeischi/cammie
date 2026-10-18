import { readFileSync } from 'node:fs';
import { parse } from 'opentype.js';
import { FONTS } from '../../core/text/fonts';
import { useJobStore } from '../../state/jobStore';
import { hasFontFile } from './fontLoader';
import { applyText, newTextObject } from './textEditing';

const fontFile = (id: string) => {
  const file = readFileSync(`node_modules/@fontsource/${id}/files/${id}-latin-400-normal.woff`);
  return parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
};

// Fonts come from disk instead of the network; each load can be held back.
const pending = new Map<string, () => void>();
vi.mock('./fontLoader', async (original) => ({
  ...(await original<typeof import('./fontLoader')>()),
  loadFont: (id: string) =>
    new Promise((resolve) => {
      if (id === 'slow') pending.set(id, () => resolve(fontFile('roboto')));
      else resolve(fontFile(id));
    }),
}));

describe('text editing', () => {
  it('has a font file for every font in the picker', () => {
    expect(FONTS.filter((f) => !hasFontFile(f.id))).toEqual([]);
  });

  it('applies new text, and ignores a slow result that newer typing replaced', async () => {
    const stock = useJobStore.getState().stock;
    const object = await newTextObject(stock);
    useJobStore.getState().addObject(object);
    const { shape } = object;
    if (shape?.type !== 'text') throw new Error('expected a text object');

    const slow = applyText(object.id, { ...shape, text: 'old', fontId: 'slow' });
    const fast = await applyText(object.id, { ...shape, text: 'Newer text' });
    pending.get('slow')!();
    expect(fast).toEqual({ status: 'ok', missing: [] });
    expect(await slow).toEqual({ status: 'stale' });
    expect(useJobStore.getState().objects[0]!.name).toBe('Newer text');

    expect(await applyText(object.id, { ...shape, text: '   ' })).toEqual({ status: 'empty' });
    expect(useJobStore.getState().objects[0]!.name).toBe('Newer text');
  });
});
