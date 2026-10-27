import { useState } from 'react';
import type { FlipAxis } from '../../core/job/job';
import { DEFAULT_PIN_DIAMETER } from '../../core/job/registration';
import { useJobStore } from '../../state/jobStore';
import { addRegistrationHoles } from '../../state/twoSidedActions';
import { NumberField, SelectField } from '../common/fields';

const FLIPS: ReadonlyArray<{ value: FlipAxis; label: string }> = [
  { value: 'left-right', label: 'Left to right (turn it about the vertical line)' },
  { value: 'top-bottom', label: 'Top to bottom (turn it about the horizontal line)' },
];

/**
 * Pro: how the stock is turned over for bottom cuts, and the dowel-pin holes
 * that put it back in the same place.
 */
export function TwoSidedFields() {
  const flip = useJobStore((s) => s.flip);
  const setFlip = useJobStore((s) => s.setFlip);
  const hasPins = useJobStore((s) => s.objects.some((o) => o.role === 'registration'));
  const [diameter, setDiameter] = useState(DEFAULT_PIN_DIAMETER);
  const valid = Number.isFinite(diameter) && diameter > 0;

  return (
    <fieldset>
      <legend>Two-sided</legend>
      <p className="muted small">
        To cut the back of the stock, set a toolpath's side to Bottom. Cammie mirrors it so it lands
        in the right place once the stock is turned over.
      </p>
      <SelectField label="Turn the stock over" value={flip} options={FLIPS} onChange={setFlip} />
      <NumberField
        label="Dowel pin diameter"
        unit="mm"
        min={0}
        value={diameter}
        error={valid ? undefined : 'Diameter must be greater than 0.'}
        onChange={setDiameter}
      />
      <button
        type="button"
        className="button"
        disabled={!valid}
        onClick={() => addRegistrationHoles(diameter)}
      >
        {hasPins ? 'Put registration holes back' : 'Add registration holes'}
      </button>
      <p className="field-hint">
        Two holes on the flip line, cut through into the spoilboard first. Put dowel pins in them,
        turn the stock over onto the pins, then run the bottom files.
      </p>
    </fieldset>
  );
}
