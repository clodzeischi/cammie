import type { MachineConfig } from './machineConfig';

/** A problem with one field, keyed by a dotted path such as `workArea.x`. */
export interface FieldError {
  field: string;
  message: string;
}

function checkNumber(
  field: string,
  value: number,
  label: string,
  allowZero: boolean,
): FieldError[] {
  if (!Number.isFinite(value)) return [{ field, message: `${label} needs a number.` }];
  if (allowZero ? value < 0 : value <= 0) {
    const rule = allowZero ? "can't be negative" : 'must be greater than 0';
    return [{ field, message: `${label} ${rule}.` }];
  }
  return [];
}

const positive = (field: string, value: number, label: string) =>
  checkNumber(field, value, label, false);

const nonNegative = (field: string, value: number, label: string) =>
  checkNumber(field, value, label, true);

/** Returns every problem with the config. An empty list means it's valid. */
export function validateMachineConfig(config: MachineConfig): FieldError[] {
  const errors: FieldError[] = [
    ...positive('workArea.x', config.workArea.x, 'Work area X'),
    ...positive('workArea.y', config.workArea.y, 'Work area Y'),
    ...positive('workArea.z', config.workArea.z, 'Work area Z'),
    ...positive('maxFeedXY', config.maxFeedXY, 'Max XY feed'),
    ...positive('maxFeedZ', config.maxFeedZ, 'Max Z feed'),
    ...positive('safeZ', config.safeZ, 'Safe Z'),
  ];
  // With a hand-switched spindle these are hidden and never used.
  if (!config.manualSpindle) {
    errors.push(
      ...positive('maxSpindleRpm', config.maxSpindleRpm, 'Max spindle RPM'),
      ...positive('maxSValue', config.maxSValue, 'Max S value'),
      ...nonNegative('spindleDwell', config.spindleDwell, 'Spindle dwell'),
    );
  }

  if (Number.isFinite(config.safeZ) && config.safeZ > config.workArea.z) {
    errors.push({ field: 'safeZ', message: 'Safe Z must fit within the Z travel.' });
  }

  const end = config.endPosition;
  if (end.mode === 'park') {
    errors.push(...nonNegative('endPosition.x', end.x, 'Park X'));
    errors.push(...nonNegative('endPosition.y', end.y, 'Park Y'));
  }

  return errors;
}
