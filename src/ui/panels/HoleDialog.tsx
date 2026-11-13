import { useState } from 'react';
import { canCut } from '../../core/job/bitCapabilities';
import { holeOperation, HOLE_DRILL_MATCH, THROUGH_EXTRA } from '../../core/job/objectFactory';
import { createShapeObject } from '../../core/shapes/shapeObjects';
import { findBit } from '../../core/tools/bits';
import { bitForNewCut } from '../../state/cutActions';
import { useJobStore } from '../../state/jobStore';
import { useToolingStore } from '../../state/toolingStore';
import { NumberField, SelectField } from '../common/fields';
import { Modal } from '../common/Modal';

const DEFAULT_DIAMETER = 6;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Asks for a hole's size, depth and bit, then adds it with its cut. */
export function HoleDialog({ onClose }: { onClose: () => void }) {
  const stock = useJobStore((s) => s.stock);
  const toolpaths = useJobStore((s) => s.toolpaths);
  const addObject = useJobStore((s) => s.addObject);
  const bits = useToolingStore((s) => s.bits);
  const usable = bits.filter((b) => canCut(b, 'inside'));
  const [diameter, setDiameter] = useState(DEFAULT_DIAMETER);
  const [depth, setDepth] = useState(() => round2(stock.thickness + THROUGH_EXTRA));
  const [bitId, setBitId] = useState(() => bitForNewCut('inside', toolpaths, bits));
  const bit = findBit(bitId, bits);

  const sizeOk = Number.isFinite(diameter) && diameter > 0;
  const depthOk = Number.isFinite(depth) && depth > 0;
  const operation =
    bit && sizeOk && depthOk ? holeOperation(diameter, depth, bit, stock.thickness) : null;
  const tooBig = bit && sizeOk && diameter < bit.diameter - HOLE_DRILL_MATCH;

  const add = () => {
    if (!operation) return;
    const shape = { type: 'ellipse' as const, width: diameter, height: diameter };
    const object = createShapeObject(crypto.randomUUID(), shape, stock);
    addObject({ ...object, name: `Hole Ø${round2(diameter)}` }, operation);
    onClose();
  };

  return (
    <Modal
      title="Add a hole"
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button
            type="button"
            className="button button-primary"
            disabled={!operation}
            onClick={add}
          >
            Add hole
          </button>
        </>
      }
    >
      <NumberField
        label="Diameter"
        unit="mm"
        min={0}
        value={diameter}
        error={sizeOk ? undefined : 'Enter a size above 0.'}
        onChange={setDiameter}
      />
      <NumberField
        label="Depth"
        unit="mm"
        min={0}
        value={depth}
        error={depthOk ? undefined : 'Enter a depth above 0.'}
        hint={`Starts ${THROUGH_EXTRA} mm past the ${stock.thickness} mm stock, so it goes right through.`}
        onChange={setDepth}
      />
      <SelectField
        label="Bit"
        value={bitId}
        options={usable.map((b) => ({ value: b.id, label: b.name }))}
        onChange={setBitId}
      />
      <p className={tooBig ? 'field-error' : 'field-hint'}>
        {tooBig
          ? `This bit is ${bit.diameter} mm wide, too big for the hole. Pick a smaller bit.`
          : operation?.type === 'drill'
            ? 'The bit is the hole’s size, so it drills straight down.'
            : 'Cut round from the inside, so the hole comes out at this size. Move it, or change its size, like any shape.'}
      </p>
    </Modal>
  );
}
