import { useEffect, useRef, useState } from 'react';
import { createIndexedDbBackup, type ProjectBackup } from '../persistence/projectBackup';
import { parseProject, serializeProject } from '../persistence/projectFile';
import { useJobStore, type JobState } from '../state/jobStore';
import { currentProject, openProject } from '../state/projectActions';

/** Wait this long (ms) after the last change before writing the backup. */
const SAVE_DELAY_MS = 800;

const designOf = (s: JobState) => [
  s.objects,
  s.toolpaths,
  s.stock,
  s.origin,
  s.materialId,
  s.flip,
  s.jobName,
];
const changed = (a: JobState, b: JobState) => designOf(a).some((v, i) => v !== designOf(b)[i]);

/**
 * Keeps a copy of the design in the browser (SPEC.md §13.4): restores it on
 * start-up, saves it shortly after every change, and only asks before leaving
 * the page when that copy couldn't be saved. Returns a note to show once
 * after a restore.
 */
export function useProjectBackup(backup: ProjectBackup = defaultBackup()): string | null {
  const [restored, setRestored] = useState<string | null>(null);
  const backedUp = useRef(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ready = false;
    const save = () => {
      backedUp.current = false;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        backedUp.current = await backup.save(serializeProject(currentProject()));
      }, SAVE_DELAY_MS);
    };
    const unsubscribe = useJobStore.subscribe((state, previous) => {
      if (ready && changed(state, previous)) save();
    });

    void backup.load().then((text) => {
      if (cancelled) return;
      const parsed = text ? parseProject(text) : null;
      // Don't replace anything the user has already started on.
      if (parsed?.ok && parsed.project.job.objects.length > 0 && !hasDesign()) {
        openProject(parsed.project);
        setRestored('Your design from last time is back. Use New to start over.');
      }
      ready = true;
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [backup]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasDesign() && !backedUp.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return restored;
}

const hasDesign = () => useJobStore.getState().objects.length > 0;

let shared: ProjectBackup | null = null;
/** One backup for the page, created on first use (keeps the hook's default stable). */
function defaultBackup(): ProjectBackup {
  shared ??= createIndexedDbBackup();
  return shared;
}
