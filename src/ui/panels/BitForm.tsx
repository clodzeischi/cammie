import { useState } from 'react';
import type { Bit } from '../../core/tools/bits';
import { NumberField, SelectField } from '../common/fields';

interface BitFormProps {
  initial: Bit;
  onSave: (bit: Bit) => void;
  onCancel: () => void;
}

const TYPE_OPTIONS = [
  { value: 'flat', label: 'End mill (flat)' },
  { value: 'vbit', label: 'V-bit' },
  { value: 'round', label: 'Round-nose (ball end)' },
] as const;

function problems(bit: Bit): string[] {
  const out: string[] = [];
  if (!bit.name.trim()) out.push('Give the bit a name.');
  if (!(bit.diameter > 0)) out.push('Diameter must be greater than 0.');
  if (!(bit.flutes >= 1)) out.push('Flutes must be at least 1.');
  if (bit.type === 'vbit') {
    if (!(bit.angle > 0 && bit.angle < 180)) out.push('Angle must be between 0 and 180°.');
    if (!(bit.tipDiameter >= 0 && bit.tipDiameter < bit.diameter)) {
      out.push('Tip must be smaller than the diameter.');
    }
  }
  return out;
}

export function BitForm({ initial, onSave, onCancel }: BitFormProps) {
  const [bit, setBit] = useState<Bit>(initial);
  const errors = problems(bit);

  const setType = (type: Bit['type']) => {
    const base = { id: bit.id, name: bit.name, diameter: bit.diameter, flutes: bit.flutes };
    setBit(type === 'vbit' ? { ...base, type, angle: 60, tipDiameter: 0.2 } : { ...base, type });
  };

  return (
    <div className="settings-form">
      <div className="field">
        <label htmlFor="bit-name">Name</label>
        <input
          id="bit-name"
          value={bit.name}
          placeholder="e.g. Amana 1/4 in downcut"
          onChange={(e) => setBit({ ...bit, name: e.target.value })}
        />
      </div>
      <SelectField label="Type" value={bit.type} options={TYPE_OPTIONS} onChange={setType} />
      <div className="field-row">
        <NumberField
          label="Diameter"
          unit="mm"
          value={bit.diameter}
          onChange={(diameter) => setBit({ ...bit, diameter })}
        />
        <NumberField
          label="Flutes"
          value={bit.flutes}
          step={1}
          onChange={(flutes) => setBit({ ...bit, flutes })}
        />
      </div>
      {bit.type === 'vbit' && (
        <div className="field-row">
          <NumberField
            label="Angle"
            unit="°"
            value={bit.angle}
            onChange={(angle) => setBit({ ...bit, angle })}
          />
          <NumberField
            label="Tip"
            unit="mm"
            value={bit.tipDiameter}
            onChange={(tipDiameter) => setBit({ ...bit, tipDiameter })}
          />
        </div>
      )}
      {errors.length > 0 && <p className="field-error">{errors[0]}</p>}
      <div className="form-actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={errors.length > 0}
          onClick={() => onSave({ ...bit, name: bit.name.trim() })}
        >
          Save bit
        </button>
      </div>
    </div>
  );
}
