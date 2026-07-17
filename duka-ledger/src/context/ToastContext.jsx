import { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, duration: 4000, ...toast }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration || 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((title, description) => {
    addToast({ title, description, variant: 'success' });
  }, [addToast]);

  const error = useCallback((title, description) => {
    addToast({ title, description, variant: 'error' });
  }, [addToast]);

  const info = useCallback((title, description) => {
    addToast({ title, description, variant: 'info' });
  }, [addToast]);

  const warning = useCallback((title, description) => {
    addToast({ title, description, variant: 'warning' });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, info, warning }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-55 flex flex-col gap-2 w-full max-w-xs sm:max-w-sm pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => {
          let variantStyles = 'bg-white border-slate-200 text-primary';
          let Icon = Info;
          let iconColor = 'text-primary';

          if (t.variant === 'success') {
            variantStyles = 'bg-white border-secondary/20 shadow-lg';
            Icon = CheckCircle2;
            iconColor = 'text-secondary';
          } else if (t.variant === 'error' || t.variant === 'destructive') {
            variantStyles = 'bg-white border-accent/20 shadow-lg';
            Icon = AlertCircle;
            iconColor = 'text-accent';
          } else if (t.variant === 'warning') {
            variantStyles = 'bg-white border-amber-200 shadow-lg';
            Icon = AlertTriangle;
            iconColor = 'text-amber-500';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex gap-3 p-4 rounded-xl border shadow-md animate-slide-in transition-all duration-300 ${variantStyles}`}
              role="alert"
            >
              <div className="flex-shrink-0 mt-0.5">
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 space-y-1">
                {t.title && <h4 className="text-sm font-bold text-primary tracking-tight leading-none">{t.title}</h4>}
                {t.description && <p className="text-xs text-slate-500 leading-normal font-semibold">{t.description}</p>}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="flex-shrink-0 text-slate-400 hover:text-slate-600 rounded-lg p-0.5 hover:bg-slate-50 transition self-start"
              >
                <X className="h-4 w-4" />
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
