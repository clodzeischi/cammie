import { useId, type ReactNode } from 'react';

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  /** Optional small control shown next to the label (e.g. an "Auto" button). */
  action?: ReactNode;
}

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  action,
}: RangeFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <div className="range-label">
        <label htmlFor={id}>{label}</label>
        <span className="range-value">
          {value}
          {unit && ` ${unit}`}
        </span>
        {action}
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
