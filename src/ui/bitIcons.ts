import type { Bit } from '../core/tools/bits';
import type { IconName } from './icons/Icon';

const ICON: Record<Bit['type'], IconName> = { flat: 'flatBit', vbit: 'vBit', round: 'roundBit' };

/** The icon that shows a bit's shape. */
export const bitIcon = (bit: Bit | undefined): IconName => (bit ? ICON[bit.type] : 'flatBit');
