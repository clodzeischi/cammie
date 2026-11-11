import { useState } from 'react';
import type { ObjectTransform } from '../../core/geometry/transform';
import type { DesignObject, OriginAnchor } from '../../core/job/job';
import { anchorPoint } from '../../core/job/job';
import {
  machinePosition,
  objectPivot,
  objectSize,
  withMachinePosition,
  withRotation,
  withSize,
} from '../../core/job/placement';
import { useJobStore } from '../../state/jobStore';
import { NumberField } from '../common/fields';
import { AnchorPicker } from './AnchorPicker';

interface PlacementFieldsProps {
  object: DesignObject;
  onTransform: (transform: ObjectTransform) => void;
  onPivot: (pivot: OriginAnchor) => void;
}

/** Ignores empty or half-typed entries; the field keeps showing what's typed. */
const finite = (apply: (v: number) => void) => (v: number) => Number.isFinite(v) && apply(v);
const positive = (apply: (v: number) => void) => (v: number) =>
  Number.isFinite(v) && v > 0 && apply(v);

const PIVOT_NAMES: Record<OriginAnchor, string> = {
  'top-left': 'top-left corner',
  'top-center': 'middle of the top edge',
  'top-right': 'top-right corner',
  'center-left': 'middle of the left edge',
  center: 'centre',
  'center-right': 'middle of the right edge',
  'bottom-left': 'lower-left corner',
  'bottom-center': 'middle of the bottom edge',
  'bottom-right': 'lower-right corner',
};

/**
 * Position (of the shape's pivot, from the work origin), size and rotation.
 * Typed sizes and rotations keep the pivot where it is.
 */
export function PlacementFields({ object, onTransform, onPivot }: PlacementFieldsProps) {
  const stock = useJobStore((s) => s.stock);
  const originAnchor = useJobStore((s) => s.origin);
  const [keepAspect, setKeepAspect] = useState(true);
  const origin = anchorPoint(stock, originAnchor);
  const position = machinePosition(object, origin);
  const size = objectSize(object);
  const pivot = objectPivot(object);

  return (
    <fieldset>
      <legend>Position & size</legend>
      <AnchorPicker label="Pivot" value={pivot} onChange={onPivot} />
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
          onChange={positive((width) => onTransform(withSize(object, { width }, keepAspect)))}
        />
        <NumberField
          label="Height"
          unit="mm"
          value={size.height}
          onChange={positive((height) => onTransform(withSize(object, { height }, keepAspect)))}
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
      <p className="field-hint">
        X/Y is the shape's {PIVOT_NAMES[pivot]}, measured from the work origin.
      </p>
    </fieldset>
  );
}
