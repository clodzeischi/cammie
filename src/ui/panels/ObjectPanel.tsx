import type { DesignObject } from '../../core/job/job';
import { useJobStore } from '../../state/jobStore';
import { ArrangeFields } from './ArrangeFields';
import { useModeStore } from '../../state/modeStore';
import { EasyCutFields } from './EasyCutFields';
import { ObjectToolpaths } from './ObjectToolpaths';
import { PlacementFields } from './PlacementFields';
import { RectFields } from './RectFields';
import { TextFields } from './TextFields';

interface ObjectPanelProps {
  object: DesignObject;
}

/** Shown when one object is selected. */
export function ObjectPanel({ object }: ObjectPanelProps) {
  const updateObject = useJobStore((s) => s.updateObject);
  const removeObjects = useJobStore((s) => s.removeObjects);
  const select = useJobStore((s) => s.select);
  const mode = useModeStore((s) => s.mode);
  const setTransform = (transform: DesignObject['transform']) =>
    updateObject(object.id, { transform });
  const { shape } = object;

  return (
    <section className="panel" aria-label="Selected object">
      <div className="panel-heading">
        <button type="button" className="link-button" onClick={() => select(null)}>
          ← Job
        </button>
        <h2 className="panel-title" title={object.name}>
          {object.name}
        </h2>
      </div>
      {shape?.type === 'text' && (
        <TextFields object={object} shape={shape} onTransform={setTransform} />
      )}
      {shape?.type === 'rect' && (
        <RectFields
          object={object}
          shape={shape}
          onChange={({ shape: s, paths, width, height, transform }) =>
            updateObject(object.id, { shape: s, paths, width, height, transform })
          }
        />
      )}
      {mode === 'easy' ? (
        <EasyCutFields objectIds={[object.id]} />
      ) : (
        <ObjectToolpaths objectId={object.id} />
      )}
      <PlacementFields object={object} onTransform={setTransform} />
      <ArrangeFields />
      <button
        type="button"
        className="button button-danger"
        onClick={() => removeObjects([object.id])}
      >
        Delete object
      </button>
    </section>
  );
}
