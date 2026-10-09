"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";

const noopSubscribe = () => () => {};

const NEXT = { dark: "light", light: "system", system: "dark" } as const;

export function ThemeToggle() {
  const { theme = "system", setTheme } = useTheme();
  // Theme is unknown during SSR; render a placeholder until hydrated.
  const mounted = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  if (!mounted) return <div className="size-9" aria-hidden />;

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <button
      onClick={() => setTheme(NEXT[theme as keyof typeof NEXT] ?? "dark")}
      id="theme-toggle-btn"
      title={`Theme: ${theme}`}
      aria-label={`Theme: ${theme}. Switch theme`}
      className="size-9 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink transition-colors"
    >
      <Icon className="size-[18px]" strokeWidth={1.75} />
    </button>
  );
}
