import { useState } from 'react';
import type { ObjectTransform } from '../../core/geometry/transform';
import type { DesignObject } from '../../core/job/job';
import { anchorPoint } from '../../core/job/job';
import {
  machinePosition,
  objectSize,
  withMachinePosition,
  withRotation,
  withSize,
} from '../../core/job/placement';
import { useJobStore } from '../../state/jobStore';
import { NumberField } from '../common/fields';

interface PlacementFieldsProps {
  object: DesignObject;
  onTransform: (transform: ObjectTransform) => void;
}

/** Ignores empty or half-typed entries; the field keeps showing what's typed. */
const finite = (apply: (v: number) => void) => (v: number) => Number.isFinite(v) && apply(v);
const positive = (apply: (v: number) => void) => (v: number) =>
  Number.isFinite(v) && v > 0 && apply(v);

/** Position (lower-left corner, from the work origin), size and rotation. */
export function PlacementFields({ object, onTransform }: PlacementFieldsProps) {
  const stock = useJobStore((s) => s.stock);
  const originAnchor = useJobStore((s) => s.origin);
  const [keepAspect, setKeepAspect] = useState(true);
  const origin = anchorPoint(stock, originAnchor);
  const position = machinePosition(object, origin);
  const size = objectSize(object);

  return (
    <fieldset>
      <legend>Placement</legend>
      <div className="field-row">
        <NumberField
          label="X"
          unit="mm"
          value={position.x}
          onChange={finite((x) =>
            onTransform(withMachinePosition(object, origin, { ...position, x })),
          )}
        />
        <NumberField
          label="Y"
          unit="mm"
          value={position.y}
          onChange={finite((y) =>
            onTransform(withMachinePosition(object, origin, { ...position, y })),
          )}
        />
      </div>
      <div className="field-row">
        <NumberField
          label="Width"
          unit="mm"
          value={size.width}
          onChange={positive((width) =>
            onTransform(withSize(object, origin, { width }, keepAspect)),
          )}
        />
        <NumberField
          label="Height"
          unit="mm"
          value={size.height}
          onChange={positive((height) =>
            onTransform(withSize(object, origin, { height }, keepAspect)),
          )}
        />
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={keepAspect}
          onChange={(e) => setKeepAspect(e.target.checked)}
        />
        Keep proportions
      </label>
      <NumberField
        label="Rotation"
        unit="°"
        value={object.transform.rotation}
        onChange={finite((rotation) => onTransform(withRotation(object, rotation)))}
      />
      <p className="field-hint">X/Y is the lower-left corner, measured from the work origin.</p>
    </fieldset>
  );
}
