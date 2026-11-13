import { unitKey, type Alignment } from '../../core/job/arrange';
import { useDialogStore } from '../../state/dialogStore';
import { arrange } from '../../state/arrangeActions';
import { selectedObjects, useJobStore } from '../../state/jobStore';
import { AlignIcon } from './AlignIcon';
import { IconAction } from './PanelHeader';

const ALIGNMENTS: ReadonlyArray<{ value: Alignment; label: string }> = [
  { value: 'left', label: 'Align left edges' },
  { value: 'center', label: 'Align centres (left–right)' },
  { value: 'right', label: 'Align right edges' },
  { value: 'top', label: 'Align top edges' },
  { value: 'middle', label: 'Align middles (top–bottom)' },
  { value: 'bottom', label: 'Align bottom edges' },
];

/** Align the selection, centre it on the stock, or pack it onto the stock: one row of icons. */
export function ArrangeFields() {
  // A plain number so the selector result is stable between renders.
  const units = useJobStore((s) => new Set(selectedObjects(s).map(unitKey)).size);
  const target = units > 1 ? 'each other' : 'the stock';

  return (
    <fieldset>
      <legend>Arrange</legend>
      <div className="align-buttons" role="group" aria-label="Arrange">
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
        <span className="toolbar-divider" />
        <IconAction icon="centre" label="Centre on stock" onClick={arrange.centerOnStock} />
        <IconAction
          icon="nest"
          label="Arrange on stock…"
          onClick={() => useDialogStore.getState().show('arrange')}
        />
      </div>
    </fieldset>
  );
}
