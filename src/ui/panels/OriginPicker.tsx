import type { OriginAnchor } from '../../core/job/job';
import { ORIGIN_ANCHORS } from '../../persistence/jobPrefsRepository';

interface OriginPickerProps {
  value: OriginAnchor;
  onChange: (origin: OriginAnchor) => void;
}

const label = (anchor: OriginAnchor) => (anchor === 'center' ? 'center' : anchor.replace('-', ' '));

/** 3 × 3 grid of points on the stock; the chosen one is machine X0 Y0. */
export function OriginPicker({ value, onChange }: OriginPickerProps) {
  return (
    <div className="field">
      <span className="field-label" id="origin-label">
        Work origin (X0 Y0)
      </span>
      <div className="origin-picker" role="radiogroup" aria-labelledby="origin-label">
        {ORIGIN_ANCHORS.map((anchor) => (
          <button
            key={anchor}
            type="button"
            role="radio"
            aria-checked={anchor === value}
            aria-label={label(anchor)}
            title={label(anchor)}
            className={anchor === value ? 'origin-dot origin-dot-active' : 'origin-dot'}
            onClick={() => onChange(anchor)}
          />
        ))}
      </div>
      <span className="field-hint">Put the bit here and zero all axes before running.</span>
    </div>
  );
}
