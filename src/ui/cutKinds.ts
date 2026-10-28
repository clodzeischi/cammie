import type { CutKind } from '../core/job/objectFactory';
import type { IconName } from './icons/Icon';

interface CutKindInfo {
  /** Pro mode's name (the usual CAM term). */
  pro: string;
  /** Easy mode's name, in plain words. */
  easy: string;
  /** What it does, for buttons and choice cards. */
  hint: string;
  icon: IconName;
  /** CSS colour token for this kind of cut. */
  color: string;
}

export const CUT_KINDS: Record<CutKind, CutKindInfo> = {
  on: {
    pro: 'Engrave',
    easy: 'Engrave line',
    hint: 'Follows the line',
    icon: 'engrave',
    color: 'var(--cut-on)',
  },
  outside: {
    pro: 'Profile outside',
    easy: 'Cut out',
    hint: 'Cuts the shape free',
    icon: 'profile',
    color: 'var(--cut-outside)',
  },
  inside: {
    pro: 'Profile inside',
    easy: 'Cut hole',
    hint: 'Cuts a hole of this shape',
    icon: 'profileIn',
    color: 'var(--cut-inside)',
  },
  pocket: {
    pro: 'Pocket',
    easy: 'Clear area',
    hint: 'Hollows out the inside',
    icon: 'pocket',
    color: 'var(--cut-pocket)',
  },
};

/** Menu and button order: lines, then cut-outs, holes and pockets. */
export const CUT_KIND_ORDER: readonly CutKind[] = ['on', 'outside', 'inside', 'pocket'];
