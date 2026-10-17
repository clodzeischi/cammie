import { useState } from 'react';
import { DEFAULT_MACHINE_CONFIG } from '../../core/machine/machineConfig';
import { validateMachineConfig } from '../../core/machine/validateMachineConfig';
import { useMachineStore } from '../../state/machineStore';
import { Modal } from '../common/Modal';
import { MachineSettingsForm } from './MachineSettingsForm';

interface MachineSettingsDialogProps {
  onClose: () => void;
}

/** Edits a draft copy of the machine config; nothing is saved until "Save". */
export function MachineSettingsDialog({ onClose }: MachineSettingsDialogProps) {
  const saved = useMachineStore((s) => s.config);
  const save = useMachineStore((s) => s.save);

  const [draft, setDraft] = useState(saved);
  // Number fields are uncontrolled; bumping the key reloads them after a reset.
  const [formKey, setFormKey] = useState(0);
  const errors = validateMachineConfig(draft);

  const resetToDefaults = () => {
    setDraft(structuredClone(DEFAULT_MACHINE_CONFIG));
    setFormKey((k) => k + 1);
  };

  const handleSave = () => {
    save(draft);
    onClose();
  };

  return (
    <Modal
      title="Machine settings"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button-quiet" onClick={resetToDefaults}>
            Reset to defaults
          </button>
          <span className="spacer" />
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={errors.length > 0}
            onClick={handleSave}
          >
            Save
          </button>
        </>
      }
    >
      <MachineSettingsForm key={formKey} config={draft} errors={errors} onChange={setDraft} />
    </Modal>
  );
}
