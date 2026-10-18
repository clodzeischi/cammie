import type { Feeds, Material } from '../../core/materials/materials';
import { NumberField } from '../common/fields';

interface FeedsFieldsProps {
  preset: Feeds;
  overrides: Partial<Feeds>;
  material: Material | undefined;
  onChange: (overrides: Partial<Feeds>) => void;
}

const FIELDS: Array<{ key: keyof Feeds; label: string; unit: string }> = [
  { key: 'feed', label: 'Feed', unit: 'mm/min' },
  { key: 'plunge', label: 'Plunge', unit: 'mm/min' },
  { key: 'depthPerPass', label: 'Depth per pass', unit: 'mm' },
  { key: 'rpm', label: 'Spindle', unit: 'RPM' },
];

/** Collapsible feeds & speeds: material preset values, any of which can be overridden. */
export function FeedsFields({ preset, overrides, material, onChange }: FeedsFieldsProps) {
  const hasOverrides = Object.keys(overrides).length > 0;
  return (
    <details className="advanced">
      <summary>Feeds &amp; speeds {hasOverrides && <span className="badge">custom</span>}</summary>
      <div className="field-row">
        {FIELDS.map(({ key, label, unit }) => (
          <NumberField
            key={key}
            label={label}
            unit={unit}
            value={overrides[key] ?? preset[key]}
            hint={overrides[key] !== undefined ? `Preset: ${preset[key]}` : undefined}
            onChange={(v) => onChange({ ...overrides, [key]: v })}
          />
        ))}
      </div>
      {hasOverrides && (
        <button type="button" className="link-button" onClick={() => onChange({})}>
          Reset to {material?.name ?? 'material'} preset
        </button>
      )}
    </details>
  );
}
