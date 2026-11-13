import type { Toolpath } from '../../core/job/job';
import { cutKindOf } from '../../core/job/objectFactory';
import { toolpathsOf } from '../../core/job/toolpaths';
import { findBit } from '../../core/tools/bits';
import { addCutToSelection } from '../../state/cutActions';
import { useJobStore } from '../../state/jobStore';
import { useToolingStore } from '../../state/toolingStore';
import { MenuButton, MenuItem } from '../common/Menu';
import { CUT_KIND_ORDER, CUT_KINDS } from '../cutKinds';
import { Icon } from '../icons/Icon';
import { CutFields } from './CutFields';
import { describeCut } from './describeCut';
import { IconAction } from './PanelHeader';

interface ObjectCutsProps {
  /** One shape: its cuts are listed. Several: only "Add a cut", which adds one to each. */
  objectId?: string;
  count?: number;
}

/**
 * The selected shape's cuts, each opening in place to its settings (the cut
 * plan opens the same card), and the one way to add another.
 */
export function ObjectCuts({ objectId, count = 1 }: ObjectCutsProps) {
  const toolpaths = useJobStore((s) => s.toolpaths);
  const own = objectId ? toolpathsOf(toolpaths, objectId) : [];

  return (
    <fieldset>
      <legend>Cuts</legend>
      {own.length > 0 && (
        <ul className="cut-cards">
          {own.map((t) => (
            <CutCard key={t.id} toolpath={t} />
          ))}
        </ul>
      )}
      <AddCutMenu count={count} first={objectId !== undefined && own.length === 0} />
    </fieldset>
  );
}

function CutCard({ toolpath }: { toolpath: Toolpath }) {
  const open = useJobStore((s) => s.selectedToolpathId === toolpath.id);
  const name = useJobStore((s) => s.objects.find((o) => o.id === toolpath.objectId)?.name);
  const thickness = useJobStore((s) => s.stock.thickness);
  const selectToolpath = useJobStore((s) => s.selectToolpath);
  const updateToolpath = useJobStore((s) => s.updateToolpath);
  const removeToolpaths = useJobStore((s) => s.removeToolpaths);
  const bits = useToolingStore((s) => s.bits);
  const { operation } = toolpath;
  const kind = CUT_KINDS[cutKindOf(operation)];
  const bit = findBit(operation.bitId, bits);

  return (
    <li className={open ? 'cut-card cut-card-open' : 'cut-card'}>
      <div className="cut-card-head">
        <button
          type="button"
          className="cut-card-toggle"
          aria-expanded={open}
          title={describeCut(operation, bit, name ?? 'the shape', thickness)}
          onClick={() => selectToolpath(open ? null : toolpath.id)}
        >
          <span style={{ color: kind.color }}>
            <Icon name={kind.icon} size={20} />
          </span>
          <span className="cut-card-name">
            <b>{kind.name}</b>
            <small>
              {bit?.name ?? 'Missing bit'} · {operation.depth} mm
            </small>
          </span>
          <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} />
        </button>
        {open && (
          <IconAction
            icon="trash"
            label="Delete this cut"
            danger
            onClick={() => removeToolpaths([toolpath.id])}
          />
        )}
      </div>
      {open && (
        <div className="cut-card-body">
          <CutFields
            toolpathId={toolpath.id}
            operation={operation}
            onChange={(next, kindChanged) => updateToolpath(toolpath.id, next, kindChanged)}
          />
        </div>
      )}
    </li>
  );
}

/** "Add a cut": every kind of cut with its icon, plain name and the CAM term. */
export function AddCutMenu({ count, first = false }: { count: number; first?: boolean }) {
  return (
    <MenuButton
      className={first ? 'button button-primary add-cut-button' : 'button add-cut-button'}
      menuLabel="Add a cut"
      items={<CutKindItems />}
    >
      <Icon name="plus" size={16} /> Add a cut{count > 1 ? ` to ${count} shapes` : ''}
    </MenuButton>
  );
}

/** The cut kinds as menu items; picking one adds it to the selection. */
function CutKindItems() {
  return (
    <>
      {CUT_KIND_ORDER.map((k) => (
        <MenuItem
          key={k}
          icon={CUT_KINDS[k].icon}
          iconColor={CUT_KINDS[k].color}
          label={CUT_KINDS[k].name}
          detail={CUT_KINDS[k].term === CUT_KINDS[k].name ? undefined : CUT_KINDS[k].term}
          onClick={() => addCutToSelection(k)}
        />
      ))}
    </>
  );
}
