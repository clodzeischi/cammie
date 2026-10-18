import type { ProfileOperation, ProfileSide } from '../../core/job/job';
import { defaultOperation } from '../../core/job/objectFactory';
import { findMaterial, presetFeeds } from '../../core/materials/materials';
import { BUILT_IN_BITS, findBit, grooveWidth, vbitMaxDepth, type Bit } from '../../core/tools/bits';
import { useJobStore } from '../../state/jobStore';
import { NumberField, SelectField } from '../common/fields';
import { FeedsFields } from './FeedsFields';

interface CutFieldsProps {
  operation: ProfileOperation | null;
  onChange: (operation: ProfileOperation | null) => void;
}

const BIT_OPTIONS = BUILT_IN_BITS.map((b) => ({ value: b.id, label: b.name }));

const SIDE_OPTIONS: ReadonlyArray<{ value: ProfileSide; label: string }> = [
  { value: 'on', label: 'On the line (engrave)' },
  { value: 'outside', label: 'Outside the line (cut out a part)' },
  { value: 'inside', label: 'Inside the line (cut a hole)' },
];

/** How deep past the stock a "cut through" goes, to clean up the bottom edge. */
const THROUGH_EXTRA = 0.2;

const round2 = (v: number) => Math.round(v * 100) / 100;

function depthHint(bit: Bit, depth: number): string {
  if (bit.type === 'flat') return `Cut width: ${bit.diameter} mm`;
  const maxDepth = vbitMaxDepth(bit);
  return depth > maxDepth
    ? `Deeper than the cone (${round2(maxDepth)} mm): the line stops getting wider.`
    : `Line width at the surface: ${round2(grooveWidth(bit, depth))} mm`;
}

/** Bit, where the cut runs relative to the line, depth and feeds. */
export function CutFields({ operation, onChange }: CutFieldsProps) {
  const materialId = useJobStore((s) => s.materialId);
  const thickness = useJobStore((s) => s.stock.thickness);

  if (!operation) {
    return (
      <fieldset>
        <legend>Cut</legend>
        <p className="muted small">Not cut: shown for reference only.</p>
        <button type="button" className="button" onClick={() => onChange(defaultOperation())}>
          Cut this object
        </button>
      </fieldset>
    );
  }

  const bit = findBit(operation.bitId);
  const material = findMaterial(materialId);
  const set = (patch: Partial<ProfileOperation>) => onChange({ ...operation, ...patch });
  // V-bits only engrave on the line; switching to one resets the side.
  const setBit = (bitId: string) =>
    set(findBit(bitId)?.type === 'vbit' ? { bitId, side: 'on' } : { bitId });
  const sideOptions = bit?.type === 'vbit' ? SIDE_OPTIONS.slice(0, 1) : SIDE_OPTIONS;
  const throughDepth = round2(thickness + THROUGH_EXTRA);
  const depthValid = Number.isFinite(operation.depth) && operation.depth > 0;

  return (
    <fieldset>
      <legend>Cut</legend>
      <SelectField label="Bit" value={operation.bitId} options={BIT_OPTIONS} onChange={setBit} />
      <SelectField
        label="Cut type"
        value={operation.side}
        options={sideOptions}
        onChange={(side) => set({ side })}
      />
      {bit?.type === 'vbit' && (
        <p className="field-hint">Pick an end mill to cut parts out or cut holes.</p>
      )}
      <NumberField
        label="Depth"
        unit="mm"
        min={0}
        value={operation.depth}
        error={depthValid ? undefined : 'Depth must be greater than 0.'}
        hint={bit && depthValid ? depthHint(bit, operation.depth) : undefined}
        onChange={(depth) => set({ depth })}
      />
      {bit?.type === 'flat' && operation.depth !== throughDepth && (
        <button type="button" className="link-button" onClick={() => set({ depth: throughDepth })}>
          Cut through the stock ({throughDepth} mm)
        </button>
      )}

      {bit && material && (
        <FeedsFields
          preset={presetFeeds(material, bit)}
          overrides={operation.overrides}
          material={material}
          onChange={(overrides) => set({ overrides })}
        />
      )}

      <button type="button" className="link-button" onClick={() => onChange(null)}>
        Don't cut this object
      </button>
    </fieldset>
  );
}
