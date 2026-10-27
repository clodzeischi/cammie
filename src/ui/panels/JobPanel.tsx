import { MATERIALS } from '../../core/materials/materials';
import { useJobStore } from '../../state/jobStore';
import { useModeStore } from '../../state/modeStore';
import { NumberField, SelectField } from '../common/fields';
import { OriginPicker } from './OriginPicker';
import { TwoSidedFields } from './TwoSidedFields';

const MATERIAL_OPTIONS = MATERIALS.map((m) => ({ value: m.id, label: m.name }));

/** Shown when nothing is selected: stock, origin and material. */
export function JobPanel() {
  const stock = useJobStore((s) => s.stock);
  const origin = useJobStore((s) => s.origin);
  const materialId = useJobStore((s) => s.materialId);
  const setStock = useJobStore((s) => s.setStock);
  const setOrigin = useJobStore((s) => s.setOrigin);
  const setMaterial = useJobStore((s) => s.setMaterial);
  const pro = useModeStore((s) => s.mode === 'pro');

  // Ignore half-typed values; the field shows what's typed until it's valid.
  const positive = (apply: (v: number) => void) => (v: number) => {
    if (Number.isFinite(v) && v > 0) apply(v);
  };

  return (
    <section className="panel" aria-label="Job">
      <h2 className="panel-title">Job</h2>
      <fieldset>
        <legend>Stock</legend>
        <div className="field-row">
          <NumberField
            label="Width"
            unit="mm"
            value={stock.width}
            onChange={positive((width) => setStock({ width }))}
          />
          <NumberField
            label="Height"
            unit="mm"
            value={stock.height}
            onChange={positive((height) => setStock({ height }))}
          />
        </div>
        <NumberField
          label="Thickness"
          unit="mm"
          value={stock.thickness}
          onChange={positive((thickness) => setStock({ thickness }))}
        />
        <SelectField
          label="Material"
          value={materialId}
          options={MATERIAL_OPTIONS}
          onChange={setMaterial}
        />
      </fieldset>
      <OriginPicker value={origin} onChange={setOrigin} />
      {pro && <TwoSidedFields />}
      <p className="muted small">Select an object on the canvas to set how it's cut.</p>
    </section>
  );
}
