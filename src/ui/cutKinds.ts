import type { CutKind } from '../core/job/objectFactory';
import type { IconName } from './icons/Icon';

interface CutKindInfo {
  /** What it does, in plain words: the cut's name everywhere in the app. */
  name: string;
  /** The usual CAM term, shown underneath for people who know it. */
  term: string;
  /** Where the bit runs, for menus and tooltips. */
  hint: string;
  icon: IconName;
  /** CSS colour token for this kind of cut (canvas shading, list icons). */
  color: string;
}

export const CUT_KINDS: Record<CutKind, CutKindInfo> = {
  on: {
    name: 'Engrave the line',
    term: 'Engrave',
    hint: 'The bit follows the line',
    icon: 'engrave',
    color: 'var(--cut-on)',
  },
  outside: {
    name: 'Cut it out',
    term: 'Profile outside',
    hint: 'Cuts around the outside, so the part comes out at its drawn size',
    icon: 'profile',
    color: 'var(--cut-outside)',
  },
  inside: {
    name: 'Cut a hole',
    term: 'Profile inside',
    hint: 'Cuts around the inside, so the hole comes out at its drawn size',
    icon: 'profileIn',
    color: 'var(--cut-inside)',
  },
  pocket: {
    name: 'Clear the inside',
    term: 'Pocket',
    hint: 'Hollows out the whole area to a depth',
    icon: 'pocket',
    color: 'var(--cut-pocket)',
  },
  vcarve: {
    name: 'Carve with a V-bit',
    term: 'V-carve',
    hint: 'Carves inside the shape, deeper where it is wider, with sharp corners',
    icon: 'vcarve',
    color: 'var(--cut-vcarve)',
  },
  chamfer: {
    name: 'Bevel the edges',
    term: 'Chamfer',
    hint: 'Bevels the edges with a V-bit',
    icon: 'chamfer',
    color: 'var(--cut-chamfer)',
  },
  drill: {
    name: 'Drill',
    term: 'Drill',
    hint: 'Drills a bit-sized hole at the centre of each shape',
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
