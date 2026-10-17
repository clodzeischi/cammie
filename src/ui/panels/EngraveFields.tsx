import type { EngraveOperation } from '../../core/job/job';
import { DEFAULT_ENGRAVE_DEPTH } from '../../core/job/tracedObject';
import { findMaterial, presetFeeds, type Feeds } from '../../core/materials/materials';
import {
  BUILT_IN_BITS,
  DEFAULT_VBIT_ID,
  findBit,
  grooveWidth,
  vbitMaxDepth,
} from '../../core/tools/bits';
import { useJobStore } from '../../state/jobStore';
import { NumberField, SelectField } from '../common/fields';

interface EngraveFieldsProps {
  operation: EngraveOperation | null;
  onChange: (operation: EngraveOperation | null) => void;
}

const VBIT_OPTIONS = BUILT_IN_BITS.filter((b) => b.type === 'vbit').map((b) => ({
  value: b.id,
  label: b.name,
}));

const FEED_FIELDS: Array<{ key: keyof Feeds; label: string; unit: string }> = [
  { key: 'feed', label: 'Feed', unit: 'mm/min' },
  { key: 'plunge', label: 'Plunge', unit: 'mm/min' },
  { key: 'depthPerPass', label: 'Depth per pass', unit: 'mm' },
  { key: 'rpm', label: 'Spindle', unit: 'RPM' },
];

const round2 = (v: number) => Math.round(v * 100) / 100;

/** V-bit outline engraving: on/off, bit, depth (with the resulting line width), feeds. */
export function EngraveFields({ operation, onChange }: EngraveFieldsProps) {
  const materialId = useJobStore((s) => s.materialId);

  if (!operation) {
    return (
      <fieldset>
        <legend>Cut</legend>
        <p className="muted small">Not cut: shown for reference only.</p>
        <button
          type="button"
          className="button"
          onClick={() =>
            onChange({
              type: 'engrave',
              bitId: DEFAULT_VBIT_ID,
              depth: DEFAULT_ENGRAVE_DEPTH,
              overrides: {},
            })
          }
        >
          Engrave outlines
        </button>
      </fieldset>
    );
  }

  const bit = findBit(operation.bitId);
  const material = findMaterial(materialId);
  const preset = bit && material ? presetFeeds(material, bit) : null;
  const set = (patch: Partial<EngraveOperation>) => onChange({ ...operation, ...patch });
  const setFeed = (key: keyof Feeds, value: number) =>
    set({ overrides: { ...operation.overrides, [key]: value } });
  const hasOverrides = Object.keys(operation.overrides).length > 0;
  const maxDepth = bit?.type === 'vbit' ? vbitMaxDepth(bit) : Infinity;
  const tooDeep = operation.depth > maxDepth;

  return (
    <fieldset>
      <legend>Cut: engrave outlines</legend>
      <SelectField
        label="Bit"
        value={operation.bitId}
        options={VBIT_OPTIONS}
        onChange={(bitId) => set({ bitId })}
      />
      <NumberField
        label="Depth"
        unit="mm"
        min={0}
        value={operation.depth}
        error={
          Number.isFinite(operation.depth) && operation.depth > 0
            ? undefined
            : 'Depth must be greater than 0.'
        }
        hint={
          bit &&
          (tooDeep
            ? `Deeper than the cone (${round2(maxDepth)} mm): the line stops getting wider.`
            : `Line width at the surface: ${round2(grooveWidth(bit, operation.depth))} mm`)
        }
        onChange={(depth) => set({ depth })}
      />

      <details className="advanced">
        <summary>
          Feeds &amp; speeds {hasOverrides && <span className="badge">custom</span>}
        </summary>
        <div className="field-row">
          {preset &&
            FEED_FIELDS.map(({ key, label, unit }) => (
              <NumberField
                key={key}
                label={label}
                unit={unit}
                value={operation.overrides[key] ?? preset[key]}
                hint={operation.overrides[key] !== undefined ? `Preset: ${preset[key]}` : undefined}
                onChange={(v) => setFeed(key, v)}
              />
            ))}
        </div>
        {hasOverrides && (
          <button type="button" className="link-button" onClick={() => set({ overrides: {} })}>
            Reset to {material?.name ?? 'material'} preset
          </button>
        )}
      </details>

      <button type="button" className="link-button" onClick={() => onChange(null)}>
        Don't cut this object
      </button>
    </fieldset>
  );
}
