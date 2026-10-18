import { useCallback, useState } from 'react';
import { createShapeObject, DEFAULT_ELLIPSE, DEFAULT_RECT } from '../../core/shapes/shapeObjects';
import { useJobStore } from '../../state/jobStore';
import { Toast, type ToastMessage } from '../common/Toast';
import { newTextObject, requestTextFocus } from '../text/textEditing';

/** Text, rectangle and circle: each lands in the middle of the stock, selected. */
export function DrawTools() {
  const stock = useJobStore((s) => s.stock);
  const addObject = useJobStore((s) => s.addObject);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const addText = async () => {
    setLoading(true);
    try {
      const object = await newTextObject(stock);
      requestTextFocus(object.id);
      addObject(object);
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
      <button
        type="button"
        className="tool-button"
        title="Add text"
        disabled={loading}
        onClick={addText}
      >
        <span aria-hidden="true" className="tool-icon-text">
          T
        </span>
        <span className="tool-label">Text</span>
      </button>
      <button
        type="button"
        className="tool-button"
        title="Add a rectangle"
        onClick={() => addObject(createShapeObject(crypto.randomUUID(), DEFAULT_RECT, stock))}
      >
        <span aria-hidden="true">▭</span>
        <span className="tool-label">Rectangle</span>
      </button>
      <button
        type="button"
        className="tool-button"
        title="Add a circle (stretch it into an ellipse)"
        onClick={() => addObject(createShapeObject(crypto.randomUUID(), DEFAULT_ELLIPSE, stock))}
      >
        <span aria-hidden="true">◯</span>
        <span className="tool-label">Circle</span>
      </button>
      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </>
  );
}
