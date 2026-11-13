import { ArrangeFields } from './ArrangeFields';
import { ObjectCuts } from './ObjectCuts';
import { PanelHeader, SelectionActions } from './PanelHeader';

interface SelectionPanelProps {
  count: number;
}

/** Shown when several shapes (or a group) are selected. Shift-click adds or removes shapes. */
export function SelectionPanel({ count }: SelectionPanelProps) {
  return (
    <section className="panel" aria-label="Selected shapes">
      <PanelHeader title={`${count} shapes`} actions={<SelectionActions />} />
      <ObjectCuts count={count} />
      <ArrangeFields />
    </section>
  );
}
