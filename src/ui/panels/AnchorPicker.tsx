import { useId } from 'react';
import type { OriginAnchor } from '../../core/job/job';
import { ORIGIN_ANCHORS } from '../../persistence/jobPrefsRepository';

interface AnchorPickerProps {
  label: string;
  hint?: string;
  value: OriginAnchor;
  onChange: (anchor: OriginAnchor) => void;
}

const anchorName = (anchor: OriginAnchor) =>
  anchor === 'center' ? 'center' : anchor.replace('-', ' ');

/** 3 × 3 grid of points on a box (the stock, or a shape); one is picked. */
export function AnchorPicker({ label, hint, value, onChange }: AnchorPickerProps) {
  const labelId = useId();
  return (
    <div className="field">
      <span className="field-label" id={labelId}>
        {label}
      </span>
      <div className="origin-picker" role="radiogroup" aria-labelledby={labelId}>
        {ORIGIN_ANCHORS.map((anchor) => (
          <button
            key={anchor}
            type="button"
            role="radio"
            aria-checked={anchor === value}
            aria-label={anchorName(anchor)}
            title={anchorName(anchor)}
            className={anchor === value ? 'origin-dot origin-dot-active' : 'origin-dot'}
            onClick={() => onChange(anchor)}
          />
        ))}
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

interface OriginPickerProps {
  value: OriginAnchor;
  onChange: (origin: OriginAnchor) => void;
}

/** The stock's work origin: the chosen point is machine X0 Y0. */
export const OriginPicker = (props: OriginPickerProps) => (
  <AnchorPicker
    label="Work origin (X0 Y0)"
    hint="Put the bit here and zero all axes before running."
    {...props}
  />
);
