import { MATERIALS } from '../../core/materials/materials';
import { setEasyBit } from '../../state/cutActions';
import { useJobStore } from '../../state/jobStore';
import { easyBitId, useModeStore } from '../../state/modeStore';
import { useToolingStore } from '../../state/toolingStore';
import { bitIcon } from '../bitIcons';
import { Icon } from '../icons/Icon';

/** Easy: the job's material and its one bit, right in the header. */
export function EasyJobPickers() {
  const materialId = useJobStore((s) => s.materialId);
  const setMaterial = useJobStore((s) => s.setMaterial);
  const toolpaths = useJobStore((s) => s.toolpaths);
  const remembered = useModeStore((s) => s.easyBitId);
  const bits = useToolingStore((s) => s.bits);
  const bitId = easyBitId(toolpaths, remembered);

  return (
    <div className="header-pickers">
      <label className="picker" title="Material">
        <Icon name="material" size={16} />
        <span className="visually-hidden">Material</span>
        <select value={materialId} onChange={(e) => setMaterial(e.target.value)}>
          {MATERIALS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label className="picker" title="The bit for every cut in this job">
        <Icon name={bitIcon(bits.find((b) => b.id === bitId))} size={16} />
        <span className="visually-hidden">Bit</span>
        <select value={bitId} onChange={(e) => setEasyBit(e.target.value)}>
          {bits.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
