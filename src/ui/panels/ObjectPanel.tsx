import type { DesignObject } from '../../core/job/job';
import { useJobStore } from '../../state/jobStore';
import { ArrangeFields } from './ArrangeFields';
import { ObjectCuts } from './ObjectCuts';
import { PanelHeader, SelectionActions } from './PanelHeader';
import { PlacementFields } from './PlacementFields';
import { RectFields } from './RectFields';
import { CogFields, PolygonFields, PolylineFields, StarFields } from './ShapeFields';
import { TextFields } from './TextFields';

interface ObjectPanelProps {
  object: DesignObject;
}

/**
 * The inspector for one shape, most-used first: its cuts (each opens in
 * place), the shape's own settings, where it sits, then aligning.
 */
export function ObjectPanel({ object }: ObjectPanelProps) {
  const updateObject = useJobStore((s) => s.updateObject);
  const setTransform = (transform: DesignObject['transform']) =>
    updateObject(object.id, { transform });
  const { shape } = object;
  /** A shape's parameters changed: store its rebuilt outline in one step. */
  const rebuild = ({ name, shape: s, paths, width, height, transform }: DesignObject) =>
    updateObject(object.id, { name, shape: s, paths, width, height, transform });

  return (
    <section className="panel" aria-label="Selected object">
      <PanelHeader title={object.name} actions={<SelectionActions />} />
      <ObjectCuts objectId={object.id} />
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
      <PlacementFields
        object={object}
        onTransform={setTransform}
        onPivot={(pivot) => updateObject(object.id, { pivot })}
      />
      <ArrangeFields />
    </section>
  );
}
