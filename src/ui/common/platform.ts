/** Macs use ⌘ for shortcuts; everything else uses Ctrl. */
export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Shown in tooltips, e.g. `${MOD_KEY}Z`. */
export const MOD_KEY = IS_MAC ? '⌘' : 'Ctrl+';
