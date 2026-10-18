import { useState } from 'react';
import { defaultTabWidth } from '../../core/cam/profilePlan';
import type { Operation } from '../../core/job/job';
import {
  cutKindOf,
  defaultOperation,
  withCutKind,
  type CutKind,
} from '../../core/job/objectFactory';
import { findMaterial } from '../../core/materials/materials';
import { findBit, grooveWidth, vbitMaxDepth, type Bit } from '../../core/tools/bits';
import { useJobStore } from '../../state/jobStore';
import { useToolingStore } from '../../state/toolingStore';
import { NumberField, SelectField } from '../common/fields';
import { AdvancedCutFields } from './AdvancedCutFields';
import { BitLibraryDialog } from './BitLibraryDialog';
import { FeedsFields } from './FeedsFields';
import { TabFields } from './TabFields';

interface CutFieldsProps {
  operation: Operation | null;
  onChange: (operation: Operation | null) => void;
}

const KIND_OPTIONS: ReadonlyArray<{ value: CutKind; label: string }> = [
  { value: 'on', label: 'On the line (engrave)' },
  { value: 'outside', label: 'Outside the line (cut out a part)' },
  { value: 'inside', label: 'Inside the line (cut a hole)' },
  { value: 'pocket', label: 'Pocket (clear the inside)' },
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

/** Bit, cut type, depth, feeds, advanced options and tabs for one object. */
export function CutFields({ operation, onChange }: CutFieldsProps) {
  const materialId = useJobStore((s) => s.materialId);
  const thickness = useJobStore((s) => s.stock.thickness);
  const bits = useToolingStore((s) => s.bits);
  const [libraryOpen, setLibraryOpen] = useState(false);

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

  const kind = cutKindOf(operation);
  const bit = findBit(operation.bitId, bits);
  const material = findMaterial(materialId);
  const set = (patch: Partial<Pick<Operation, 'bitId' | 'depth'>>) =>
    onChange({ ...operation, ...patch });
  // V-bits only engrave on the line; switching to one resets the cut type.
  const setBit = (bitId: string) => {
    const next = { ...operation, bitId };
    onChange(findBit(bitId, bits)?.type === 'vbit' ? withCutKind(next, 'on') : next);
  };
  const kindOptions = bit?.type === 'vbit' ? KIND_OPTIONS.slice(0, 1) : KIND_OPTIONS;
  const throughDepth = round2(thickness + THROUGH_EXTRA);
  const depthValid = Number.isFinite(operation.depth) && operation.depth > 0;

  return (
    <fieldset>
      <legend>Cut</legend>
      <SelectField
        label="Bit"
        value={operation.bitId}
        options={bits.map((b) => ({ value: b.id, label: b.name }))}
        onChange={setBit}
      />
      <button type="button" className="link-button" onClick={() => setLibraryOpen(true)}>
        Manage bits…
      </button>
      <SelectField
        label="Cut type"
        value={kind}
        options={kindOptions}
        onChange={(k) => onChange(withCutKind(operation, k))}
      />
      {bit?.type === 'vbit' && (
        <p className="field-hint">Pick an end mill to cut parts out, cut holes or clear pockets.</p>
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
        <FeedsFields material={material} bit={bit} showStepover={kind === 'pocket'} />
      )}
      <AdvancedCutFields operation={operation} onChange={onChange} />
      {operation.type === 'profile' && kind !== 'on' && bit && (
        <TabFields
          tabs={operation.tabs}
          autoWidth={defaultTabWidth(bit)}
          through={operation.depth > thickness - operation.tabs.height}
          onChange={(tabs) => onChange({ ...operation, tabs })}
        />
      )}

      <button type="button" className="link-button" onClick={() => onChange(null)}>
        Don't cut this object
      </button>
      {libraryOpen && <BitLibraryDialog onClose={() => setLibraryOpen(false)} />}
    </fieldset>
  );
}
