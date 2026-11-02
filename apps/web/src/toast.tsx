import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Toast } from '@elsa3d/ui';

type ToastMessage = { title: string; message?: string; kind: 'success' | 'error' | 'info' };
const ToastContext = createContext<((message: ToastMessage) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const pushToast = useCallback((next: ToastMessage) => setMessage(next), []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  return (
    <ToastContext.Provider value={pushToast}>
      {children}
      {message ? (
        <div className="toast-region">
          <Toast
            title={message.title}
            message={message.message}
            kind={message.kind}
            dismissLabel="Dismiss notification"
            onDismiss={() => setMessage(null)}
          />
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context;
}
