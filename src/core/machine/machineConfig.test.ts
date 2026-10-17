import { DEFAULT_MACHINE_CONFIG, rpmToSValue } from './machineConfig';
import { validateMachineConfig } from './validateMachineConfig';

describe('rpmToSValue', () => {
  const config = { ...DEFAULT_MACHINE_CONFIG, maxSpindleRpm: 10000, maxSValue: 1000 };

  it('scales RPM linearly onto the $30 range', () => {
    expect(rpmToSValue(10000, config)).toBe(1000);
    expect(rpmToSValue(5000, config)).toBe(500);
    expect(rpmToSValue(0, config)).toBe(0);
  });

  it('clamps to the machine range', () => {
    expect(rpmToSValue(20000, config)).toBe(1000);
    expect(rpmToSValue(-50, config)).toBe(0);
  });

  it('rounds to a whole S value', () => {
    expect(rpmToSValue(3333, config)).toBe(333);
  });
});

describe('validateMachineConfig', () => {
  it('accepts the defaults', () => {
    expect(validateMachineConfig(DEFAULT_MACHINE_CONFIG)).toEqual([]);
  });

  it('rejects zero, negative and non-numeric limits', () => {
    const errors = validateMachineConfig({
      ...DEFAULT_MACHINE_CONFIG,
      workArea: { x: 0, y: -1, z: Number.NaN },
      spindleDwell: -1,
    });
    expect(errors.map((e) => e.field)).toEqual([
      'workArea.x',
      'workArea.y',
      'workArea.z',
      'spindleDwell',
    ]);
  });

  it('rejects a safe Z taller than the Z travel', () => {
    const errors = validateMachineConfig({ ...DEFAULT_MACHINE_CONFIG, safeZ: 60 });
    expect(errors).toEqual([{ field: 'safeZ', message: 'Safe Z must fit within the Z travel.' }]);
  });

  it('validates park coordinates only in park mode', () => {
    const errors = validateMachineConfig({
      ...DEFAULT_MACHINE_CONFIG,
      endPosition: { mode: 'park', x: -5, y: 10 },
    });
    expect(errors.map((e) => e.field)).toEqual(['endPosition.x']);
  });
});
