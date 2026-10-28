import type { ChamferOperation } from '../../core/job/job';
import { chamferDepth, chamferWidth, vbitMaxDepth, type VBit } from '../../core/tools/bits';
import { NumberField, SelectField } from '../common/fields';
import { round2 } from './describeCut';

interface ChamferFieldsProps {
  operation: ChamferOperation;
  bit: VBit;
  onChange: (operation: ChamferOperation) => void;
}

const SIDES: ReadonlyArray<{ value: ChamferOperation['side']; label: string }> = [
  { value: 'outside', label: "The shape's edges (a part)" },
  { value: 'inside', label: 'The rim of a hole of this shape' },
];

/**
 * Which edge to bevel and how wide. The width is what people think in; it's
 * stored as the depth the V-bit cuts to, which depends on the bit's angle.
 */
export function ChamferFields({ operation, bit, onChange }: ChamferFieldsProps) {
  const width = round2(chamferWidth(bit, operation.depth));
  const maxWidth = round2(chamferWidth(bit, vbitMaxDepth(bit)));
  const valid = Number.isFinite(operation.depth) && operation.depth > 0;
  const tooWide = operation.depth > vbitMaxDepth(bit) + 1e-9;

  return (
    <>
      <SelectField
        label="Bevel"
        value={operation.side}
        options={SIDES}
        onChange={(side) => onChange({ ...operation, side })}
      />
      <NumberField
        label="Chamfer width"
        unit="mm"
        min={0}
        value={width}
        error={
          !valid
            ? 'Width must be greater than 0.'
            : tooWide
              ? `The ${bit.name} can bevel at most ${maxWidth} mm.`
              : undefined
        }
        hint={`Cuts ${round2(operation.depth)} mm deep with the ${bit.angle}° bit.`}
        onChange={(w) => onChange({ ...operation, depth: chamferDepth(bit, w) })}
      />
    </>
  );
}
