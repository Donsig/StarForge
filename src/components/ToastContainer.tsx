import { useContext } from 'react';
import { NotificationContext } from '../context/NotificationContext.tsx';
import { Toast } from './Toast.tsx';

export function ToastContainer() {
  const notifications = useContext(NotificationContext);
  const queue = notifications?.queue ?? [];

  if (queue.length === 0) {
    return null;
  }

  const visibleQueue = queue.slice(-5);
  const dismiss = notifications?.dismissToast ?? notifications?.dismiss;
  const navigate = notifications?.navigate;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {visibleQueue.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          onDismiss={() => dismiss?.(toast.id)}
          onNavigate={() => navigate?.(toast.id)}
        />
      ))}
    </div>
  );
}
