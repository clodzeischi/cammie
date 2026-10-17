import { useRef, useState } from 'react';
import { useJobStore } from '../../state/jobStore';
import { ACCEPTED_IMAGE_TYPES, loadImage, type LoadedImage } from '../import/loadImage';
import { TraceDialog } from '../import/TraceDialog';

/** File picker → decode → trace dialog → new design object. */
export function ImportImageButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stock = useJobStore((s) => s.stock);
  const addObject = useJobStore((s) => s.addObject);

  const open = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      setImage(await loadImage(file));
    } catch {
      setError(`Couldn't read “${file.name}”. Try a PNG or JPG.`);
    }
  };

  const close = () => {
    if (image) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <button
        type="button"
        className="tool-button"
        title="Import an image (PNG, JPG)"
        onClick={() => inputRef.current?.click()}
      >
        <span aria-hidden="true">⬆</span>
        <span className="tool-label">Image</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        hidden
        aria-label="Image file"
        onChange={(e) => open(e.target.files?.[0])}
      />
      {error && (
        <div className="toast" role="alert" onClick={() => setError(null)}>
          {error}
        </div>
      )}
      {image && (
        <TraceDialog
          image={image}
          stock={stock}
          onClose={close}
          onAdd={(object) => {
            addObject(object);
            close();
          }}
        />
      )}
    </>
  );
}
