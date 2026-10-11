"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Light / Dark / System. next-themes persists the choice in localStorage and
 * applies it before paint, so there is no flash on load.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme = "system", setTheme } = useTheme();
  // Theme is unknown during SSR; render the frame without a selection.
  const mounted = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("grid grid-cols-3 gap-0.5 p-0.5 rounded-lg bg-surface-2 border border-line", className)}
    >
      {OPTIONS.map((o) => {
        const active = mounted && theme === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.value)}
            className={cn(
              "h-11 md:h-8 rounded-md flex items-center justify-center gap-1.5 text-[12.5px] font-medium transition-colors",
              active
                ? "bg-surface text-ink shadow-[0_1px_2px_oklch(0_0_0/0.08),0_0_0_1px_var(--color-line)]"
                : "text-ink-subtle hover:text-ink"
            )}
          >
            <o.icon className="size-3.5" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
