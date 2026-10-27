import { useState } from 'react';
import { defaultTabWidth } from '../../core/cam/profilePlan';
import type { Operation } from '../../core/job/job';
import { cutKindOf, THROUGH_EXTRA, withCutKind, type CutKind } from '../../core/job/objectFactory';
import { findMaterial } from '../../core/materials/materials';
import { findBit } from '../../core/tools/bits';
import { useJobStore } from '../../state/jobStore';
import { useToolingStore } from '../../state/toolingStore';
import { NumberField, SelectField } from '../common/fields';
import { CUT_KIND_ORDER, CUT_KINDS } from '../cutKinds';
import { AdvancedCutFields } from './AdvancedCutFields';
import { depthHint, round2 } from './describeCut';
import { BitLibraryDialog } from './BitLibraryDialog';
import { FeedsFields } from './FeedsFields';
import { TabFields } from './TabFields';

interface CutFieldsProps {
  operation: Operation;
  /** `kindChanged` is true when the cut type changed, so the toolpath can move to its natural place. */
  onChange: (operation: Operation, kindChanged: boolean) => void;
  onRemove: () => void;
}

const KIND_OPTIONS: ReadonlyArray<{ value: CutKind; label: string }> = CUT_KIND_ORDER.map(
  (value) => ({ value, label: `${CUT_KINDS[value].pro} (${CUT_KINDS[value].hint.toLowerCase()})` }),
);

/** Bit, cut type, depth, feeds, advanced options and tabs for one toolpath (Pro). */
export function CutFields({ operation, onChange: change, onRemove }: CutFieldsProps) {
  const materialId = useJobStore((s) => s.materialId);
  const thickness = useJobStore((s) => s.stock.thickness);
  const bits = useToolingStore((s) => s.bits);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const onChange = (next: Operation) => change(next, cutKindOf(next) !== cutKindOf(operation));
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

      <button type="button" className="button button-danger" onClick={onRemove}>
        Delete toolpath
      </button>
      {libraryOpen && <BitLibraryDialog onClose={() => setLibraryOpen(false)} />}
    </fieldset>
  );
}
