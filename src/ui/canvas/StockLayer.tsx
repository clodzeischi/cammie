import { Arrow, Circle, Layer, Line, Rect } from 'react-konva';
import type { Vec2 } from '../../core/geometry/path';
import { gridLines, majorEvery } from '../../core/job/grid';
import { anchorPoint, type OriginAnchor, type Stock } from '../../core/job/job';
import type { CanvasColors } from './canvasColors';

interface StockLayerProps {
  stock: Stock;
  origin: OriginAnchor;
  /** Screen pixels per mm, so markers keep a constant on-screen size. */
  scale: number;
  /** Grid cell size (mm). */
  gridSpacing: number;
  colors: CanvasColors;
  /** Two-sided jobs: the line the stock turns over about. */
  flipLine?: [Vec2, Vec2] | null;
}

/** Grid lines closer together than this on screen (px) are left out. */
const MIN_LINE_GAP_PX = 6;

/** The material: board, grid (through the work origin), and the X0 Y0 marker with axis arrows. */
export function StockLayer(props: StockLayerProps) {
  const { stock, origin, scale, gridSpacing, colors, flipLine } = props;
  const o = anchorPoint(stock, origin);
  // Zoomed far out, a fine grid would be a grey smear: keep only the major lines.
  const showMinor = gridSpacing * scale >= MIN_LINE_GAP_PX;
  const showMajor = gridSpacing * majorEvery(gridSpacing) * scale >= MIN_LINE_GAP_PX;
  const visible = (major: boolean) => (major ? showMajor : showMinor);
  const inside = (at: number, size: number) => at > 1e-9 && at < size - 1e-9;

  const line = (key: string, points: number[], major: boolean) => (
    <Line
      key={key}
      points={points}
      stroke={major ? colors.gridMajor : colors.grid}
      strokeWidth={1}
      strokeScaleEnabled={false}
      perfectDrawEnabled={false}
    />
  );
  const lines = [
    ...gridLines(0, stock.width, o.x, gridSpacing)
      .filter(({ at, major }) => inside(at, stock.width) && visible(major))
      .map(({ at, major }) => line(`x${at}`, [at, 0, at, stock.height], major)),
    ...gridLines(0, stock.height, o.y, gridSpacing)
      .filter(({ at, major }) => inside(at, stock.height) && visible(major))
      .map(({ at, major }) => line(`y${at}`, [0, at, stock.width, at], major)),
  ];

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
      {flipLine && (
        <Line
          points={flipLine.flatMap((p) => [p.x, p.y])}
          stroke={colors.pathSelected}
          strokeWidth={1.5}
          dash={[px(8), px(5)]}
          strokeScaleEnabled={false}
        />
      )}
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
