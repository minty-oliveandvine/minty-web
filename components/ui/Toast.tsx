"use client";

/**
 * Toasts: `const { showToast } = useToast(); showToast("Saved", "success")`.
 *
 * The API is billing-frontend's `components/Toast.tsx` (ToastProvider + useToast + the four
 * types), so ported screens keep their calls; the look is not - skeletal by decision, the
 * design pass restyles this file and nothing else changes. Auto-dismisses after 4 s; announced
 * to screen readers through the live region.
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
        className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            data-toast-type={t.type}
            className="pointer-events-auto flex items-start gap-3 rounded border border-[var(--border)] bg-[var(--background)] p-3 text-sm shadow"
          >
            <div className="flex-1">
              <p className="font-semibold">{LABEL[t.type]}</p>
              <p className="text-muted">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="text-muted hover:text-[var(--foreground)]"
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
