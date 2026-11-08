import { defaultWarnDepth } from '../../core/cam/vcarvePlan';
import type { VCarveOperation } from '../../core/job/job';
import { grooveWidth, type Bit } from '../../core/tools/bits';
import { useGeneratedJob } from '../../state/useGeneratedJob';
import { NumberField } from '../common/fields';
import { round2 } from './describeCut';

interface VCarveFieldsProps {
  toolpathIds: readonly string[];
  operation: VCarveOperation;
  bit: Bit | undefined;
  thickness: number;
  onChange: (operation: VCarveOperation) => void;
}

/**
 * V-carve has no depth to set: it follows from the shape and the bit. Shows
 * how deep it goes, and when to warn about it.
 */
export function VCarveFields({
  toolpathIds,
  operation,
  bit,
  thickness,
  onChange,
}: VCarveFieldsProps) {
  const { carveDepths } = useGeneratedJob();
  const depths = toolpathIds.flatMap((id) => (id in carveDepths ? [carveDepths[id]!] : []));
  const deepest = depths.length > 0 ? Math.max(...depths) : null;
  const fallback = round2(defaultWarnDepth(thickness));
  const warnDepth = operation.warnDepth ?? fallback;
  const valid = Number.isFinite(warnDepth) && warnDepth > 0;

  return (
    <>
      <p className="field-hint">
        {deepest === null
          ? 'Depth follows the shape: wider parts carve deeper.'
          : `Carves up to ${round2(deepest)} mm deep at the widest part${
              bit ? ` (${round2(grooveWidth(bit, deepest))} mm across at the surface)` : ''
            }. Wider parts carve deeper.`}
      </p>
      <NumberField
        label="Warn deeper than"
        unit="mm"
        min={0}
        value={warnDepth}
        error={valid ? undefined : 'Must be greater than 0.'}
        hint={operation.warnDepth === null ? `Half the stock thickness.` : undefined}
        onChange={(value) => onChange({ ...operation, warnDepth: value })}
      />
      {operation.warnDepth !== null && (
        <button
          type="button"
          className="link-button"
          onClick={() => onChange({ ...operation, warnDepth: null })}
        >
          Reset to half the stock ({fallback} mm)
        </button>
      )}
    </>
  );
}
