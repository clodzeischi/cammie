import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DesignObject } from '../../core/job/job';
import type { GrayBitmap } from '../../core/trace/grayBitmap';
import { TraceDialog } from './TraceDialog';
import { createInlineTracer } from './tracer';

/** 20 × 10 white image with a black 10 × 6 block. */
function blockImage(): GrayBitmap {
  const width = 20;
  const height = 10;
  const data = new Uint8ClampedArray(width * height).fill(255);
  for (let y = 2; y < 8; y++) for (let x = 5; x < 15; x++) data[y * width + x] = 0;
  return { width, height, data };
}

describe('TraceDialog', () => {
  beforeAll(() => {
    // jsdom has no canvas; the preview just skips drawing.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('traces the image and adds the artwork, scaled and centred', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(o: DesignObject) => void>();
    render(
      <TraceDialog
        image={{ name: 'block', bitmap: blockImage(), previewUrl: 'blob:test' }}
        stock={{ width: 200, height: 100, thickness: 6 }}
        createTracer={createInlineTracer}
        onAdd={onAdd}
        onClose={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText('1 outline')).toBeInTheDocument());

    const width = screen.getByLabelText('Artwork width');
    await user.clear(width);
    await user.type(width, '40');
    // The artwork is the 10 × 6 px block, not the 20 × 10 px image.
    expect(screen.getByText(/^Height 2[34](\.\d)? mm$/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add to design' }));
    const object = onAdd.mock.calls[0]![0];
    expect(object.name).toBe('block');
    expect(object.width).toBe(40);
    expect(object.height).toBeCloseTo(24, 0);
    expect(object.transform.x).toBe(80);
    expect(object.transform.y).toBeCloseTo((100 - object.height) / 2);
    expect(object.operation?.bitId).toBe('vbit-60');
  });

  it('blocks adding with an invalid width', async () => {
    const user = userEvent.setup();
    render(
      <TraceDialog
        image={{ name: 'block', bitmap: blockImage(), previewUrl: 'blob:test' }}
        stock={{ width: 200, height: 100, thickness: 6 }}
        createTracer={createInlineTracer}
        onAdd={() => {}}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByText('1 outline')).toBeInTheDocument());
    await user.clear(screen.getByLabelText('Artwork width'));
    expect(screen.getByRole('button', { name: 'Add to design' })).toBeDisabled();
  });
});
