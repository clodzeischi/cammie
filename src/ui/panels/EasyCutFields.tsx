import { defaultTabWidth } from '../../core/cam/profilePlan';
import { canCut, preferredBitType } from '../../core/job/bitCapabilities';
import type { Operation } from '../../core/job/job';
import { cutKindOf, THROUGH_EXTRA, type CutKind } from '../../core/job/objectFactory';
import { EASY_CUT_KINDS } from '../../core/job/toolpaths';
import { findBit } from '../../core/tools/bits';
import { setEasyCut } from '../../state/cutActions';
import { useJobStore } from '../../state/jobStore';
import { easyBitId, useModeStore } from '../../state/modeStore';
import { useToolingStore } from '../../state/toolingStore';
import { NumberField } from '../common/fields';
import { CUT_KINDS } from '../cutKinds';
import { Icon } from '../icons/Icon';
import { depthHint, round2 } from './describeCut';
import { TabFields } from './TabFields';
import { VCarveFields } from './VCarveFields';

interface EasyCutFieldsProps {
  objectIds: string[];
}

/**
 * Easy: "How should this be cut?" as a few plain choices, then just the depth
 * (and tabs for cut-outs). Feeds and entry come from the material presets.
 */
export function EasyCutFields({ objectIds }: EasyCutFieldsProps) {
  const toolpaths = useJobStore((s) => s.toolpaths);
  const thickness = useJobStore((s) => s.stock.thickness);
  const setObjectCuts = useJobStore((s) => s.setObjectCuts);
  const remembered = useModeStore((s) => s.easyBitId);
  const bits = useToolingStore((s) => s.bits);
  const bit = findBit(easyBitId(toolpaths, remembered), bits);

  const ops = objectIds.map((id) => toolpaths.find((t) => t.objectId === id)?.operation ?? null);
  const kinds = new Set(ops.map((op) => (op ? cutKindOf(op) : null)));
  const kind = kinds.size === 1 ? [...kinds][0]! : undefined;
  const first = ops.find((op): op is Operation => op !== null);
  const engraveOnly = bit ? !canCut(bit, 'outside') : false;
  const count = objectIds.length;

  /** Applies a settings change to every selected object's cut. */
  const update = (patch: (op: Operation) => Operation) =>
    setObjectCuts(
      Object.fromEntries(objectIds.map((id, i) => [id, ops[i] ? patch(ops[i]!) : null])),
    );
  const throughDepth = round2(thickness + THROUGH_EXTRA);
  const depthValid = first ? Number.isFinite(first.depth) && first.depth > 0 : true;

  return (
    <fieldset>
      <legend>{count > 1 ? `How should these ${count} be cut?` : 'How should this be cut?'}</legend>
      <div className="cut-choices">
        {EASY_CUT_KINDS.map((k: CutKind) => {
          const info = CUT_KINDS[k];
          const disabled = bit ? !canCut(bit, k) : false;
          const needs = preferredBitType(k) === 'vbit' ? 'Needs a V-bit' : 'Needs a flat end mill';
          return (
            <button
              key={k}
              type="button"
              className="cut-choice"
              aria-pressed={kind === k}
              aria-disabled={disabled}
              title={disabled ? `${needs}. Change the bit at the top.` : info.hint}
              onClick={() => !disabled && setEasyCut(objectIds, k)}
            >
              <span style={{ color: disabled ? undefined : info.color }}>
                <Icon name={info.icon} size={22} />
              </span>
              <b>{info.easy}</b>
              <small>{disabled ? needs : info.hint}</small>
            </button>
          );
        })}
      </div>
      {kinds.size > 1 && (
        <p className="field-hint">These are cut in different ways. Pick one to make them match.</p>
      )}
      {engraveOnly && (
        <p className="field-hint">
          This bit engraves lines and carves letters. To cut shapes out, pick an end mill in the Bit
          menu at the top.
        </p>
      )}

      {first?.type === 'vcarve' && kind === 'vcarve' && (
        <VCarveFields
          toolpathIds={toolpaths.filter((t) => objectIds.includes(t.objectId)).map((t) => t.id)}
          operation={first}
          bit={bit}
          thickness={thickness}
          onChange={(next) =>
            update((op) => (op.type === 'vcarve' ? { ...op, warnDepth: next.warnDepth } : op))
          }
        />
      )}
      {first && kind && kind !== 'vcarve' && (
        <>
          <NumberField
            label="Depth"
            unit="mm"
            min={0}
            value={first.depth}
            error={depthValid ? undefined : 'Depth must be greater than 0.'}
            hint={bit && depthValid ? depthHint(bit, first.depth) : undefined}
            onChange={(depth) => update((op) => ({ ...op, depth }))}
          />
          {!engraveOnly && kind !== 'on' && first.depth !== throughDepth && (
            <button
              type="button"
              className="link-button"
              onClick={() => update((op) => ({ ...op, depth: throughDepth }))}
            >
              Cut through the stock ({throughDepth} mm)
            </button>
          )}
          {first.type === 'profile' && kind !== 'on' && bit && (
            <TabFields
              tabs={first.tabs}
              autoWidth={defaultTabWidth(bit)}
              through={first.depth > thickness - first.tabs.height}
              onChange={(tabs) => update((op) => (op.type === 'profile' ? { ...op, tabs } : op))}
            />
          )}
        </>
      )}

      {first ? (
        <button type="button" className="link-button" onClick={() => setEasyCut(objectIds, null)}>
          Don't cut {count > 1 ? 'these' : 'this'}
        </button>
      ) : (
        <p className="muted small">Not cut: shown for reference only. Pick a cut above.</p>
      )}
    </fieldset>
  );
}
