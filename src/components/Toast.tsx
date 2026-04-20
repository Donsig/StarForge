import { useEffect } from 'react';

interface ToastProps {
  id: string;
  type: 'combat' | 'fleet' | 'espionage';
  message: string;
  onDismiss: () => void;
  onNavigate: () => void;
}

export function Toast({
  id,
  type,
  message,
  onDismiss,
  onNavigate,
}: ToastProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onDismiss();
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [id, onDismiss]);

  return (
    <div
      className={`toast toast--${type}`}
      onClick={onNavigate}
    >
      <div className="toast__body">
        <div className="toast__type">{type}</div>
        <div className="toast__message">{message}</div>
      </div>
      <button
        type="button"
        className="toast-dismiss"
        aria-label="Dismiss notification"
        onClick={(event) => {
          event.stopPropagation();
          onDismiss();
        }}
      >
        ×
      </button>
    </div>
  );
}
