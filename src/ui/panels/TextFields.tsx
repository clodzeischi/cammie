import { useEffect, useRef, useState } from 'react';
import type { ObjectTransform } from '../../core/geometry/transform';
import { anchorPoint, type DesignObject, type TextAlign, type TextShape } from '../../core/job/job';
import { withSize } from '../../core/job/placement';
import { FONTS } from '../../core/text/fonts';
import { useJobStore } from '../../state/jobStore';
import { FieldShell, NumberField, SelectField } from '../common/fields';
import { applyText, takeTextFocus, type TextResult } from '../text/textEditing';

interface TextFieldsProps {
  object: DesignObject;
  shape: TextShape;
  onTransform: (transform: ObjectTransform) => void;
}

const FONT_OPTIONS = FONTS.map((f) => ({ value: f.id, label: f.name, group: f.category }));
const ALIGNS: ReadonlyArray<{ value: TextAlign; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
];
const round2 = (v: number) => Math.round(v * 100) / 100;

function statusHint(result: TextResult | null): string | undefined {
  if (!result) return undefined;
  if (result.status === 'empty') return 'Type some letters: blank text has nothing to cut.';
  if (result.status === 'failed') return `Couldn't load the font: ${result.message}`;
  if (result.status === 'ok' && result.missing.length > 0) {
    return `This font has no ${result.missing.join(' ')}, so they're left out.`;
  }
  return undefined;
}

/**
 * Text, font and spacing (SPEC.md §6.1). Sizes are shown as they'll be cut,
 * i.e. including any resizing done on the canvas.
 */
export function TextFields({ object, shape, onTransform }: TextFieldsProps) {
  const stock = useJobStore((s) => s.stock);
  const originAnchor = useJobStore((s) => s.origin);
  const [draft, setDraft] = useState<string | null>(null);
  const [result, setResult] = useState<TextResult | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { scaleX, scaleY } = object.transform;

  useEffect(() => {
    if (takeTextFocus(object.id)) textRef.current?.select();
  }, [object.id]);

  const apply = async (changes: Partial<TextShape>) => {
    const next = await applyText(object.id, { ...shape, ...changes });
    if (next.status !== 'stale') setResult(next);
  };

  // Letter height is the object's height on the stock, so it's a resize.
  const setLetterHeight = (height: number) => {
    if (!Number.isFinite(height) || height <= 0) return;
    const factor = height / (shape.capHeight * scaleY);
    const origin = anchorPoint(stock, originAnchor);
    onTransform(withSize(object, origin, { height: object.height * scaleY * factor }, true));
  };

  return (
    <fieldset>
      <legend>Text</legend>
      <FieldShell label="Text" hint={statusHint(result)}>
        {(id) => (
          <textarea
            id={id}
            ref={textRef}
            rows={2}
            value={draft ?? shape.text}
            onFocus={() => setDraft(shape.text)}
            onBlur={() => setDraft(null)}
            onChange={(e) => {
              setDraft(e.target.value);
              void apply({ text: e.target.value });
            }}
          />
        )}
      </FieldShell>
      <SelectField
        label="Font"
        value={shape.fontId}
        options={FONT_OPTIONS}
        onChange={(fontId) => void apply({ fontId })}
      />
      <div className="field-row">
        <NumberField
          label="Letter height"
          unit="mm"
          value={round2(shape.capHeight * scaleY)}
          hint="Height of a capital letter."
          onChange={setLetterHeight}
        />
        <NumberField
          label="Letter spacing"
          unit="mm"
          value={round2(shape.letterSpacing * scaleX)}
          onChange={(v) => Number.isFinite(v) && void apply({ letterSpacing: v / scaleX })}
        />
      </div>
      <div className="field-row">
        <NumberField
          label="Line spacing"
          unit="×"
          value={shape.lineSpacing}
          onChange={(v) => Number.isFinite(v) && v > 0 && void apply({ lineSpacing: v })}
        />
        <div className="field">
          <span className="field-label">Alignment</span>
          <div className="segmented segmented-flat" role="radiogroup" aria-label="Alignment">
            {ALIGNS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={shape.align === value}
                className={shape.align === value ? 'segment segment-active' : 'segment'}
                onClick={() => void apply({ align: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </fieldset>
  );
}
