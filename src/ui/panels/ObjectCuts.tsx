import { cutKindOf } from '../../core/job/objectFactory';
import { toolpathsOf } from '../../core/job/toolpaths';
import { findBit } from '../../core/tools/bits';
import { addCutToSelection } from '../../state/cutActions';
import { useJobStore } from '../../state/jobStore';
import { useToolingStore } from '../../state/toolingStore';
import { MenuButton, MenuItem } from '../common/Menu';
import { CUT_KIND_ORDER, CUT_KINDS } from '../cutKinds';
import { Icon } from '../icons/Icon';

interface ObjectCutsProps {
  /** One shape: its cuts are listed. Several: only "Add a cut", which adds one to each. */
  objectId?: string;
  count?: number;
}

/** The selected shape's cuts, and the one way to add another. */
export function ObjectCuts({ objectId, count = 1 }: ObjectCutsProps) {
  const toolpaths = useJobStore((s) => s.toolpaths);
  const selectToolpath = useJobStore((s) => s.selectToolpath);
  const bits = useToolingStore((s) => s.bits);
  const own = objectId ? toolpathsOf(toolpaths, objectId) : [];

  return (
    <fieldset>
      <legend>Cuts</legend>
      {objectId && own.length === 0 && (
        <p className="muted small">Not cut yet: it's only a drawing until you add a cut.</p>
      )}
      {own.length > 0 && (
        <ul className="object-toolpaths">
          {own.map((t) => {
            const kind = CUT_KINDS[cutKindOf(t.operation)];
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className="toolpath-chip"
                  onClick={() => selectToolpath(t.id)}
                >
                  <span style={{ color: kind.color }}>
                    <Icon name={kind.icon} size={18} />
                  </span>
                  <span>{kind.name}</span>
                  <span className="muted small">
                    {findBit(t.operation.bitId, bits)?.name ?? 'Missing bit'} · {t.operation.depth}{' '}
                    mm
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <AddCutMenu count={count} />
    </fieldset>
  );
}

/** "Add a cut": every kind of cut with its icon, plain name and the CAM term. */
export function AddCutMenu({ count }: { count: number }) {
  return (
    <MenuButton
      className="button button-small add-cut-button"
      menuLabel="Add a cut"
      title={count > 1 ? `Adds the cut to each of the ${count} shapes` : undefined}
      items={<CutKindItems />}
    >
      + Add a cut{count > 1 ? ` to ${count} shapes` : ''}
    </MenuButton>
  );
}

/** The cut kinds as menu items; picking one adds it to the selection. */
export function CutKindItems() {
  return (
    <>
      {CUT_KIND_ORDER.map((k) => (
        <MenuItem
          key={k}
          icon={CUT_KINDS[k].icon}
          iconColor={CUT_KINDS[k].color}
          label={CUT_KINDS[k].name}
          detail={k === 'drill' ? CUT_KINDS[k].hint : `${CUT_KINDS[k].term} · ${CUT_KINDS[k].hint}`}
          onClick={() => addCutToSelection(k)}
        />
      ))}
    </>
  );
}
