import { useState } from 'react';
import { BUILT_IN_BITS, type Bit } from '../../core/tools/bits';
import { useToolingStore } from '../../state/toolingStore';
import { Modal } from '../common/Modal';
import { BitForm } from './BitForm';

interface BitLibraryDialogProps {
  onClose: () => void;
}

/** A blank custom bit: a 1/8" two-flute end mill, ready to adjust. */
const newBitDraft = (): Bit => ({
  id: `custom-${crypto.randomUUID()}`,
  name: '',
  type: 'flat',
  diameter: 3.175,
  flutes: 2,
});

const describe = (bit: Bit) =>
  bit.type === 'vbit'
    ? `${bit.angle}° V, tip ${bit.tipDiameter} mm, Ø ${bit.diameter} mm`
    : `Ø ${bit.diameter} mm, ${bit.flutes}-flute`;

/** Built-in bits (read-only) and the user's own, which are saved in the browser. */
export function BitLibraryDialog({ onClose }: BitLibraryDialogProps) {
  const customBits = useToolingStore((s) => s.customBits);
  const saveBit = useToolingStore((s) => s.saveBit);
  const removeBit = useToolingStore((s) => s.removeBit);
  const [editing, setEditing] = useState<Bit | null>(null);

  return (
    <Modal
      title={editing ? 'Edit bit' : 'Bits'}
      onClose={onClose}
      footer={
        editing ? null : (
          <>
            <button type="button" className="button" onClick={() => setEditing(newBitDraft())}>
              Add a bit
            </button>
            <span className="spacer" />
            <button type="button" className="button button-primary" onClick={onClose}>
              Done
            </button>
          </>
        )
      }
    >
      {editing ? (
        <BitForm
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(bit) => {
            saveBit(bit);
            setEditing(null);
          }}
        />
      ) : (
        <div className="bit-library">
          <h3 className="panel-subtitle">Your bits</h3>
          {customBits.length === 0 ? (
            <p className="muted small">
              None yet. Add the bits you own that aren't in the list below.
            </p>
          ) : (
            <ul className="bit-list">
              {customBits.map((bit) => (
                <li key={bit.id}>
                  <span>
                    <strong>{bit.name}</strong>
                    <span className="muted small"> {describe(bit)}</span>
                  </span>
                  <span className="bit-actions">
                    <button type="button" className="link-button" onClick={() => setEditing(bit)}>
                      Edit
                    </button>
                    <button type="button" className="link-button" onClick={() => removeBit(bit.id)}>
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="panel-subtitle">Built in</h3>
          <ul className="bit-list">
            {BUILT_IN_BITS.map((bit) => (
              <li key={bit.id}>
                <span>
                  {bit.name}
                  <span className="muted small"> {describe(bit)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
