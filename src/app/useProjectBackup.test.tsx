import { act, renderHook } from '@testing-library/react';
import { makeObject } from '../core/cam/testFixtures';
import type { ProjectBackup } from '../persistence/projectBackup';
import { parseProject, serializeProject } from '../persistence/projectFile';
import { useJobStore } from '../state/jobStore';
import { currentProject } from '../state/projectActions';
import { useProjectBackup } from './useProjectBackup';

function fakeBackup(initial: string | null): ProjectBackup & { saved: string[] } {
  const saved: string[] = [];
  return {
    saved,
    save: async (text) => {
      saved.push(text);
      return true;
    },
    load: async () => initial,
  };
}

describe('useProjectBackup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useJobStore.getState().clearDesign();
  });
  afterEach(() => vi.useRealTimers());

  it('restores the last design on start-up and says so', async () => {
    useJobStore.getState().addObject(makeObject({ id: 'kept' }));
    const text = serializeProject(currentProject());
    useJobStore.getState().clearDesign();

    const { result } = renderHook(() => useProjectBackup(fakeBackup(text)));
    await act(async () => {});
    expect(useJobStore.getState().objects.map((o) => o.id)).toEqual(['kept']);
    expect(result.current).toMatch(/design from last time is back/);
  });

  it('saves shortly after changes, once', async () => {
    const backup = fakeBackup(null);
    renderHook(() => useProjectBackup(backup));
    await act(async () => {});
    act(() => {
      useJobStore.getState().addObject(makeObject({ id: 'a' }));
      useJobStore.getState().setJobName('Sign');
    });
    expect(backup.saved).toEqual([]);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(backup.saved).toHaveLength(1);
    const saved = parseProject(backup.saved[0]!);
    expect(saved.ok && saved.project.jobName).toBe('Sign');
  });
});
