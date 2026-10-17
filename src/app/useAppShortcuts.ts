import { useEffect } from 'react';
import { useJobStore } from '../state/jobStore';

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Delete/Backspace removes the selected object; Escape deselects.
 * Also warns before leaving the page with a design open, since nothing is saved.
 */
export function useAppShortcuts() {
  const hasObjects = useJobStore((s) => s.objects.length > 0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const { selectedId, removeObject, select } = useJobStore.getState();
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault();
        removeObject(selectedId);
      } else if (event.key === 'Escape' && selectedId) {
        select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!hasObjects) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasObjects]);
}
