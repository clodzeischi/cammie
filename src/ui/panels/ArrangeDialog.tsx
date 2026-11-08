import { useState } from 'react';
import { useJobStore } from '../../state/jobStore';
import {
  arrangeOnStock,
  defaultSpacing,
  nestTargets,
  useArrangePrefs,
} from '../../state/nestActions';
import { useToolingStore } from '../../state/toolingStore';
import { NumberField } from '../common/fields';
import { Modal } from '../common/Modal';

/** Packs shapes onto the stock (Arrange on stock, in the cut plan), with its options. */
export function ArrangeDialog({ onClose }: { onClose: () => void }) {
  const toolpaths = useJobStore((s) => s.toolpaths);
  const bits = useToolingStore((s) => s.bits);
  const count = useJobStore((s) => nestTargets(s).length);
  const selection = useJobStore((s) => s.selectedIds.length > 0);
  const keepRotation = useArrangePrefs((s) => s.keepRotation);
  const setKeepRotation = useArrangePrefs((s) => s.setKeepRotation);
  const [spacing, setSpacing] = useState(() => defaultSpacing(toolpaths, bits));
  const [leftOut, setLeftOut] = useState<number | null>(null);
  const valid = Number.isFinite(spacing) && spacing >= 0;

  const run = () => {
    const result = arrangeOnStock({ spacing, keepRotation });
    if (result.leftOut === 0) onClose();
    else setLeftOut(result.leftOut);
  };

  const what = selection
    ? `the ${count === 1 ? 'selected shape' : `${count} selected shapes`}`
    : count === 1
      ? 'the shape'
      : `all ${count} shapes`;
  return (
    <Modal
      title="Arrange on stock"
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="button" onClick={onClose}>
            {leftOut === null ? 'Cancel' : 'Close'}
          </button>
          <button type="button" className="button button-primary" disabled={!valid} onClick={run}>
            Arrange
          </button>
        </>
      }
    >
      <p>
        Packs {what} into the top-left corner of the stock, leaving the rest as one free area.
        Grouped shapes, and shapes lying inside another (like text on a plaque), move together.
        Anything else on the stock stays put.
      </p>
      <NumberField
        label="Spacing"
        unit="mm"
        min={0}
        value={spacing}
        error={valid ? undefined : 'Enter 0 or more.'}
        hint="Gap between parts and from the stock's edges. Starts at your widest cut plus 2 mm."
        onChange={setSpacing}
      />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={keepRotation}
          onChange={(e) => setKeepRotation(e.target.checked)}
        />
        Keep each shape's rotation (don't turn them to fit)
      </label>
      {leftOut !== null && (
        <p className="field-error" role="alert">
          {leftOut === 1 ? "1 part didn't fit" : `${leftOut} parts didn't fit`} and stayed where{' '}
          {leftOut === 1 ? 'it was' : 'they were'}. Try a smaller spacing, a bigger stock, or
          allowing rotation.
        </p>
      )}
    </Modal>
  );
}
