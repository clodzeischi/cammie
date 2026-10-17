import { Circle, Layer, Line } from 'react-konva';
import type { CanvasColors } from './canvasColors';
import { completedRuns, type ProgramPreview, type ToolpathRun } from './toolpathRuns';

interface ToolpathLayerProps {
  previews: ProgramPreview[];
  /** Which program the scrubber controls. */
  activeIndex: number;
  /** Moves of the active program shown as done. */
  done: number;
  showCutWidth: boolean;
  scale: number;
  colors: CanvasColors;
}

/** Cuts as solid lines, rapids dashed; the active file brighter, with a tool marker. */
export function ToolpathLayer(props: ToolpathLayerProps) {
  const { previews, activeIndex, done, showCutWidth, scale, colors } = props;
  const colorFor = (i: number) => colors.toolpaths[i % colors.toolpaths.length]!;

  const drawRuns = (runs: ToolpathRun[], color: string, opacity: number, keyPrefix: string) =>
    runs.map((run, i) =>
      run.kind === 'rapid' ? (
        <Line
          key={`${keyPrefix}${i}`}
          points={run.points}
          stroke={colors.rapid}
          strokeWidth={1}
          dash={[4 / scale, 4 / scale]}
          opacity={opacity}
          strokeScaleEnabled={false}
          perfectDrawEnabled={false}
        />
      ) : (
        <Line
          key={`${keyPrefix}${i}`}
          points={run.points}
          stroke={color}
          opacity={showCutWidth ? opacity * 0.7 : opacity}
          strokeWidth={showCutWidth ? run.width : 1.5}
          strokeScaleEnabled={showCutWidth}
          lineCap="round"
          lineJoin="round"
          perfectDrawEnabled={false}
        />
      ),
    );

  const active = previews[activeIndex];
  const tool = active?.positions[Math.min(done, active.moveCount)];

  return (
    <Layer listening={false}>
      {previews.map((preview, i) =>
        drawRuns(preview.runs, colorFor(i), i === activeIndex ? 0.25 : 0.15, `all${i}-`),
      )}
      {active && drawRuns(completedRuns(active, done), colorFor(activeIndex), 1, 'done-')}
      {tool && done < (active?.moveCount ?? 0) && (
        <Circle
          x={tool.x}
          y={tool.y}
          radius={5 / scale}
          fill={colorFor(activeIndex)}
          stroke="#fff"
          strokeWidth={1.5}
          strokeScaleEnabled={false}
        />
      )}
    </Layer>
  );
}
