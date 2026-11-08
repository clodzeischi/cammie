import {
  createShapeObject,
  DEFAULT_COG,
  DEFAULT_ELLIPSE,
  DEFAULT_POLYGON,
  DEFAULT_RECT,
  DEFAULT_STAR,
  type DrawnShape,
} from '../../core/shapes/shapeObjects';
import { useDialogStore } from '../../state/dialogStore';
import { startDrawing } from '../../state/drawActions';
import { useDrawStore } from '../../state/drawStore';
import { useJobStore } from '../../state/jobStore';
import { useNoticeStore } from '../../state/noticeStore';
import type { IconName } from '../icons/Icon';
import { newTextObject, requestTextFocus } from '../text/textEditing';

/** The file input the Import tool clicks (see ImportButton). */
export const IMPORT_INPUT_ID = 'import-file-input';

export interface Tool {
  id: string;
  icon: IconName;
  label: string;
  /** What it does, for the tooltip. */
  hint: string;
  /** Single-key shortcut (no modifier), lower case. */
  key: string;
  /** Shown pressed while it's the tool in use. */
  active?: () => boolean;
  run: () => void;
}

const addShape = (shape: DrawnShape) => {
  const job = useJobStore.getState();
  job.addObject(createShapeObject(crypto.randomUUID(), shape, job.stock));
};

async function addText() {
  try {
    const object = await newTextObject(useJobStore.getState().stock);
    requestTextFocus(object.id);
    useJobStore.getState().addObject(object);
  } catch {
    useNoticeStore.getState().show({
      kind: 'error',
      text: "Couldn't load the font. Check your connection and try again.",
    });
  }
}

const drawing = (tool: 'line' | 'curve') => () => useDrawStore.getState().tool === tool;
const toggleDrawing = (tool: 'line' | 'curve') => () =>
  drawing(tool)() ? useDrawStore.getState().cancel() : startDrawing(tool);

/** Select / draw tools first, then shapes that land on the stock, then files. */
export const TOOL_GROUPS: readonly (readonly Tool[])[] = [
  [
    {
      id: 'select',
      icon: 'select',
      label: 'Select',
      hint: 'Select and move shapes',
      key: 'v',
      active: () => useDrawStore.getState().tool === null,
      run: () => {
        useDrawStore.getState().cancel();
        useDrawStore.getState().setEditing(null);
      },
    },
    {
      id: 'line',
      icon: 'line',
      label: 'Line',
      hint: 'Draw straight lines: click to place points, click the first point to close, double-click or Enter to finish',
      key: 'l',
      active: drawing('line'),
      run: toggleDrawing('line'),
    },
    {
      id: 'curve',
      icon: 'curve',
      label: 'Curve',
      hint: 'Draw a smooth curve through the points you click',
      key: 'c',
      active: drawing('curve'),
      run: toggleDrawing('curve'),
    },
  ],
  [
    { id: 'text', icon: 'text', label: 'Text', hint: 'Add text', key: 't', run: addText },
    {
      id: 'rect',
      icon: 'rect',
      label: 'Rectangle',
      hint: 'Add a rectangle',
      key: 'r',
      run: () => addShape(DEFAULT_RECT),
    },
    {
      id: 'circle',
      icon: 'ellipse',
      label: 'Circle',
      hint: 'Add a circle (stretch it into an ellipse)',
      key: 'e',
      run: () => addShape(DEFAULT_ELLIPSE),
    },
    {
      id: 'polygon',
      icon: 'polygon',
      label: 'Polygon',
      hint: 'Add a polygon (pick the number of sides)',
      key: 'p',
      run: () => addShape(DEFAULT_POLYGON),
    },
    {
      id: 'star',
      icon: 'star',
      label: 'Star',
      hint: 'Add a star',
      key: 's',
      run: () => addShape(DEFAULT_STAR),
    },
    {
      id: 'cog',
      icon: 'cog',
      label: 'Cog',
      hint: 'Add a cog wheel',
      key: 'g',
      run: () => addShape(DEFAULT_COG),
    },
    {
      id: 'hole',
      icon: 'hole',
      label: 'Hole',
      hint: 'Add a round hole of any size',
      key: 'h',
      run: () => useDialogStore.getState().show('hole'),
    },
  ],
  [
    {
      id: 'import',
      icon: 'import',
      label: 'Import',
      hint: 'Import an SVG or an image (PNG, JPG)',
      key: 'i',
      run: () => document.getElementById(IMPORT_INPUT_ID)?.click(),
    },
  ],
];

const ALL_TOOLS = TOOL_GROUPS.flat();

/** The tool for a single-key shortcut, if any. */
export const toolForKey = (key: string): Tool | undefined =>
  ALL_TOOLS.find((t) => t.key === key.toLowerCase());
