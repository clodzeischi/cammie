import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeObject, pocketOp, profileOp } from '../../core/cam/testFixtures';
import { useJobStore } from '../../state/jobStore';
import { useModeStore } from '../../state/modeStore';
import { EASY_BLOCKED_MESSAGE, ModeSwitch } from './ModeSwitch';

describe('ModeSwitch', () => {
  beforeEach(() => {
    act(() => {
      useJobStore.getState().clearDesign();
      useModeStore.getState().setMode('pro');
    });
  });

  it('switches to Easy when the job fits', async () => {
    useJobStore.getState().addObject(makeObject({ id: 'a' }), profileOp());
    render(<ModeSwitch />);
    await userEvent.click(screen.getByRole('switch', { name: 'Pro mode' }));
    expect(useModeStore.getState().mode).toBe('easy');
  });

  it('blocks Easy while Pro features are in use, and says why', () => {
    act(() => {
      useJobStore.getState().addObject(makeObject({ id: 'a' }), profileOp());
      useJobStore.getState().addObject(makeObject({ id: 'b' }), pocketOp());
    });
    const { container } = render(<ModeSwitch />);
    expect(screen.getByRole('switch', { name: 'Pro mode' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Easy' })).toBeDisabled();
    expect(container.firstElementChild).toHaveAttribute('title', EASY_BLOCKED_MESSAGE);
    expect(useModeStore.getState().mode).toBe('pro');
  });
});
