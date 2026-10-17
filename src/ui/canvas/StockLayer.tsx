import { Arrow, Circle, Layer, Line, Rect } from 'react-konva';
import { anchorPoint, type OriginAnchor, type Stock } from '../../core/job/job';
import type { CanvasColors } from './canvasColors';

interface StockLayerProps {
  stock: Stock;
  origin: OriginAnchor;
  /** Screen pixels per mm, so markers keep a constant on-screen size. */
  scale: number;
  colors: CanvasColors;
}

const GRID_MM = 10;
const MAJOR_EVERY = 5;

/** The material: board, 10 mm grid, and the X0 Y0 marker with axis arrows. */
export function StockLayer({ stock, origin, scale, colors }: StockLayerProps) {
  const lines = [];
  for (let x = GRID_MM; x < stock.width; x += GRID_MM) {
    const major = Math.round(x / GRID_MM) % MAJOR_EVERY === 0;
    lines.push(
      <Line
        key={`x${x}`}
        points={[x, 0, x, stock.height]}
        stroke={major ? colors.gridMajor : colors.grid}
        strokeWidth={1}
        strokeScaleEnabled={false}
      />,
    );
  }
  for (let y = GRID_MM; y < stock.height; y += GRID_MM) {
    const major = Math.round(y / GRID_MM) % MAJOR_EVERY === 0;
    lines.push(
      <Line
        key={`y${y}`}
        points={[0, y, stock.width, y]}
        stroke={major ? colors.gridMajor : colors.grid}
        strokeWidth={1}
        strokeScaleEnabled={false}
      />,
    );
  }

  const o = anchorPoint(stock, origin);
  const px = (screenPixels: number) => screenPixels / scale;

  return (
    <Layer listening={false}>
      <Rect
        width={stock.width}
        height={stock.height}
        fill={colors.stockFill}
        stroke={colors.stockEdge}
        strokeWidth={1}
        strokeScaleEnabled={false}
      />
      {lines}
      {/* Machine +X points right, +Y points up (canvas Y is flipped). */}
      <Arrow
        points={[o.x, o.y, o.x + px(28), o.y]}
        stroke={colors.axisX}
        fill={colors.axisX}
        strokeWidth={2}
        strokeScaleEnabled={false}
        pointerLength={px(7)}
        pointerWidth={px(7)}
      />
      <Arrow
        points={[o.x, o.y, o.x, o.y - px(28)]}
        stroke={colors.axisY}
        fill={colors.axisY}
        strokeWidth={2}
        strokeScaleEnabled={false}
        pointerLength={px(7)}
        pointerWidth={px(7)}
      />
      <Circle x={o.x} y={o.y} radius={px(4)} fill={colors.pathSelected} />
    </Layer>
  );
}
