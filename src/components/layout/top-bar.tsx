"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  MapPin,
  PhoneCall,
  Bell,
  ChevronDown,
  Map as MapIcon,
  Rows3,
  Check,
  Settings2,
} from "lucide-react";
import { useDemo, DEMO_LOCALITIES, DEMO_USERS, type Role } from "@/context/demo-context";
import { ThemeSwitcher } from "@/components/theme-toggle";
import { Search } from "./search";
import { NAV_ITEMS, isFeedTab, type AppTab } from "@/lib/navigation";
import { useDismiss } from "@/lib/use-dismiss";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";

const ROLE_META: Record<Role, { label: string; hint: string; tone: string }> = {
  RESIDENT: { label: "Resident", hint: "Report hazards, receive alerts", tone: "bg-sky-500" },
  RESPONDER: { label: "Responder", hint: "Rescue ops, exact SOS locations", tone: "bg-emerald-500" },
  ADMIN: { label: "Admin", hint: "Audit logs and moderation", tone: "bg-amber-500" },
};

const initials = (name: string) =>
  name
    .split(" ")
    .filter((w) => /^[A-Z]/.test(w))
    .slice(-2)
    .map((w) => w[0])
    .join("");

/** Dropdown wrapper: owns open state and closes on outside click / Escape. */
function Menu({
  trigger,
  children,
  align = "left",
  width = "w-72",
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={cn(
            "absolute top-full mt-2 z-50 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)] animate-rise origin-top",
            align === "right" ? "right-0" : "left-0",
            width
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

const iconButton =
  "relative size-11 md:size-9 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink transition-colors";

interface TopBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenEmergency: () => void;
}

export function TopBar({ activeTab, onTabChange, onOpenEmergency }: TopBarProps) {
  const {
    currentRole,
    currentUser,
    setRole,
    currentLocality,
    setLocality,
    notificationCount,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useDemo();

  const showingFeed = isFeedTab(activeTab);
  const showingMap = activeTab === "map";

  return (
    <header className="shrink-0 border-b border-line bg-surface/80 backdrop-blur-xl pt-[env(safe-area-inset-top)] relative z-50">
      <div className="h-14 md:h-16 px-2 md:px-5 flex items-center gap-1 sm:gap-2">
      <div className="hidden sm:block md:hidden">
        <Brand compact />
      </div>

      {/* Sector */}
      <Menu
        trigger={({ open, toggle }) => (
          <button
            onClick={toggle}
            aria-expanded={open}
            aria-label="Choose your area"
            className={cn(
              "h-11 md:h-10 pl-2 pr-1.5 sm:pl-2.5 sm:pr-2 rounded-lg flex items-center gap-2 sm:gap-2.5 text-left transition-colors hover:bg-surface-2 min-w-0",
              open && "bg-surface-2"
            )}
          >
            <MapPin className="size-4 text-accent shrink-0" strokeWidth={2} />
            <span className="flex flex-col leading-tight min-w-0">
              <span className="nl-eyebrow !text-[9.5px] hidden sm:block">Your area</span>
              <span className="text-[13.5px] font-medium text-ink truncate max-w-[6.5rem] sm:max-w-[16rem]">
                {currentLocality.name}
              </span>
            </span>
            <ChevronDown
              className={cn("size-3.5 text-ink-subtle transition-transform", open && "rotate-180")}
            />
          </button>
        )}
      >
        {(close) => (
          <>
            <div className="px-2.5 pt-1.5 pb-2 text-[12px] text-ink-subtle leading-snug">
              Alerts and the feed are scoped to this area. Choosing one also moves the map there.
            </div>
            <div className="max-h-80 overflow-y-auto">
              {DEMO_LOCALITIES.map((loc) => {
                const active = currentLocality.id === loc.id;
                return (
                  <button
                    key={loc.id}
                    onClick={() => {
                      setLocality(loc);
                      close();
                    }}
                    className={cn(
                      "w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-2.5 transition-colors",
                      active ? "bg-accent-soft" : "hover:bg-surface-2"
                    )}
                  >
                    <span className="mt-0.5 size-4 shrink-0 grid place-items-center">
                      {active && <Check className="size-4 text-accent" strokeWidth={2.5} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink">{loc.name}</span>
                      <span className="block text-[12px] text-ink-subtle">{loc.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Menu>

      <div className="flex-1 min-w-0 flex justify-end lg:justify-center">
        <Search onNavigate={() => undefined} />
      </div>

      {/* View switch: map ↔ feed */}
      <div
        role="tablist"
        aria-label="View"
        className="hidden lg:flex items-center h-9 p-[3px] rounded-[10px] bg-surface-2 border border-line"
      >
        {[
          { id: "map" as const, label: "Map", icon: MapIcon, active: showingMap },
          { id: "reports" as const, label: "Feed", icon: Rows3, active: showingFeed },
        ].map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={v.active}
            onClick={() => onTabChange(v.id)}
            className={cn(
              "h-full px-3 rounded-[7px] flex items-center gap-1.5 text-[12.5px] font-medium transition-all",
              v.active
                ? "bg-surface text-ink shadow-[0_1px_2px_oklch(0_0_0/0.08),0_0_0_1px_var(--color-line)]"
                : "text-ink-subtle hover:text-ink"
            )}
          >
            <v.icon className="size-3.5" strokeWidth={2} />
            {v.label}
          </button>
        ))}
      </div>

      <div className="hidden lg:block w-px h-6 bg-line mx-1" />

      {/* Notifications */}
      <Menu
        align="right"
        width="w-[22rem]"
        trigger={({ open, toggle }) => (
          <button
            onClick={toggle}
            id="notification-bell-btn"
            aria-label={`Notifications${notificationCount ? ` (${notificationCount} unread)` : ""}`}
            aria-expanded={open}
            className={cn(iconButton, open && "bg-surface-2 text-ink")}
          >
            <Bell className="size-[18px]" strokeWidth={1.75} />
            {notificationCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-accent text-canvas font-mono text-[10px] font-semibold grid place-items-center ring-2 ring-surface">
                {notificationCount}
              </span>
            )}
          </button>
        )}
      >
        {() => (
          <>
            <div className="flex items-center justify-between px-2.5 py-2">
              <span className="text-[13.5px] font-semibold text-ink">Notifications</span>
              {notifications.some((n) => !n.read) && (
                <button
                  onClick={() => markAllNotificationsRead()}
                  className="text-[12px] font-medium text-accent-ink hover:underline underline-offset-2"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto flex flex-col gap-0.5">
              {notifications.length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <Bell className="size-5 mx-auto text-ink-subtle" strokeWidth={1.5} />
                  <p className="mt-2 text-[13px] text-ink-subtle">You&apos;re all caught up.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markNotificationRead(n.id)}
                    className="w-full text-left px-2.5 py-2.5 rounded-lg flex gap-3 hover:bg-surface-2 transition-colors"
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        n.read ? "bg-transparent" : "bg-accent"
                      )}
                    />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-[13px] leading-snug",
                          n.read ? "text-ink-muted" : "text-ink font-medium"
                        )}
                      >
                        {n.title}
                      </span>
                      <span className="block mt-0.5 text-[12.5px] leading-snug text-ink-subtle">
                        {n.body}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </Menu>


      {/* Mobile-only 112 (desktop has it in the nav rail) */}
      <button
        onClick={onOpenEmergency}
        aria-label="Call emergency 112"
        className="md:hidden h-11 px-2.5 rounded-lg bg-danger text-white text-[12.5px] font-semibold flex items-center gap-1.5"
      >
        <PhoneCall className="size-3.5" />
        112
      </button>

      {/* Demo role switcher */}
      <Menu
        align="right"
        width="w-72"
        trigger={({ open, toggle }) => (
          <button
            onClick={toggle}
            aria-expanded={open}
            aria-label="Switch demo role"
            className={cn(
              "h-11 md:h-10 pl-1.5 pr-1.5 md:pr-2 rounded-full sm:rounded-lg flex items-center gap-2.5 hover:bg-surface-2 transition-colors",
              open && "bg-surface-2"
            )}
          >
            <span className="relative size-8 rounded-full bg-surface-3 text-ink grid place-items-center font-mono text-[11px] font-semibold">
              {initials(currentUser.name)}
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface",
                  ROLE_META[currentRole].tone
                )}
              />
            </span>
            <span className="hidden lg:flex flex-col items-start leading-tight">
              <span className="text-[13px] font-medium text-ink">{currentUser.name}</span>
              <span className="text-[11.5px] text-ink-subtle">{ROLE_META[currentRole].label}</span>
            </span>
            <ChevronDown className="hidden lg:block size-3.5 text-ink-subtle" />
          </button>
        )}
      >
        {(close) => (
          <>
            <div className="px-2.5 pt-1.5 pb-2 nl-eyebrow">View as · demo</div>
            {(Object.keys(ROLE_META) as Role[]).map((role) => {
              const active = currentRole === role;
              return (
                <button
                  key={role}
                  onClick={() => {
                    setRole(role);
                    close();
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-3 transition-colors",
                    active ? "bg-accent-soft" : "hover:bg-surface-2"
                  )}
                >
                  <span className="relative size-8 shrink-0 rounded-full bg-surface-3 grid place-items-center font-mono text-[11px] font-semibold text-ink">
                    {initials(DEMO_USERS[role].name)}
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface",
                        ROLE_META[role].tone
                      )}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink">
                      {ROLE_META[role].label}
                    </span>
                    <span className="block text-[12px] text-ink-subtle truncate">
                      {ROLE_META[role].hint}
                    </span>
                  </span>
                  {active && <Check className="size-4 text-accent" strokeWidth={2.5} />}
                </button>
              );
            })}

            {/* Destinations the mobile bottom bar has no room for */}
            <div className="md:hidden mt-1.5 pt-1.5 border-t border-line">
              {NAV_ITEMS.filter(
                (n) =>
                  !["map", "hazards", "reports", "sos"].includes(n.id) &&
                  (!n.roles || n.roles.includes(currentRole))
              ).map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    onTabChange(n.id);
                    close();
                  }}
                  className="w-full h-9 px-2.5 rounded-lg flex items-center gap-3 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
                >
                  <n.icon className="size-4" strokeWidth={1.75} />
                  {n.label}
                </button>
              ))}
              <button
                onClick={() => {
                  onTabChange("settings");
                  close();
                }}
                className="w-full h-9 px-2.5 rounded-lg flex items-center gap-3 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
              >
                <Settings2 className="size-4" strokeWidth={1.75} />
                Settings &amp; audit log
              </button>
            </div>
            <div className="mt-1.5 pt-2 border-t border-line px-1 pb-0.5">
              <div className="nl-eyebrow px-1.5 pb-1.5">Theme</div>
              <ThemeSwitcher />
            </div>
          </>
        )}
      </Menu>
      </div>
    </header>
  );
}
