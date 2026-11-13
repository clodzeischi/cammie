import { findMaterial } from '../../core/materials/materials';
import { useDialogStore } from '../../state/dialogStore';
import { useJobStore } from '../../state/jobStore';
import { Icon } from '../icons/Icon';

const mm = (v: number) => String(Math.round(v * 100) / 100);

/**
 * The stock in one quiet line beside the job name ("MDF · 200 × 150 × 12 mm"):
 * set once per job, so it stays out of the way. The only way to change the
 * stock: it opens the stock, material and origin dialog.
 */
export function StockButton() {
  const stock = useJobStore((s) => s.stock);
  const material = useJobStore((s) => findMaterial(s.materialId)?.name ?? 'No material');
  const show = useDialogStore((s) => s.show);
  // "Plywood (birch)" → "Plywood": the details are in the dialog.
  const short = material.replace(/\s*\(.*\)$/, '').replace(/,.*$/, '');
  return (
    <button
      type="button"
      className="stock-button"
      title="Stock size, material and work origin"
      onClick={() => show('stock')}
    >
      <Icon name="stock" size={15} />
      <span>
        {short} · {mm(stock.width)} × {mm(stock.height)} × {mm(stock.thickness)} mm
      </span>
    </button>
  );
}
