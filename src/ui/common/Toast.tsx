import { useEffect } from 'react';

export interface ToastMessage {
  kind: 'error' | 'info';
  text: string;
}

interface ToastProps {
  message: ToastMessage;
  onDismiss: () => void;
}

/** Info notes fade after a while; errors stay until clicked. */
const INFO_TIMEOUT_MS = 8000;

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    if (message.kind !== 'info') return;
    const timer = setTimeout(onDismiss, INFO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div
      className={`toast toast-${message.kind}`}
      role={message.kind === 'error' ? 'alert' : 'status'}
      onClick={onDismiss}
    >
      {message.text}
    </div>
  );
}
