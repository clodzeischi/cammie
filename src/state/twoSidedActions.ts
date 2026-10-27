import { insertToolpath } from '../core/job/toolpaths';
import { DEFAULT_PIN_DIAMETER, registrationCut, registrationHoles } from '../core/job/registration';
import { bitForNewCut } from './cutActions';
import { useJobStore } from './jobStore';
import { useToolingStore } from './toolingStore';

/**
 * Adds two registration holes on the flip line, each cut through into the
 * spoilboard, replacing any earlier ones (so this also puts moved holes back).
 * The new holes are selected.
 */
export function addRegistrationHoles(diameter: number = DEFAULT_PIN_DIAMETER) {
  const { objects, toolpaths, stock, flip, setObjects } = useJobStore.getState();
  const old = new Set(objects.filter((o) => o.role === 'registration').map((o) => o.id));
  const holes = registrationHoles(stock, flip, diameter, () => crypto.randomUUID());
  const bitId = bitForNewCut('inside', toolpaths, useToolingStore.getState().bits);
  const cuts = holes.reduce(
    (list, hole) =>
      insertToolpath(list, {
        id: crypto.randomUUID(),
        objectId: hole.id,
        operation: registrationCut(stock, bitId),
      }),
    toolpaths.filter((t) => !old.has(t.objectId)),
  );
  setObjects(
    [...objects.filter((o) => !old.has(o.id)), ...holes],
    holes.map((h) => h.id),
    undefined,
    cuts,
  );
}
