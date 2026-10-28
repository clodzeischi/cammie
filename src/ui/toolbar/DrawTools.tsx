import { useCallback, useState } from 'react';
import { createShapeObject, DEFAULT_ELLIPSE, DEFAULT_RECT } from '../../core/shapes/shapeObjects';
import { useJobStore } from '../../state/jobStore';
import { Toast, type ToastMessage } from '../common/Toast';
import { newObjectOperation } from '../../state/modeStore';
import { RibbonButton } from '../ribbon/RibbonButton';
import { newTextObject, requestTextFocus } from '../text/textEditing';

/** Text, rectangle and circle: each lands in the middle of the stock, selected. */
export function DrawTools() {
  const stock = useJobStore((s) => s.stock);
  const addObject = useJobStore((s) => s.addObject);
  const toolpaths = useJobStore((s) => s.toolpaths);
  const add = (object: Parameters<typeof addObject>[0]) =>
    addObject(object, newObjectOperation(toolpaths));
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const addText = async () => {
    setLoading(true);
    try {
      const object = await newTextObject(stock);
      requestTextFocus(object.id);
      add(object);
    } catch {
      setToast({
        kind: 'error',
        text: "Couldn't load the font. Check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <RibbonButton
        icon="text"
        label="Text"
        title="Add text"
        disabled={loading}
        onClick={addText}
      />
      <RibbonButton
        icon="rect"
        label="Rectangle"
        title="Add a rectangle"
        onClick={() => add(createShapeObject(crypto.randomUUID(), DEFAULT_RECT, stock))}
      />
      <RibbonButton
        icon="ellipse"
        label="Circle"
        title="Add a circle (stretch it into an ellipse)"
        onClick={() => add(createShapeObject(crypto.randomUUID(), DEFAULT_ELLIPSE, stock))}
      />
      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </>
  );
}
