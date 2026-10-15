"use client";

/**
 * Toasts: `const { showToast } = useToast(); showToast("Saved", "success")`.
 *
 * The API is minty-payment-request-web's `components/Toast.tsx` (ToastProvider + useToast + the four
 * types), so ported screens keep their calls. This look is the house toast: minty-payment-request-web,
 * onboarding and Flask's `flash_messages.html` copy it value for value (the rule and the values:
 * Minty/docs/features/toasts.md) - change all four together. Auto-dismisses after 4 s;
 * announced to screen readers through the live region.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error" | "warning" | "info";

type ToastItem = { id: number; message: string; type: ToastType };

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;

const LABEL: Record<ToastType, string> = {
  success: "Success",
  error: "Error",
  warning: "Warning",
  info: "Information",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((all) => all.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = nextId.current++;
      setItems((all) => [...all, { id, message, type }]);
      window.setTimeout(() => dismiss(id), DEFAULT_DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 sm:bottom-6 sm:left-6 sm:translate-x-0"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            data-toast-type={t.type}
            className="pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-card py-1 pl-4 pr-1 text-body-m shadow-overlay"
          >
            <div className="flex-1 py-2">
              <p className="font-semibold text-ink">{LABEL[t.type]}</p>
              <p className="text-ink-2">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="flex size-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-hover hover:text-ink"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider> (app/layout.tsx mounts it)");
  }
  return ctx;
}
