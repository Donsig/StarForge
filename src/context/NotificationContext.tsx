/* eslint-disable react-refresh/only-export-components -- shared notification context and hook are intentionally colocated. */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { MessageTab } from './GameContext.tsx';

export type ToastType = 'combat' | 'fleet' | 'espionage';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  navTab: MessageTab;
}

export interface NotificationContextValue {
  queue: ToastItem[];
  showToast?: (
    type: ToastType,
    message: string,
    navTab?: MessageTab,
    id?: string,
  ) => string;
  dismissToast?: (id: string) => void;
  dismiss: (id: string) => void;
  navigate: (id: string) => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

function createToastId(type: ToastType): string {
  return `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function useStandaloneNotificationsState() {
  const [queue, setQueue] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string): void => {
    setQueue((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (
      type: ToastType,
      message: string,
      navTab: MessageTab = type,
      id?: string,
    ): string => {
      const nextId = id ?? createToastId(type);
      setQueue((current) => {
        const nextQueue = [
          ...current.filter((toast) => toast.id !== nextId),
          { id: nextId, type, message, navTab },
        ];
        return nextQueue.length > 5 ? nextQueue.slice(nextQueue.length - 5) : nextQueue;
      });
      return nextId;
    },
    [],
  );

  const navigate = useCallback((): void => {}, []);

  return useMemo(
    () => ({
      queue,
      showToast,
      dismissToast,
      dismiss: dismissToast,
      navigate,
    }),
    [dismissToast, navigate, queue, showToast],
  );
}

interface NotificationProviderProps {
  children: ReactNode;
  onNavigateToMessages: (tab: MessageTab) => void;
}

export function NotificationProvider({
  children,
  onNavigateToMessages,
}: NotificationProviderProps) {
  const notifications = useStandaloneNotificationsState();

  const navigate = useCallback(
    (id: string): void => {
      const toast = notifications.queue.find((item) => item.id === id);
      if (!toast) {
        return;
      }

      onNavigateToMessages(toast.navTab);
      notifications.dismissToast(id);
    },
    [notifications, onNavigateToMessages],
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      queue: notifications.queue,
      showToast: notifications.showToast,
      dismissToast: notifications.dismissToast,
      dismiss: notifications.dismissToast,
      navigate,
    }),
    [navigate, notifications.dismissToast, notifications.queue, notifications.showToast],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  const local = useStandaloneNotificationsState();
  return context ?? local;
}
