import { Layer, Rect } from 'react-konva';
import type { ObjectTabs } from '../../core/cam/program';
import type { CanvasColors } from './canvasColors';

interface TabMarkersProps {
  tabs: ObjectTabs[];
  scale: number;
  colors: CanvasColors;
}

/** Marker size on screen (px). */
const SIZE = 10;

/** A small square on each tab, sized in screen pixels so it reads at any zoom. */
export function TabMarkers({ tabs, scale, colors }: TabMarkersProps) {
  const size = SIZE / scale;
  return (
    <Layer listening={false}>
      {tabs.flatMap((t) =>
        t.centres.map((c, i) => (
          <Rect
            key={`${t.objectId}-${i}`}
            x={c.x - size / 2}
            y={c.y - size / 2}
            width={size}
            height={size}
            cornerRadius={size / 4}
            fill={colors.pathSelected}
            stroke="#fff"
            strokeWidth={1.5}
            strokeScaleEnabled={false}
          />
        )),
      )}
    </Layer>
  );
}
