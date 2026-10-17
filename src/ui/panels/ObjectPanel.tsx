import type { DesignObject } from '../../core/job/job';
import { useJobStore } from '../../state/jobStore';
import { EngraveFields } from './EngraveFields';
import { PlacementFields } from './PlacementFields';

interface ObjectPanelProps {
  object: DesignObject;
}

/** Shown when an object is selected. */
export function ObjectPanel({ object }: ObjectPanelProps) {
  const updateObject = useJobStore((s) => s.updateObject);
  const removeObject = useJobStore((s) => s.removeObject);
  const select = useJobStore((s) => s.select);

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
      <PlacementFields
        object={object}
        onTransform={(transform) => updateObject(object.id, { transform })}
      />
      <EngraveFields
        operation={object.operation}
        onChange={(operation) => updateObject(object.id, { operation })}
      />
      <button
        type="button"
        className="button button-danger"
        onClick={() => removeObject(object.id)}
      >
        Delete object
      </button>
    </section>
  );
}
