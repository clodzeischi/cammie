import type { EndPosition, MachineConfig } from '../../core/machine/machineConfig';
import type { FieldError } from '../../core/machine/validateMachineConfig';
import { NumberField, SelectField, TextAreaField } from '../common/fields';

interface MachineSettingsFormProps {
  config: MachineConfig;
  errors: FieldError[];
  onChange: (config: MachineConfig) => void;
}

const END_OPTIONS = [
  { value: 'origin', label: 'Raise to safe Z, return to X0 Y0' },
  { value: 'stay', label: 'Raise to safe Z, stay put' },
  { value: 'park', label: 'Raise to safe Z, park at X/Y' },
] as const;

export function MachineSettingsForm({ config, errors, onChange }: MachineSettingsFormProps) {
  const errorFor = (field: string) => errors.find((e) => e.field === field)?.message;
  const set = (patch: Partial<MachineConfig>) => onChange({ ...config, ...patch });
  const setArea = (axis: 'x' | 'y' | 'z', value: number) =>
    set({ workArea: { ...config.workArea, [axis]: value } });

  const end = config.endPosition;
  const setEndMode = (mode: EndPosition['mode']) =>
    set({ endPosition: mode === 'park' ? { mode, x: 0, y: config.workArea.y } : { mode } });

  return (
    <div className="settings-form">
      <fieldset>
        <legend>Work area</legend>
        <div className="field-row">
          {(['x', 'y', 'z'] as const).map((axis) => (
            <NumberField
              key={axis}
              label={axis.toUpperCase()}
              unit="mm"
              value={config.workArea[axis]}
              error={errorFor(`workArea.${axis}`)}
              onChange={(v) => setArea(axis, v)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Speeds</legend>
        <div className="field-row">
          <NumberField
            label="Max XY feed"
            unit="mm/min"
            value={config.maxFeedXY}
            error={errorFor('maxFeedXY')}
            onChange={(v) => set({ maxFeedXY: v })}
          />
          <NumberField
            label="Max Z feed"
            unit="mm/min"
            value={config.maxFeedZ}
            error={errorFor('maxFeedZ')}
            onChange={(v) => set({ maxFeedZ: v })}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>Spindle</legend>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={config.manualSpindle}
            onChange={(e) => set({ manualSpindle: e.target.checked })}
          />
          Manual spindle control
        </label>
        {config.manualSpindle ? (
          <p className="field-hint">
            Files won't turn the spindle on or off or set its speed. Switch it on by hand before
            running each file, and off when it's done.
          </p>
        ) : (
          <>
            <div className="field-row">
              <NumberField
                label="Max spindle speed"
                unit="RPM"
                step={100}
                value={config.maxSpindleRpm}
                error={errorFor('maxSpindleRpm')}
                onChange={(v) => set({ maxSpindleRpm: v })}
              />
              <NumberField
                label="Max S value ($30)"
                value={config.maxSValue}
                error={errorFor('maxSValue')}
                hint="Check with $$ in gSender. Many 3018 boards use 1000."
                onChange={(v) => set({ maxSValue: v })}
              />
            </div>
            <NumberField
              label="Spindle spin-up"
              unit="s"
              value={config.spindleDwell}
              error={errorFor('spindleDwell')}
              hint="Wait after starting the spindle, before cutting."
              onChange={(v) => set({ spindleDwell: v })}
            />
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>Motion</legend>
        <NumberField
          label="Safe Z"
          unit="mm"
          value={config.safeZ}
          error={errorFor('safeZ')}
          hint="Travel height above the material."
          onChange={(v) => set({ safeZ: v })}
        />
        <SelectField
          label="When the job ends"
          value={end.mode}
          options={END_OPTIONS}
          onChange={setEndMode}
        />
        {end.mode === 'park' && (
          <div className="field-row">
            <NumberField
              label="Park X"
              unit="mm"
              value={end.x}
              error={errorFor('endPosition.x')}
              onChange={(x) => set({ endPosition: { ...end, x } })}
            />
            <NumberField
              label="Park Y"
              unit="mm"
              value={end.y}
              error={errorFor('endPosition.y')}
              onChange={(y) => set({ endPosition: { ...end, y } })}
            />
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Custom G-code</legend>
        <p className="muted small">
          Each file starts with the bit at X0 Y0, touching the top of the material. Cammie never
          homes, probes or changes offsets. Anything you add here runs exactly as written.
        </p>
        <TextAreaField
          label="Start of file"
          placeholder="(runs after the units/mode setup)"
          value={config.customHeader}
          onChange={(v) => set({ customHeader: v })}
        />
        <TextAreaField
          label="End of file"
          placeholder={
            config.manualSpindle ? '(runs at the end)' : '(runs before the spindle stops)'
          }
          value={config.customFooter}
          onChange={(v) => set({ customFooter: v })}
        />
      </fieldset>
    </div>
  );
}
