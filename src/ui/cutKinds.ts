import type { CutKind } from '../core/job/objectFactory';
import type { IconName } from './icons/Icon';

interface CutKindInfo {
  /** What it does, in plain words: the cut's name everywhere in the app. */
  name: string;
  /** The usual CAM term, shown underneath for people who know it. */
  term: string;
  icon: IconName;
  /** CSS colour token for this kind of cut (canvas shading, list icons). */
  color: string;
}

export const CUT_KINDS: Record<CutKind, CutKindInfo> = {
  on: {
    name: 'Engrave the line',
    term: 'Engrave',
    icon: 'engrave',
    color: 'var(--cut-on)',
  },
  outside: {
    name: 'Cut it out',
    term: 'Profile outside',
    icon: 'profile',
    color: 'var(--cut-outside)',
  },
  inside: {
    name: 'Cut a hole',
    term: 'Profile inside',
    icon: 'profileIn',
    color: 'var(--cut-inside)',
  },
  pocket: {
    name: 'Clear the inside',
    term: 'Pocket',
    icon: 'pocket',
    color: 'var(--cut-pocket)',
  },
  vcarve: {
    name: 'Carve with a V-bit',
    term: 'V-carve',
    icon: 'vcarve',
    color: 'var(--cut-vcarve)',
  },
  chamfer: {
    name: 'Bevel the edges',
    term: 'Chamfer',
    icon: 'chamfer',
    color: 'var(--cut-chamfer)',
  },
  drill: {
    name: 'Drill',
    term: 'Drill',
    icon: 'drill',
    color: 'var(--cut-drill)',
  },
};

/** Menu order: lines, cut-outs and holes, clearing and carving, then finishing touches. */
export const CUT_KIND_ORDER: readonly CutKind[] = [
  'on',
  'outside',
  'inside',
  'pocket',
  'vcarve',
  'chamfer',
  'drill',
];
