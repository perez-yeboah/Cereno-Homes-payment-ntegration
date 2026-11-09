import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (titleOrMessage: string, messageOrType?: string | ToastType, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (titleOrMessage: string, messageOrType?: string | ToastType, typeParam?: ToastType) => {
      let title: string | undefined;
      let message: string;
      let type: ToastType = 'info';

      if (typeParam) {
        // showToast(title, message, type)
        title = titleOrMessage;
        message = messageOrType as string;
        type = typeParam;
      } else if (
        messageOrType &&
        ['success', 'error', 'info', 'warning'].includes(messageOrType)
      ) {
        // showToast(message, type)
        message = titleOrMessage;
        type = messageOrType as ToastType;
      } else if (messageOrType) {
        // showToast(title, message)
        title = titleOrMessage;
        message = messageOrType;
        type = 'info';
      } else {
        // showToast(message)
        message = titleOrMessage;
        type = 'info';
      }

      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: ToastItem = { id, title, message, type };

      setToasts((prev) => [...prev, newToast]);

      // Auto dismiss after 5 seconds
      setTimeout(() => {
        removeToast(id);
      }, 5000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}

      {/* Fancy Floating Card Toast Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => {
          const isError = toast.type === 'error';
          const isSuccess = toast.type === 'success';
          const isWarning = toast.type === 'warning';

          const borderClass = isError
            ? 'border-rose-500/50 shadow-rose-950/40 bg-gradient-to-r from-rose-950/80 via-slate-900/95 to-slate-900/95'
            : isSuccess
            ? 'border-emerald-500/50 shadow-emerald-950/40 bg-gradient-to-r from-emerald-950/80 via-slate-900/95 to-slate-900/95'
            : isWarning
            ? 'border-amber-500/50 shadow-amber-950/40 bg-gradient-to-r from-amber-950/80 via-slate-900/95 to-slate-900/95'
            : 'border-blue-500/50 shadow-blue-950/40 bg-gradient-to-r from-blue-950/80 via-slate-900/95 to-slate-900/95';

          const iconBg = isError
            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            : isSuccess
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : isWarning
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30';

          return (
            <div
              key={toast.id}
              role="alert"
              className={`pointer-events-auto transform transition-all duration-300 ease-out translate-y-0 opacity-100 p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-start gap-3.5 ${borderClass}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                {isError && (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                {isSuccess && (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {isWarning && (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                {!isError && !isSuccess && !isWarning && (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                {toast.title && (
                  <h4 className="text-sm font-semibold text-slate-100 tracking-wide mb-0.5">
                    {toast.title}
                  </h4>
                )}
                <p className="text-xs text-slate-300 leading-relaxed break-words">
                  {toast.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 -mr-1 rounded-lg hover:bg-slate-800/60"
                aria-label="Close notification"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
