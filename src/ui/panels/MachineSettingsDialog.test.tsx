import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_MACHINE_CONFIG } from '../../core/machine/machineConfig';
import { useMachineStore } from '../../state/machineStore';
import { MachineSettingsDialog } from './MachineSettingsDialog';

const resetStore = () =>
  useMachineStore.setState({ config: structuredClone(DEFAULT_MACHINE_CONFIG) });

describe('MachineSettingsDialog', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStore();
  });

  it('saves edits to the store and localStorage', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MachineSettingsDialog onClose={onClose} />);

    const safeZ = screen.getByLabelText('Safe Z');
    await user.clear(safeZ);
    await user.type(safeZ, '8');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(useMachineStore.getState().config.safeZ).toBe(8);
    expect(window.localStorage.getItem('cammie.machine.v1')).toContain('"safeZ":8');
    expect(onClose).toHaveBeenCalled();
  });

  it('blocks saving invalid values and explains why', async () => {
    const user = userEvent.setup();
    render(<MachineSettingsDialog onClose={() => {}} />);

    await user.clear(screen.getByLabelText('Max XY feed'));

    expect(screen.getByRole('alert')).toHaveTextContent('Max XY feed needs a number.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('cancel discards the draft', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MachineSettingsDialog onClose={onClose} />);

    const safeZ = screen.getByLabelText('Safe Z');
    await user.clear(safeZ);
    await user.type(safeZ, '9');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(useMachineStore.getState().config.safeZ).toBe(DEFAULT_MACHINE_CONFIG.safeZ);
    expect(onClose).toHaveBeenCalled();
  });

  it('reset to defaults refills the fields', async () => {
    const user = userEvent.setup();
    useMachineStore.setState({ config: { ...DEFAULT_MACHINE_CONFIG, safeZ: 12 } });
    render(<MachineSettingsDialog onClose={() => {}} />);

    expect(screen.getByLabelText('Safe Z')).toHaveValue(12);
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(screen.getByLabelText('Safe Z')).toHaveValue(DEFAULT_MACHINE_CONFIG.safeZ);
  });

  it('shows park coordinates only when parking', async () => {
    const user = userEvent.setup();
    render(<MachineSettingsDialog onClose={() => {}} />);

    expect(screen.queryByLabelText('Park X')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('When the job ends'), 'park');
    expect(screen.getByLabelText('Park X')).toBeInTheDocument();
  });
});
