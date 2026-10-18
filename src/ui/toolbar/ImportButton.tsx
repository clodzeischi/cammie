import { useCallback, useRef, useState } from 'react';
import { createObject } from '../../core/job/objectFactory';
import { parseSvg } from '../../core/import/svg/parseSvg';
import { useJobStore } from '../../state/jobStore';
import { Toast, type ToastMessage } from '../common/Toast';
import { ACCEPTED_IMAGE_TYPES, loadImage, type LoadedImage } from '../import/loadImage';
import { TraceDialog } from '../import/TraceDialog';

const ACCEPTED = `${ACCEPTED_IMAGE_TYPES},image/svg+xml,.svg`;

const baseName = (file: File) => file.name.replace(/\.[^.]+$/, '') || 'design';
const isSvg = (file: File) => file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);

/**
 * One button for every file type: SVGs land on the stock at their real size;
 * bitmaps go through the trace dialog first.
 */
export function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const stock = useJobStore((s) => s.stock);
  const addObject = useJobStore((s) => s.addObject);
  const dismissToast = useCallback(() => setToast(null), []);

  const importSvg = async (file: File) => {
    const { paths, warnings } = parseSvg(await file.text());
    if (paths.length === 0) {
      setToast({
        kind: 'error',
        text: `No cuttable shapes found in “${file.name}”. ${warnings.join(' ')}`,
      });
      return;
    }
    addObject(
      createObject({ id: crypto.randomUUID(), name: baseName(file), kind: 'svg', paths, stock }),
    );
    if (warnings.length > 0) setToast({ kind: 'info', text: warnings.join(' ') });
  };

  const open = async (file: File | undefined) => {
    if (!file) return;
    setToast(null);
    try {
      if (isSvg(file)) {
        await importSvg(file);
        resetInput();
      } else {
        setImage(await loadImage(file));
      }
    } catch {
      setToast({ kind: 'error', text: `Couldn't read “${file.name}”. Try an SVG, PNG or JPG.` });
      resetInput();
    }
  };

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = '';
  };

  const closeTrace = () => {
    if (image) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
    resetInput();
  };

  return (
    <>
      <button
        type="button"
        className="tool-button"
        title="Import an SVG or an image (PNG, JPG)"
        onClick={() => inputRef.current?.click()}
      >
        <span aria-hidden="true">⬆</span>
        <span className="tool-label">Import</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        hidden
        aria-label="Design file"
        onChange={(e) => open(e.target.files?.[0])}
      />
      {toast && <Toast message={toast} onDismiss={dismissToast} />}
      {image && (
        <TraceDialog
          image={image}
          stock={stock}
          onClose={closeTrace}
          onAdd={(object) => {
            addObject(object);
            closeTrace();
          }}
        />
      )}
    </>
  );
}
