import type { DesignObject, RectShape } from '../../core/job/job';
import { maxCornerRadius } from '../../core/shapes/primitives';
import { withShape } from '../../core/shapes/shapeObjects';
import { NumberField } from '../common/fields';

interface RectFieldsProps {
  object: DesignObject;
  shape: RectShape;
  onChange: (object: DesignObject) => void;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Rectangles' corner radius; width and height are under Placement like any object. */
export function RectFields({ object, shape, onChange }: RectFieldsProps) {
  const max = round2(maxCornerRadius(shape.width, shape.height));
  return (
    <fieldset>
      <legend>Rectangle</legend>
      <NumberField
        label="Corner radius"
        unit="mm"
        min={0}
        value={shape.cornerRadius}
        hint={shape.cornerRadius > max ? `Limited to ${max} mm at this size.` : undefined}
        onChange={(cornerRadius) =>
          Number.isFinite(cornerRadius) &&
          cornerRadius >= 0 &&
          onChange(withShape(object, { ...shape, cornerRadius }))
        }
      />
    </fieldset>
  );
}
