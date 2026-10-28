/**
 * Machine configuration: physical limits of the user's CNC and the
 * G-code snippets wrapped around every program. Units are millimetres,
 * mm/min, RPM and seconds. See SPEC.md §9.1.
 */

export type EndPosition =
  | { mode: 'origin' } // safe Z, then X0 Y0
  | { mode: 'stay' } // safe Z only
  | { mode: 'park'; x: number; y: number }; // safe Z, then X/Y

export interface MachineConfig {
  workArea: { x: number; y: number; z: number };
  maxFeedXY: number;
  maxFeedZ: number;
  /**
   * The spindle is switched on and off by hand (e.g. a speed knob on the
   * motor), so files carry no spindle commands and RPM settings don't apply.
   */
  manualSpindle: boolean;
  maxSpindleRpm: number;
  /** GRBL `$30` value: the S word that means full speed. */
  maxSValue: number;
  /** Travel height above the top of the material. */
  safeZ: number;
  /** Seconds to wait after M3 for the spindle to reach speed. */
  spindleDwell: number;
  customHeader: string;
  customFooter: string;
  endPosition: EndPosition;
}

export const DEFAULT_MACHINE_CONFIG: MachineConfig = {
  workArea: { x: 300, y: 180, z: 45 },
  maxFeedXY: 1000,
  maxFeedZ: 500,
  manualSpindle: false,
  maxSpindleRpm: 10000,
  maxSValue: 1000,
  safeZ: 5,
  spindleDwell: 3,
  customHeader: '',
  customFooter: '',
  endPosition: { mode: 'origin' },
};

/** Map a spindle speed in RPM to a GRBL S value, clamped to the machine's range. */
export function rpmToSValue(rpm: number, config: MachineConfig): number {
  const clamped = Math.min(Math.max(rpm, 0), config.maxSpindleRpm);
  return Math.round((clamped / config.maxSpindleRpm) * config.maxSValue);
}
