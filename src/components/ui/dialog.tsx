"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  accent?: "default" | "danger";
  className?: string;
  children: React.ReactNode;
}

/**
 * Modal shell: backdrop, Escape / outside click to close, initial focus,
 * and a bottom-sheet layout on small screens.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  eyebrow,
  accent = "default",
  className,
  children,
}: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const first = panelRef.current?.querySelector<HTMLElement>(
      "[autofocus], input, textarea, select, button[type=submit]"
    );
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[3px] sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-surface border border-line shadow-[var(--shadow-float)] animate-rise",
          "rounded-t-2xl sm:rounded-2xl",
          className
        )}
      >
        {accent === "danger" && <div className="h-1 bg-danger" />}
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur px-6 pt-5 pb-4 border-b border-line">
          {eyebrow && <div className="nl-eyebrow mb-1.5">{eyebrow}</div>}
          <h2 id={titleId} className="text-[19px] font-semibold text-ink leading-tight pr-8">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-[13px] text-ink-subtle leading-snug">{description}</p>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 size-8 grid place-items-center rounded-lg text-ink-subtle hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- Form bits -- */

export const fieldClass =
  "w-full rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-subtle/80 transition-colors hover:border-line-strong focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft";

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        {hint && <span className="text-[12px] text-ink-subtle">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function SuccessState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-8 flex flex-col items-center text-center animate-rise">
      <div className="size-12 rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 grid place-items-center">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="mt-4 text-[17px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-[13.5px] text-ink-muted max-w-xs">{children}</p>
    </div>
  );
}
