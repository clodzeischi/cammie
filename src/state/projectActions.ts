import type { Project } from '../persistence/projectFile';
import { useJobStore } from './jobStore';
import { useToolingStore } from './toolingStore';

/** The design as it would be saved. */
export function currentProject(): Project {
  const { stock, origin, materialId, objects, toolpaths, flip, jobName } = useJobStore.getState();
  return {
    jobName,
    job: { stock, origin, materialId, objects, toolpaths, flip },
    bits: useToolingStore.getState().customBits,
  };
}

/**
 * Opens a project. Custom bits it brings along join the library unless a bit
 * with that id is already there (the user's own version wins).
 */
export function openProject(project: Project) {
  const tooling = useToolingStore.getState();
  project.bits
    .filter((bit) => !tooling.bits.some((b) => b.id === bit.id))
    .forEach((bit) => tooling.saveBit(bit));
  useJobStore.getState().loadProject(project);
}
