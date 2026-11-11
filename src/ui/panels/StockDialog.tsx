import { MATERIALS } from '../../core/materials/materials';
import { useJobStore } from '../../state/jobStore';
import { NumberField, SelectField } from '../common/fields';
import { Modal } from '../common/Modal';
import { OriginPicker } from './AnchorPicker';

const MATERIAL_OPTIONS = MATERIALS.map((m) => ({ value: m.id, label: m.name }));

interface StockDialogProps {
  onClose: () => void;
}

/**
 * Stock size, material and work origin (Setup → Stock & material, or the
 * summary in the header). Changes apply as they're typed and are remembered
 * for the next job.
 */
export function StockDialog({ onClose }: StockDialogProps) {
  const stock = useJobStore((s) => s.stock);
  const origin = useJobStore((s) => s.origin);
  const materialId = useJobStore((s) => s.materialId);
  const setStock = useJobStore((s) => s.setStock);
  const setOrigin = useJobStore((s) => s.setOrigin);
  const setMaterial = useJobStore((s) => s.setMaterial);

  // Ignore half-typed values; the field shows what's typed until it's valid.
  const positive = (apply: (v: number) => void) => (v: number) => {
    if (Number.isFinite(v) && v > 0) apply(v);
  };

  return (
    <Modal
      title="Stock & material"
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="button button-primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
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
    </Modal>
  );
}
