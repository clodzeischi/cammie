import { overridesFor } from '../../core/materials/feedOverrides';
import { presetFeeds, type Feeds, type Material } from '../../core/materials/materials';
import type { Bit } from '../../core/tools/bits';
import { useMachineStore } from '../../state/machineStore';
import { useToolingStore } from '../../state/toolingStore';
import { NumberField } from '../common/fields';

interface FeedsFieldsProps {
  material: Material;
  bit: Bit;
  /** Stepover only matters for pockets. */
  showStepover: boolean;
}

const FIELDS: Array<{ key: keyof Feeds; label: string; unit: string }> = [
  { key: 'feed', label: 'Feed', unit: 'mm/min' },
  { key: 'plunge', label: 'Plunge', unit: 'mm/min' },
  { key: 'depthPerPass', label: 'Depth per pass', unit: 'mm' },
  { key: 'rpm', label: 'Spindle', unit: 'RPM' },
  { key: 'stepover', label: 'Stepover', unit: '% of bit' },
];

/**
 * Feeds & speeds for this material + bit. Changes are remembered and apply to
 * every cut with the same pair (SPEC.md §8).
 */
export function FeedsFields({ material, bit, showStepover }: FeedsFieldsProps) {
  const all = useToolingStore((s) => s.feedOverrides);
  const setFeeds = useToolingStore((s) => s.setFeeds);
  // A hand-switched spindle runs at its knob's speed, so there's no RPM to set.
  const manualSpindle = useMachineStore((s) => s.config.manualSpindle);
  const shown = FIELDS.filter(
    (f) => (showStepover || f.key !== 'stepover') && !(manualSpindle && f.key === 'rpm'),
  );
  const preset = presetFeeds(material, bit);
  const overrides = overridesFor(all, material.id, bit.id);
  const hasOverrides = Object.keys(overrides).length > 0;

  const change = (key: keyof Feeds, value: number) => {
    const next = { ...overrides };
    // Back to the preset value (or empty) means "not overridden".
    if (!Number.isFinite(value) || value === preset[key]) delete next[key];
    else next[key] = value;
    setFeeds(material.id, bit.id, next);
  };

  return (
    <details className="advanced">
      <summary>Feeds &amp; speeds {hasOverrides && <span className="badge">custom</span>}</summary>
      <p className="field-hint">
        Saved for {material.name} with the {bit.name}, and used by every cut with that pair.
      </p>
      <div className="field-row">
        {shown.map(({ key, label, unit }) => (
          <NumberField
            key={key}
            label={label}
            unit={unit}
            value={overrides[key] ?? preset[key]}
            hint={overrides[key] !== undefined ? `Preset: ${preset[key]}` : undefined}
            onChange={(v) => change(key, v)}
          />
        ))}
      </div>
      {hasOverrides && (
        <button
          type="button"
          className="link-button"
          onClick={() => setFeeds(material.id, bit.id, {})}
        >
          Reset to the {material.name} preset
        </button>
      )}
    </details>
  );
}
