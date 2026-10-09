"use client";

import React from "react";
import { Plus } from "lucide-react";
import { NAV_ITEMS, type AppTab } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useNavCounts } from "./use-nav-counts";

interface MobileNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenReportModal: () => void;
}

const MOBILE_TABS: AppTab[] = ["map", "hazards", "reports", "sos"];

export function MobileNav({ activeTab, onTabChange, onOpenReportModal }: MobileNavProps) {
  const counts = useNavCounts();
  const items = MOBILE_TABS.map((id) => NAV_ITEMS.find((n) => n.id === id)!);
  const [left, right] = [items.slice(0, 2), items.slice(2)];

  const renderItem = (item: (typeof items)[number]) => {
    const Icon = item.icon;
    const active = activeTab === item.id;
    const count = item.countKey ? counts[item.countKey] : 0;
    return (
      <button
        key={item.id}
        onClick={() => onTabChange(item.id)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex-1 h-full flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
          active ? "text-ink" : "text-ink-subtle"
        )}
      >
        <span className="relative">
          <Icon className="size-5" strokeWidth={active ? 2 : 1.6} />
          {item.tone === "danger" && count > 0 && (
            <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-danger ring-2 ring-surface" />
          )}
        </span>
        {item.shortLabel}
        {active && <span className="absolute top-0 inset-x-6 h-0.5 rounded-b bg-accent" />}
      </button>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] border-t border-line bg-surface/90 backdrop-blur-xl flex items-stretch"
    >
      {left.map(renderItem)}
      <div className="flex-1 grid place-items-center">
        <button
          onClick={onOpenReportModal}
          aria-label="Report a hazard"
          className="size-12 -mt-6 rounded-2xl bg-ink text-canvas grid place-items-center shadow-[var(--shadow-float)] ring-4 ring-canvas active:scale-95 transition-transform"
        >
          <Plus className="size-5" strokeWidth={2.5} />
        </button>
      </div>
      {right.map(renderItem)}
    </nav>
  );
}
