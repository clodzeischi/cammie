import { Fragment } from 'react';
import { useDrawStore } from '../../state/drawStore';
import { Icon } from '../icons/Icon';
import { ImportHandler } from './ImportHandler';
import { TOOL_GROUPS, type Tool } from './tools';

/**
 * Drawing and adding tools down the left edge: icons with tooltips (name,
 * what it does and its key), like the tool bar of a drawing app.
 */
export function ToolRail() {
  // Re-render when the drawing tool changes, so the pressed state follows it.
  useDrawStore((s) => s.tool);
  return (
    <nav className="tool-rail" aria-label="Tools">
      {TOOL_GROUPS.map((group, i) => (
        <Fragment key={i}>
          {i > 0 && <hr className="tool-rail-divider" />}
          {group.map((tool) => (
            <ToolButton key={tool.id} tool={tool} />
          ))}
        </Fragment>
      ))}
      <ImportHandler />
    </nav>
  );
}

function ToolButton({ tool }: { tool: Tool }) {
  return (
    <button
      type="button"
      className="tool-button"
      title={`${tool.label} (${tool.key.toUpperCase()}): ${tool.hint}`}
      aria-label={tool.label}
      aria-pressed={tool.active ? tool.active() : undefined}
      onClick={tool.run}
    >
      <Icon name={tool.icon} size={22} />
    </button>
  );
}
