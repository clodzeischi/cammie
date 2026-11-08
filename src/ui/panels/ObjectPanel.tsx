import type { DesignObject } from '../../core/job/job';
import { useJobStore } from '../../state/jobStore';
import { ArrangeFields } from './ArrangeFields';
import { ObjectCuts } from './ObjectCuts';
import { PlacementFields } from './PlacementFields';
import { RectFields } from './RectFields';
import { CogFields, PolygonFields, PolylineFields, StarFields } from './ShapeFields';
import { TextFields } from './TextFields';

interface ObjectPanelProps {
  object: DesignObject;
}

/**
 * The inspector for one shape, in the order it's worked on: the shape's own
 * settings, how it's cut, where it sits, then aligning and grouping.
 */
export function ObjectPanel({ object }: ObjectPanelProps) {
  const updateObject = useJobStore((s) => s.updateObject);
  const removeObjects = useJobStore((s) => s.removeObjects);
  const select = useJobStore((s) => s.select);
  const setTransform = (transform: DesignObject['transform']) =>
    updateObject(object.id, { transform });
  const { shape } = object;
  /** A shape's parameters changed: store its rebuilt outline in one step. */
  const rebuild = ({ name, shape: s, paths, width, height, transform }: DesignObject) =>
    updateObject(object.id, { name, shape: s, paths, width, height, transform });

  return (
    <section className="panel" aria-label="Selected object">
      <div className="panel-heading">
        <button type="button" className="link-button" onClick={() => select(null)}>
          Done
        </button>
        <h2 className="panel-title" title={object.name}>
          {object.name}
        </h2>
      </div>
      {shape?.type === 'text' && (
        <TextFields object={object} shape={shape} onTransform={setTransform} />
      )}
      {shape?.type === 'rect' && <RectFields object={object} shape={shape} onChange={rebuild} />}
      {shape?.type === 'polygon' && (
        <PolygonFields object={object} shape={shape} onChange={rebuild} />
      )}
      {shape?.type === 'star' && <StarFields object={object} shape={shape} onChange={rebuild} />}
      {shape?.type === 'cog' && <CogFields object={object} shape={shape} onChange={rebuild} />}
      {shape?.type === 'polyline' && (
        <PolylineFields object={object} shape={shape} onChange={rebuild} />
      )}
      <ObjectCuts objectId={object.id} />
      <PlacementFields object={object} onTransform={setTransform} />
      <ArrangeFields />
      <button
        type="button"
        className="button button-danger"
        onClick={() => removeObjects([object.id])}
      >
        Delete shape
      </button>
    </section>
  );
}
