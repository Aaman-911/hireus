import { useState, useCallback, useRef } from 'react';
import { ToastContext } from './context';

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = 'info', action, duration = 6000 }) => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, title, description, variant, action }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}

      {/* Glass, bottom-anchored — the same material as the sticky pill. */}
      <div
        className="no-print fixed bottom-5 left-1/2 z-[100] flex w-[min(30rem,calc(100vw-2.5rem))] -translate-x-1/2 flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className="glass rise flex items-start gap-3 rounded-[var(--radius-tile)] border border-rule px-5 py-4 shadow-[var(--shadow-card)]"
          >
            <span
              aria-hidden="true"
              className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
              style={{
                background:
                  t.variant === 'error'
                    ? 'var(--burgundy)'
                    : t.variant === 'success'
                      ? 'var(--accent)'
                      : 'var(--ink-mute)',
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="t-reduced font-semibold text-ink">{t.title}</p>
              {t.description && <p className="t-reduced mt-1 text-ink-mute">{t.description}</p>}
              {t.action && (
                <button
                  onClick={() => {
                    dismiss(t.id);
                    t.action.onClick();
                  }}
                  className="btn-text mt-1 !min-h-0 text-[14px]"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-mr-1 shrink-0 rounded-[var(--radius-compact)] p-1 text-ink-mute transition-colors duration-[.32s] hover:text-ink"
            >
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 3l8 8M11 3l-8 8" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
