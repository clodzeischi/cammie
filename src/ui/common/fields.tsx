import { useId, type ReactNode } from 'react';

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
  error?: string;
  hint?: ReactNode;
}

/**
 * Number input that lets the user type freely ("1.", "") without the value
 * snapping back. It's uncontrolled: remount it (via `key`) to load new values.
 * An empty or unparseable entry is reported as NaN so validation can flag it.
 */
export function NumberField({ label, value, onChange, unit, step, error, hint }: NumberFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {(id) => (
        <div className="input-with-unit">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            step={step ?? 'any'}
            defaultValue={Number.isFinite(value) ? value : ''}
            aria-invalid={error ? true : undefined}
            onChange={(e) => onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
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
