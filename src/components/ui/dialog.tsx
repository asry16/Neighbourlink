"use client";

import React, { useEffect, useId, useRef } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEscape, useFocusOnOpen, useFocusTrap, useScrollLock } from "./a11y";

/* ------------------------------------------------------------- Modal -- */

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  accent?: "default" | "danger";
  /** Sticky action bar; stays above the mobile keyboard. */
  footer?: React.ReactNode;
  /** Keep mounted (draft preserved) but out of the way, e.g. while picking on the map. */
  hidden?: boolean;
  size?: "md" | "sm";
  className?: string;
  children: React.ReactNode;
}

/**
 * Focused task dialog. Desktop: centred modal. Mobile: full-screen.
 * Traps focus, locks background scroll, returns focus to the trigger.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  eyebrow,
  accent = "default",
  footer,
  hidden = false,
  size = "md",
  className,
  children,
}: DialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const active = open && !hidden;

  // Trigger is remembered once per open, not per hide/show, so closing after
  // a choose-on-map round trip still returns focus to the original trigger.
  useFocusOnOpen(panelRef, open);
  useFocusTrap(panelRef, active);
  useScrollLock(active);
  useEscape(active, onClose);

  // Coming back from choose-on-map: restore focus to the control that started it.
  const wasHidden = useRef(hidden);
  useEffect(() => {
    if (wasHidden.current && !hidden && open) {
      const target =
        panelRef.current?.querySelector<HTMLElement>("[data-return-focus]") ?? panelRef.current;
      target?.focus({ preventScroll: false });
    }
    wasHidden.current = hidden;
  }, [hidden, open]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex sm:items-center justify-center sm:bg-black/50 sm:p-4",
        hidden && "hidden"
      )}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex flex-col w-full bg-surface outline-none",
          // Mobile: full screen with safe areas. Desktop: centred card.
          "h-dvh pt-[env(safe-area-inset-top)] sm:pt-0 sm:h-auto sm:max-h-[min(90dvh,860px)] sm:rounded-2xl sm:border sm:border-line sm:shadow-[var(--shadow-float)] sm:animate-rise",
          size === "sm" ? "sm:max-w-md" : "sm:max-w-lg",
          className
        )}
      >
        {accent === "danger" && <div className="h-1 bg-danger shrink-0 sm:rounded-t-2xl" />}
        <header className="shrink-0 flex items-start gap-3 px-4 sm:px-6 pt-3 sm:pt-5 pb-3 sm:pb-4 border-b border-line">
          <div className="min-w-0 flex-1 pt-1.5 sm:pt-0">
            {eyebrow && <div className="nl-eyebrow mb-1.5">{eyebrow}</div>}
            <h2 id={titleId} className="text-[19px] font-semibold text-ink leading-tight">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-[13px] text-ink-subtle leading-snug">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="shrink-0 size-11 sm:size-9 -mr-1.5 grid place-items-center rounded-lg text-ink-subtle hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-5 sm:size-4" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5">
          {children}
        </div>

        {footer && (
          <footer className="shrink-0 border-t border-line bg-surface px-4 sm:px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3 sm:rounded-b-2xl">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Drawer -- */

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  /** Shows a Back button (e.g. details → list). */
  onBack?: () => void;
  backLabel?: string;
  /** Mobile bottom sheet collapsed to a peek bar. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  children: React.ReactNode;
}

/**
 * Browsing panel. Desktop: right-side drawer below the header. Mobile: bottom
 * sheet with buttons to expand/collapse (no drag-only interaction). Non-modal:
 * the map stays interactive and undimmed.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  onBack,
  backLabel = "Back",
  collapsed = false,
  onCollapsedChange,
  children,
}: DrawerProps) {
  const titleId = useId();
  const ref = useRef<HTMLElement>(null);
  useFocusOnOpen(ref, open);
  useEscape(open, onClose);

  if (!open) return null;

  return (
    <aside
      ref={ref}
      role="region"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={cn(
        "fixed z-40 flex flex-col bg-surface outline-none border-line shadow-[var(--shadow-float)] animate-rise",
        // Mobile bottom sheet, docked above the bottom navigation
        "inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] rounded-t-2xl border-t",
        collapsed ? "max-h-none" : "max-h-[calc(100dvh-4rem-env(safe-area-inset-bottom)-7rem)]",
        // Desktop right drawer under the header
        "md:inset-x-auto md:right-0 md:top-16 md:bottom-0 md:w-[380px] lg:w-[420px] md:max-h-none md:rounded-none md:border-t-0 md:border-l md:pb-0 md:shadow-[-12px_0_32px_-24px_oklch(0_0_0/0.35)]"
      )}
    >
      <header className="shrink-0 flex items-center gap-1 px-2 md:px-3 pt-2 md:pt-3 pb-2 border-b border-line">
        {onBack && (
          <button
            onClick={onBack}
            className="h-11 md:h-9 pl-2 pr-3 rounded-lg flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </button>
        )}
        <div className={cn("min-w-0 flex-1", onBack ? "pl-1" : "pl-2")}>
          <h2 id={titleId} className="text-[16px] font-semibold text-ink truncate leading-tight">
            {title}
          </h2>
          {subtitle && <div className="text-[12px] text-ink-subtle truncate">{subtitle}</div>}
        </div>
        {onCollapsedChange && (
          <button
            onClick={() => onCollapsedChange(!collapsed)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title} to show the map`}
            className="md:hidden size-11 shrink-0 grid place-items-center rounded-lg text-ink-subtle hover:bg-surface-2 hover:text-ink"
          >
            {collapsed ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
          </button>
        )}
        <button
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="size-11 md:size-9 shrink-0 grid place-items-center rounded-lg text-ink-subtle hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-5 md:size-4" />
        </button>
      </header>
      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain",
          collapsed && "hidden md:block"
        )}
      >
        {children}
      </div>
    </aside>
  );
}

/* ----------------------------------------------------------- Confirm -- */

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onAnswer,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onAnswer: (ok: boolean) => void;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useFocusOnOpen(ref, open);
  useFocusTrap(ref, open);
  useEscape(open, () => onAnswer(false));
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4">
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-2xl bg-surface border border-line shadow-[var(--shadow-float)] p-5 animate-rise"
      >
        <h2 id={titleId} className="text-[17px] font-semibold text-ink">
          {title}
        </h2>
        <p className="mt-1.5 text-[13.5px] text-ink-muted leading-relaxed">{body}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            data-autofocus
            onClick={() => onAnswer(false)}
            className="h-11 rounded-lg bg-ink text-canvas text-[13.5px] font-medium"
          >
            Keep editing
          </button>
          <button
            onClick={() => onAnswer(true)}
            className="h-11 rounded-lg border border-danger/40 text-danger text-[13.5px] font-medium hover:bg-danger-soft"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- Form bits -- */

export const fieldClass =
  "w-full min-h-11 rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-[16px] md:text-[14px] text-ink placeholder:text-ink-subtle/80 transition-colors hover:border-line-strong focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft";

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
