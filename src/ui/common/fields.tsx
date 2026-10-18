import { useId, useState, type ReactNode } from 'react';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
}

function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const id = useId();
  return (
    <div className={error ? 'field field-invalid' : 'field'}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  error?: string;
  hint?: ReactNode;
  /** Shown when the value is empty (NaN), e.g. "Auto". */
  placeholder?: string;
}

const formatNumber = (value: number) =>
  Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : '';

/**
 * Number input that lets the user type freely ("1.", "") without the value
 * snapping back. While focused it shows what's typed; otherwise it shows
 * `value`, so outside changes (dragging on the canvas, a reset) appear.
 * An empty or unparseable entry is reported as NaN so validation can flag it.
 */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  step,
  min,
  error,
  hint,
  placeholder,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {(id) => (
        <div className="input-with-unit">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            step={step ?? 'any'}
            min={min}
            placeholder={placeholder}
            value={draft ?? formatNumber(value)}
            aria-invalid={error ? true : undefined}
            onFocus={() => setDraft(formatNumber(value))}
            onBlur={() => setDraft(null)}
            onChange={(e) => {
              setDraft(e.target.value);
              onChange(e.target.value === '' ? Number.NaN : Number(e.target.value));
            }}
          />
          {unit && <span className="unit">{unit}</span>}
        </div>
      )}
    </FieldShell>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: ReactNode;
}

export function TextAreaField({ label, value, onChange, placeholder, hint }: TextAreaFieldProps) {
  return (
    <FieldShell label={label} hint={hint}>
      {(id) => (
        <textarea
          id={id}
          rows={3}
          spellCheck={false}
          className="code-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </FieldShell>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <FieldShell label={label}>
      {(id) => (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}
