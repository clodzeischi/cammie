import type { CutDirection, EntryStyle, Operation } from '../../core/job/job';
import { NumberField, SelectField } from '../common/fields';

interface AdvancedCutFieldsProps {
  operation: Operation;
  onChange: (operation: Operation) => void;
}

/** The settings every cut type shares. */
type SharedPatch = Partial<Pick<Operation, 'direction' | 'entry' | 'finishing'>>;

const DIRECTIONS: ReadonlyArray<{ value: CutDirection; label: string }> = [
  { value: 'climb', label: 'Climb (cleaner edge, usual on a 3018)' },
  { value: 'conventional', label: 'Conventional' },
];

const ENTRIES: ReadonlyArray<{ value: EntryStyle; label: string }> = [
  { value: 'ramp', label: 'Ramp in at 3° (easier on the bit)' },
  { value: 'plunge', label: 'Plunge straight down' },
];

/** Cut direction, how the bit enters, and the optional finishing pass. */
export function AdvancedCutFields({ operation, onChange }: AdvancedCutFieldsProps) {
  const onLine = operation.type === 'profile' && operation.side === 'on';
  const { finishing } = operation;
  const set = (patch: SharedPatch) => onChange({ ...operation, ...patch });

  return (
    <details className="advanced">
      <summary>Advanced</summary>
      {!onLine && (
        <SelectField
          label="Cut direction"
          value={operation.direction}
          options={DIRECTIONS}
          onChange={(direction) => set({ direction })}
        />
      )}
      <SelectField
        label="Entry"
        value={operation.entry}
        options={ENTRIES}
        onChange={(entry) => set({ entry })}
      />
      {!onLine && (
        <>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={finishing.enabled}
              onChange={(e) => set({ finishing: { ...finishing, enabled: e.target.checked } })}
            />
            Finishing pass (cleaner walls)
          </label>
          {finishing.enabled && (
            <NumberField
              label="Leave for finishing"
              unit="mm"
              min={0}
              value={finishing.allowance}
              hint="Roughing stays this far from the wall; one light pass takes it off."
              onChange={(allowance) =>
                Number.isFinite(allowance) &&
                allowance >= 0 &&
                set({ finishing: { ...finishing, allowance } })
              }
            />
          )}
        </>
      )}
    </details>
  );
}
