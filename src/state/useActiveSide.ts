import type { SideView } from '../core/job/faces';
import { activeSide, useJobStore } from './jobStore';
import { useModeStore } from './modeStore';

/** The side being shown: Pro's choice in a two-sided job, otherwise both. */
export function useActiveSide(): SideView {
  const side = useJobStore(activeSide);
  const pro = useModeStore((s) => s.mode === 'pro');
  return pro ? side : 'both';
}
