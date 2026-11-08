import { arrange, canGroup, canUngroup } from '../../state/arrangeActions';
import { copySelection, cutSelection, hasClipboard, paste } from '../../state/clipboard';
import { useDialogStore } from '../../state/dialogStore';
import { editPoints } from '../../state/drawActions';
import { selectedObjects, useJobStore } from '../../state/jobStore';
import { MenuDivider, MenuHeading, MenuItem, PopoverMenu } from '../common/Menu';
import { MOD_KEY } from '../common/platform';
import { CutKindItems } from '../panels/ObjectCuts';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

/** Right-click on the canvas: what can be done with the selection, or with the design. */
export function CanvasContextMenu({ x, y, onClose }: CanvasContextMenuProps) {
  const objects = useJobStore((s) => s.objects);
  const selectedIds = useJobStore((s) => s.selectedIds);
  const selected = selectedObjects({ objects, selectedIds });
  const objectCount = objects.length;
  const selectAll = useJobStore((s) => s.selectAll);
  const show = useDialogStore((s) => s.show);
  const single = selected.length === 1 ? selected[0] : undefined;

  return (
    <PopoverMenu x={x} y={y} label="Shape actions" onClose={onClose}>
      {selected.length > 0 ? (
        <>
          <MenuHeading>
            Add a cut{selected.length > 1 ? ` to ${selected.length} shapes` : ''}
          </MenuHeading>
          <CutKindItems />
          <MenuDivider />
          {single?.shape?.type === 'polyline' && (
            <MenuItem label="Edit points" onClick={() => editPoints(single.id)} />
          )}
          <MenuItem label="Cut" shortcut={`${MOD_KEY}X`} onClick={cutSelection} />
          <MenuItem label="Copy" shortcut={`${MOD_KEY}C`} onClick={copySelection} />
          <MenuItem
            label="Paste"
            shortcut={`${MOD_KEY}V`}
            disabled={!hasClipboard()}
            onClick={paste}
          />
          <MenuItem label="Duplicate" shortcut={`${MOD_KEY}D`} onClick={arrange.duplicate} />
          {canGroup() && (
            <MenuItem label="Group" shortcut={`${MOD_KEY}G`} onClick={arrange.group} />
          )}
          {canUngroup() && (
            <MenuItem label="Ungroup" shortcut={`${MOD_KEY}⇧G`} onClick={arrange.ungroup} />
          )}
          <MenuDivider />
          <MenuItem label="Delete" shortcut="⌫" danger onClick={arrange.remove} />
        </>
      ) : (
        <>
          <MenuItem
            label="Paste"
            shortcut={`${MOD_KEY}V`}
            disabled={!hasClipboard()}
            onClick={paste}
          />
          <MenuItem
            label="Select all"
            shortcut={`${MOD_KEY}A`}
            disabled={objectCount === 0}
            onClick={selectAll}
          />
          <MenuItem
            label="Arrange on stock…"
            disabled={objectCount === 0}
            onClick={() => show('arrange')}
          />
          <MenuItem label="Stock & material…" onClick={() => show('stock')} />
        </>
      )}
    </PopoverMenu>
  );
}
