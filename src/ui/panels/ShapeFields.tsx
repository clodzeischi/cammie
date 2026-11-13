import type {
  CogShape,
  DesignObject,
  PolygonShape,
  PolylineShape,
  StarShape,
} from '../../core/job/job';
import { MIN_POINTS } from '../../core/shapes/polyline';
import {
  maxToothDepth,
  SIDES_RANGE,
  STAR_POINTS_RANGE,
  TEETH_RANGE,
} from '../../core/shapes/regularShapes';
import { withShape, type DrawnShape } from '../../core/shapes/shapeObjects';
import { editPoints } from '../../state/drawActions';
import { useDrawStore } from '../../state/drawStore';
import { NumberField } from '../common/fields';
import { RangeField } from '../common/RangeField';

interface FieldsProps<S> {
  object: DesignObject;
  shape: S;
  onChange: (object: DesignObject) => void;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const isWhole = (v: number, range: { min: number; max: number }) =>
  Number.isInteger(v) && v >= range.min && v <= range.max;
const wholeHint = (range: { min: number; max: number }) =>
  `A whole number from ${range.min} to ${range.max}.`;

/** Applies a parameter change, rebuilding the outline in place. */
const changer =
  <S extends DrawnShape>({ object, shape, onChange }: FieldsProps<S>) =>
  (patch: Partial<S>) =>
    onChange(withShape(object, { ...shape, ...patch }));

export function PolygonFields(props: FieldsProps<PolygonShape>) {
  const set = changer(props);
  return (
    <fieldset>
      <legend>Shape</legend>
      <NumberField
        label="Sides"
        step={1}
        min={SIDES_RANGE.min}
        value={props.shape.sides}
        hint={wholeHint(SIDES_RANGE)}
        onChange={(sides) => isWhole(sides, SIDES_RANGE) && set({ sides })}
      />
    </fieldset>
  );
}

export function StarFields(props: FieldsProps<StarShape>) {
  const set = changer(props);
  return (
    <fieldset>
      <legend>Shape</legend>
      <NumberField
        label="Points"
        step={1}
        min={STAR_POINTS_RANGE.min}
        value={props.shape.points}
        hint={wholeHint(STAR_POINTS_RANGE)}
        onChange={(points) => isWhole(points, STAR_POINTS_RANGE) && set({ points })}
      />
      <RangeField
        label="Inner size"
        unit="%"
        min={10}
        max={90}
        value={Math.round(props.shape.innerRatio * 100)}
        onChange={(percent) => set({ innerRatio: percent / 100 })}
      />
    </fieldset>
  );
}

export function CogFields(props: FieldsProps<CogShape>) {
  const { shape } = props;
  const set = changer(props);
  const maxDepth = round2(maxToothDepth(shape.width));
  return (
    <fieldset>
      <legend>Shape</legend>
      <NumberField
        label="Teeth"
        step={1}
        min={TEETH_RANGE.min}
        value={shape.teeth}
        hint={wholeHint(TEETH_RANGE)}
        onChange={(teeth) => isWhole(teeth, TEETH_RANGE) && set({ teeth })}
      />
      <NumberField
        label="Tooth depth"
        unit="mm"
        min={0}
        value={shape.toothDepth}
        hint={shape.toothDepth > maxDepth ? `Limited to ${maxDepth} mm at this size.` : undefined}
        onChange={(toothDepth) =>
          Number.isFinite(toothDepth) && toothDepth > 0 && set({ toothDepth })
        }
      />
      <RangeField
        label="Tooth width"
        unit="%"
        min={10}
        max={90}
        value={Math.round(shape.toothWidth * 100)}
        onChange={(percent) => set({ toothWidth: percent / 100 })}
      />
      <NumberField
        label="Centre hole"
        unit="mm"
        min={0}
        value={shape.boreDiameter}
        hint="0 for none. Left out if it would reach the teeth."
        onChange={(boreDiameter) =>
          Number.isFinite(boreDiameter) && boreDiameter >= 0 && set({ boreDiameter })
        }
      />
    </fieldset>
  );
}

export function PolylineFields(props: FieldsProps<PolylineShape>) {
  const { object, shape } = props;
  const set = changer(props);
  const editing = useDrawStore((s) => s.editingId === object.id);
  const setEditing = useDrawStore((s) => s.setEditing);
  const closable = shape.points.length >= MIN_POINTS.closed;
  return (
    <fieldset>
      <legend>Shape</legend>
      <RangeField
        label="Smoothing"
        unit="%"
        min={0}
        max={100}
        step={5}
        value={Math.round(shape.smoothing * 100)}
        onChange={(percent) => set({ smoothing: percent / 100 })}
      />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={shape.closed}
          disabled={!closable && !shape.closed}
          onChange={(e) => set({ closed: e.target.checked })}
        />
        Closed shape
      </label>
      <div className="button-row">
        <button
          type="button"
          className="button button-small"
          aria-pressed={editing}
          onClick={() => (editing ? setEditing(null) : editPoints(object.id))}
        >
          {editing ? 'Done editing points' : 'Edit points'}
        </button>
      </div>
      {editing && (
        <p className="field-hint">
          Drag a point to move it. Double-click the line to add one, a point to remove it.
        </p>
      )}
    </fieldset>
  );
}
