"use client";

import React from "react";
import { Plus, PhoneCall, LifeBuoy, Settings2 } from "lucide-react";
import { useDemo } from "@/context/demo-context";
import { NAV_ITEMS, type AppTab } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { useNavCounts } from "./use-nav-counts";

interface NavRailProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenReportModal: () => void;
  onOpenSosModal: () => void;
  onOpenEmergency: () => void;
}

export function NavRail({
  activeTab,
  onTabChange,
  onOpenReportModal,
  onOpenSosModal,
  onOpenEmergency,
}: NavRailProps) {
  const { currentRole } = useDemo();
  const counts = useNavCounts();

  return (
    <aside className="hidden md:flex w-[248px] shrink-0 flex-col border-r border-line bg-surface select-none">
      <div className="h-16 px-5 flex items-center border-b border-line">
        <Brand />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">
        <button
          onClick={onOpenReportModal}
          id="nav-report-hazard-btn"
          className="group h-10 w-full rounded-[10px] bg-ink text-canvas text-[13px] font-semibold flex items-center gap-2 px-3 transition-[transform,opacity] hover:opacity-90 active:scale-[0.99]"
        >
          <span className="grid place-items-center size-5 rounded-md bg-accent text-ink">
            <Plus className="size-3.5" strokeWidth={2.5} />
          </span>
          Report a hazard
          <kbd className="ml-auto font-mono text-[10.5px] font-medium opacity-50">R</kbd>
        </button>

        <nav aria-label="Primary" className="flex flex-col gap-0.5">
          <div className="nl-eyebrow px-3 pb-2">Monitor</div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isGated = item.roles && !item.roles.includes(currentRole);
            const count = item.countKey ? counts[item.countKey] : undefined;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                disabled={isGated}
                aria-current={isActive ? "page" : undefined}
                title={isGated ? "Switch to the Responder role to access" : undefined}
                className={cn(
                  "relative h-9 w-full rounded-lg px-3 flex items-center gap-2.5 text-[13.5px] transition-colors text-left",
                  isActive
                    ? "bg-surface-2 text-ink font-medium"
                    : "text-ink-muted hover:bg-surface-2/60 hover:text-ink",
                  isGated && "opacity-40 cursor-not-allowed hover:bg-transparent"
                )}
              >
                {isActive && (
                  <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-accent" />
                )}
                <Icon
                  className={cn(
                    "size-[17px] shrink-0",
                    isActive ? "text-ink" : "text-ink-subtle"
                  )}
                  strokeWidth={1.75}
                />
                <span className="truncate">{item.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={cn(
                      "ml-auto min-w-5 h-5 px-1.5 rounded-md font-mono text-[11px] font-medium grid place-items-center tabular-nums",
                      item.tone === "danger"
                        ? "bg-danger-soft text-danger"
                        : "bg-surface-3 text-ink-muted"
                    )}
                  >
                    {count}
                  </span>
                )}
                {isGated && (
                  <span className="ml-auto nl-eyebrow !text-[9.5px]">Responder</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Emergency block — always visible, visually separated from routine nav */}
      <div className="px-3 pb-3 flex flex-col gap-2">
        <div className="rounded-xl border border-danger/25 bg-danger-soft p-3">
          <div className="flex items-center gap-2 text-danger">
            <span className="nl-live-dot" />
            <span className="nl-eyebrow !text-danger">Emergency</span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-snug text-ink-muted">
            In immediate danger? Call 112 first, then request community help.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <button
              onClick={onOpenEmergency}
              id="emergency-112-btn"
              className="h-8 rounded-lg bg-danger text-white text-[12.5px] font-semibold flex items-center justify-center gap-1.5 hover:brightness-110 transition"
            >
              <PhoneCall className="size-3.5" />
              Call 112
            </button>
            <button
              onClick={onOpenSosModal}
              id="nav-sos-help-btn"
              className="h-8 rounded-lg border border-danger/30 bg-surface text-danger text-[12.5px] font-semibold flex items-center justify-center gap-1.5 hover:bg-danger-soft transition"
            >
              <LifeBuoy className="size-3.5" />
              SOS
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 pt-1">
          <div className="flex-1 flex items-center gap-2 px-3 text-[12px] text-ink-subtle min-w-0">
            <span className="nl-live-dot text-ok shrink-0" />
            <span className="truncate">Synced · local adapter</span>
          </div>
          <button
            onClick={() => onTabChange("settings")}
            aria-label="Settings and logs"
            aria-current={activeTab === "settings" ? "page" : undefined}
            className={cn(
              "size-8 rounded-lg grid place-items-center text-ink-subtle hover:bg-surface-2 hover:text-ink transition-colors",
              activeTab === "settings" && "bg-surface-2 text-ink"
            )}
          >
            <Settings2 className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </aside>
  );
}
