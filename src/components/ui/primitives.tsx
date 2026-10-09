import React from "react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- Badge -- */

export type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "risk";

const TONE_STYLES: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-muted",
  accent: "bg-accent-soft text-accent-ink",
  ok: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  warn: "bg-amber-500/14 text-amber-800 dark:text-amber-300",
  danger: "bg-danger-soft text-danger",
  risk: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300",
};

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-ink-subtle",
  accent: "bg-accent",
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-danger",
  risk: "bg-indigo-500",
};

export function Badge({
  tone = "neutral",
  dot = true,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-[22px] px-2 rounded-md text-[11.5px] font-medium whitespace-nowrap",
        TONE_STYLES[tone],
        className
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />}
      {children}
    </span>
  );
}

/** "CORROBORATED" → "Corroborated", "INSUFFICIENT_DATA" → "Insufficient data" */
export const humanize = (s: string) =>
  s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

/* ----------------------------------------------------------------- Card -- */

export function Card({
  className,
  interactive,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-line bg-surface",
        interactive &&
          "transition-[border-color,box-shadow,transform] hover:border-line-strong hover:shadow-[0_6px_20px_-12px_oklch(0_0_0/0.25)] cursor-pointer",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- Button -- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-ink text-canvas hover:opacity-90",
  secondary: "bg-surface border border-line text-ink hover:bg-surface-2",
  ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
        size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-9 px-3.5 text-[13px]",
        BUTTON_STYLES[variant],
        className
      )}
      {...rest}
    />
  );
}

/* ------------------------------------------------------- SectionHeader -- */

export function SectionHeader({
  id,
  index,
  title,
  description,
  actions,
}: {
  id?: string;
  index?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        {index && <div className="nl-eyebrow mb-1.5">{index}</div>}
        <h2 id={id} className="text-[19px] font-semibold text-ink leading-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[13px] text-ink-subtle max-w-prose">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------ Metadata -- */

export function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="nl-eyebrow !text-[9.5px]">{label}</div>
      <div className="mt-0.5 font-mono text-[13px] font-medium text-ink truncate">{value}</div>
    </div>
  );
}
