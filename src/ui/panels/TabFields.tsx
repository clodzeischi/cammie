import type { TabSettings } from '../../core/job/job';
import { NumberField } from '../common/fields';

interface TabFieldsProps {
  tabs: TabSettings;
  /** Default tab width for the current bit, shown when width is automatic. */
  autoWidth: number;
  /** Whether the cut goes deep enough for tabs to matter. */
  through: boolean;
  onChange: (tabs: TabSettings) => void;
}

/** Tabs that hold a cut-out part in place (SPEC.md §9.3). */
export function TabFields({ tabs, autoWidth, through, onChange }: TabFieldsProps) {
  const set = (patch: Partial<TabSettings>) => onChange({ ...tabs, ...patch });
  const optional = (v: number) => (Number.isFinite(v) && v > 0 ? v : null);

  return (
    <fieldset>
      <legend>Tabs</legend>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={tabs.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
        />
        Hold the part with tabs
      </label>
      {tabs.enabled && (
        <>
          {!through && (
            <p className="field-hint">
              Tabs only apply once the cut goes deeper than the tab height.
            </p>
          )}
          <div className="field-row">
            <NumberField
              label="Per loop"
              placeholder="Auto"
              value={tabs.count ?? Number.NaN}
              onChange={(v) => set({ count: optional(Math.round(v)) })}
            />
            <NumberField
              label="Height"
              unit="mm"
              value={tabs.height}
              onChange={(height) => Number.isFinite(height) && height > 0 && set({ height })}
            />
          </div>
          <NumberField
            label="Length"
            unit="mm"
            placeholder={`Auto (${Math.round(autoWidth * 10) / 10})`}
            value={tabs.width ?? Number.NaN}
            hint="Includes the bit, so the tab left on the part is about this minus the bit diameter."
            onChange={(v) => set({ width: optional(v) })}
          />
          <p className="field-hint">
            {tabs.manual ? `${tabs.manual.length} tab(s) placed by hand.` : 'Placed automatically.'}{' '}
            Click the toolpath in Toolpath preview to add or remove tabs.
          </p>
          {tabs.manual && (
            <button type="button" className="link-button" onClick={() => set({ manual: null })}>
              Go back to automatic tabs
            </button>
          )}
        </>
      )}
    </fieldset>
  );
}
