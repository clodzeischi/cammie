import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { downloadBlob, slugify } from '../../app/exportFiles';
import { parseProject, PROJECT_EXTENSION, serializeProject } from '../../persistence/projectFile';
import { useJobStore } from '../../state/jobStore';
import { currentProject, openProject } from '../../state/projectActions';
import { IS_MAC, MOD_KEY } from '../common/platform';
import { Toast, type ToastMessage } from '../common/Toast';
import { Icon } from '../icons/Icon';

interface ProjectButtonsProps {
  /** Shown once, e.g. after the last design was restored from the browser. */
  notice: string | null;
}

/** New, Open and Save for `.cammie` project files, with ⌘O / ⌘S. */
export function ProjectButtons({ notice }: ProjectButtonsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [noticeSeen, setNoticeSeen] = useState(false);
  const noticeToast = useMemo<ToastMessage | null>(
    () => (notice ? { kind: 'info', text: notice } : null),
    [notice],
  );
  const shown = toast ?? (noticeSeen ? null : noticeToast);
  const dismiss = useCallback(() => {
    setToast(null);
    setNoticeSeen(true);
  }, []);

  const save = useCallback(() => {
    const project = currentProject();
    const name = `${slugify(project.jobName)}${PROJECT_EXTENSION}`;
    downloadBlob(name, new Blob([serializeProject(project)], { type: 'application/json' }));
  }, []);

  const confirmDiscard = () =>
    useJobStore.getState().objects.length === 0 ||
    window.confirm('Replace the current design? Save it first if you want to keep it.');

  const open = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = '';
    if (!file || !confirmDiscard()) return;
    setNoticeSeen(true);
    const parsed = parseProject(await file.text());
    if (!parsed.ok) {
      setToast({ kind: 'error', text: `Couldn't open “${file.name}”. ${parsed.error}` });
      return;
    }
    openProject(parsed.project);
    dismiss();
  };

  const startNew = () => {
    if (!confirmDiscard()) return;
    useJobStore.getState().clearDesign();
    dismiss();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(IS_MAC ? event.metaKey : event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 's') save();
      else if (key === 'o') inputRef.current?.click();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  return (
    <div className="project-buttons" role="group" aria-label="Project">
      <button
        type="button"
        className="button"
        title="Start a new design"
        aria-label="New"
        onClick={startNew}
      >
        <Icon name="newFile" size={16} />
        <span className="button-text">New</span>
      </button>
      <button
        type="button"
        className="button"
        title={`Open a ${PROJECT_EXTENSION} project (${MOD_KEY}O)`}
        aria-label="Open"
        onClick={() => inputRef.current?.click()}
      >
        <Icon name="open" size={16} />
        <span className="button-text">Open</span>
      </button>
      <button
        type="button"
        className="button"
        title={`Save the design as a ${PROJECT_EXTENSION} file (${MOD_KEY}S)`}
        aria-label="Save"
        onClick={save}
      >
        <Icon name="save" size={16} />
        <span className="button-text">Save</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={`${PROJECT_EXTENSION},application/json`}
        hidden
        aria-label="Project file"
        onChange={(e) => void open(e.target.files?.[0])}
      />
      {shown && <Toast message={shown} onDismiss={dismiss} />}
    </div>
  );
}
