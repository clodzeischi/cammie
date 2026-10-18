import { unitKey, type Alignment } from '../../core/job/arrange';
import { arrange, canGroup, canUngroup } from '../../state/arrangeActions';
import { selectedObjects, useJobStore } from '../../state/jobStore';
import { MOD_KEY } from '../common/platform';
import { AlignIcon } from './AlignIcon';

const ALIGNMENTS: ReadonlyArray<{ value: Alignment; label: string }> = [
  { value: 'left', label: 'Align left edges' },
  { value: 'center', label: 'Align centres (left–right)' },
  { value: 'right', label: 'Align right edges' },
  { value: 'top', label: 'Align top edges' },
  { value: 'middle', label: 'Align middles (top–bottom)' },
  { value: 'bottom', label: 'Align bottom edges' },
];

/** Align, centre, duplicate and group the current selection. */
export function ArrangeFields() {
  // Plain values so the selector result is stable between renders.
  const units = useJobStore((s) => new Set(selectedObjects(s).map(unitKey)).size);
  const groupable = useJobStore((s) => canGroup(s));
  const grouped = useJobStore((s) => canUngroup(s));
  const target = units > 1 ? 'each other' : 'the stock';

  return (
    <fieldset>
      <legend>Arrange</legend>
      <div className="align-buttons" role="group" aria-label={`Align to ${target}`}>
        {ALIGNMENTS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className="icon-button"
            title={`${label} (to ${target})`}
            aria-label={label}
            onClick={() => arrange.align(value)}
          >
            <AlignIcon alignment={value} />
          </button>
        ))}
      </div>
      <p className="field-hint">Aligns to {target}.</p>
      <div className="button-row">
        <button type="button" className="button button-small" onClick={arrange.centerOnStock}>
          Centre on stock
        </button>
        <button
          type="button"
          className="button button-small"
          title={`Duplicate (${MOD_KEY}D)`}
          onClick={arrange.duplicate}
        >
          Duplicate
        </button>
        {groupable && (
          <button
            type="button"
            className="button button-small"
            title={`Group (${MOD_KEY}G)`}
            onClick={arrange.group}
          >
            Group
          </button>
        )}
        {grouped && (
          <button
            type="button"
            className="button button-small"
            title={`Ungroup (${MOD_KEY}⇧G)`}
            onClick={arrange.ungroup}
          >
            Ungroup
          </button>
        )}
      </div>
    </fieldset>
  );
}
