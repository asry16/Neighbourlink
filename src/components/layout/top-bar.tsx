"use client";

import React, { useCallback, useRef, useState } from "react";
import { PhoneCall, Bell, ChevronDown, Check, Settings2, LogOut } from "lucide-react";
import { useDemo, type Role } from "@/context/demo-context";
import { useOverlay } from "@/context/overlay-context";
import { GoogleLogo } from "@/components/modals/auth-modal";
import { NAV_ITEMS } from "@/lib/navigation";
import { DEFAULT_NOTIFY_PREFS, NOTIFY_PREFS_KEY, useLocalPref, type NotificationPrefs } from "@/lib/local-prefs";
import { useDismiss } from "@/lib/use-dismiss";
import { timeAgo } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Search } from "./search";

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

/**
 * Small popover. Closes on outside click / Escape, and whenever a main
 * overlay opens so popovers never sit on top of a form or drawer.
 */
function Menu({
  label,
  trigger,
  children,
  width = "w-72",
}: {
  label: string;
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const { overlay } = useOverlay();
  useDismiss(ref, open, close);
  // Close when a main overlay opens (reset during render, not in an effect).
  const [seenOverlay, setSeenOverlay] = useState(overlay);
  if (seenOverlay !== overlay) {
    setSeenOverlay(overlay);
    if (open) setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "fixed md:absolute left-2 right-2 md:left-auto md:right-0 top-[calc(3.75rem+env(safe-area-inset-top))] md:top-full md:mt-2 z-50 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)] animate-rise max-h-[70dvh] overflow-y-auto",
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

/** Compact header: locality search, notifications, Call 112 (mobile), profile. */
export function TopBar({ onOpenEmergency }: { onOpenEmergency: () => void }) {
  const {
    currentRole,
    currentUser,
    setCurrentUserId,
    authUser,
    isGoogleUser,
    profiles,
    logout,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    setSelectedIncidentId,
  } = useDemo();
  const { open } = useOverlay();
  const [prefs] = useLocalPref<NotificationPrefs>(NOTIFY_PREFS_KEY, DEFAULT_NOTIFY_PREFS);

  // Respect per-device notification preferences (unknown types always shown).
  const visible = notifications.filter((n) => prefs[n.type as keyof NotificationPrefs] !== false);
  const unread = visible.filter((n) => !n.read).length;

  const openRelated = (link?: string | null) => {
    const [kind, id] = (link ?? "").split(":");
    if (!id || (kind !== "sos" && kind !== "incident")) return;
    setSelectedIncidentId(id);
    void open({ kind: "details", id });
  };

  return (
    <header className="shrink-0 border-b border-line bg-surface pt-[env(safe-area-inset-top)] relative z-50">
      <div className="h-14 md:h-16 px-2 md:px-4 flex items-center gap-1 md:gap-2">
        <div className="flex-1 min-w-0">
          <Search />
        </div>

        {/* Notifications */}
        <Menu
          label="Notifications"
          width="md:w-[22rem]"
          trigger={({ open: isOpen, toggle }) => (
            <button
              onClick={toggle}
              id="notification-bell-btn"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
              aria-expanded={isOpen}
              aria-haspopup="dialog"
              className={cn(iconButton, isOpen && "bg-surface-2 text-ink")}
            >
              <Bell className="size-[18px]" strokeWidth={1.75} />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-accent text-canvas font-mono text-[10px] font-semibold grid place-items-center ring-2 ring-surface">
                  {unread}
                </span>
              )}
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="flex items-center justify-between px-2.5 py-2">
                <span className="text-[13.5px] font-semibold text-ink">Notifications</span>
                {unread > 0 && (
                  <button
                    onClick={() => markAllNotificationsRead()}
                    className="h-9 px-2 text-[12px] font-medium text-accent-ink hover:underline underline-offset-2"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {visible.length === 0 ? (
                <p className="px-3 py-8 text-center text-[13px] text-ink-subtle">No notifications.</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {visible.map((n) => {
                    const actionable = /^(sos|incident):/.test(n.link ?? "");
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => {
                            if (!n.read) void markNotificationRead(n.id);
                            if (actionable) {
                              close();
                              openRelated(n.link);
                            }
                          }}
                          className="w-full min-h-11 text-left px-2.5 py-2.5 rounded-lg flex gap-3 hover:bg-surface-2"
                        >
                          <span
                            aria-hidden
                            className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent border border-line-strong" : "bg-accent")}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="sr-only">{n.read ? "Read: " : "Unread: "}</span>
                            <span className={cn("block text-[13px] leading-snug", n.read ? "text-ink-muted" : "text-ink font-medium")}>
                              {n.title}
                            </span>
                            <span className="block mt-0.5 text-[12.5px] leading-snug text-ink-subtle">{n.body}</span>
                            <span className="mt-1 flex gap-2 text-[11.5px] text-ink-subtle">
                              {timeAgo(n.createdAt)}
                              {actionable && <span className="text-accent-ink font-medium">Open details →</span>}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </Menu>

        {/* Call 112 — always in the header on mobile (desktop has it in the rail) */}
        <button
          onClick={onOpenEmergency}
          aria-label="Call emergency number 112"
          className="md:hidden h-11 px-3 rounded-lg bg-danger text-white text-[13px] font-semibold flex items-center gap-1.5"
        >
          <PhoneCall className="size-3.5" />
          112
        </button>

        {/* Google Sign In Quick Action */}
        {!authUser && (
          <button
            onClick={() => void open({ kind: "auth" })}
            aria-label="Sign in with Google"
            className="h-10 px-3 rounded-lg border border-line bg-surface hover:bg-surface-2 text-ink text-[13px] font-medium flex items-center gap-2 transition-colors shrink-0 shadow-xs"
          >
            <GoogleLogo className="size-4 shrink-0" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}

        {/* Profile */}
        <Menu
          label="Profile"
          trigger={({ open: isOpen, toggle }) => (
            <button
              onClick={toggle}
              aria-expanded={isOpen}
              aria-haspopup="dialog"
              aria-label={`Profile: ${currentUser.name}, ${ROLE_META[currentRole].label}`}
              className={cn("h-11 md:h-10 pl-1 pr-1 md:pr-2 rounded-full md:rounded-lg flex items-center gap-2.5 hover:bg-surface-2", isOpen && "bg-surface-2")}
            >
              <span className="relative size-9 md:size-8 rounded-full bg-surface-3 text-ink grid place-items-center font-mono text-[11px] font-semibold overflow-visible">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="size-full rounded-full object-cover"
                  />
                ) : (
                  initials(currentUser.name)
                )}
                <span className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface", ROLE_META[currentRole].tone)} />
              </span>
              <span className="hidden lg:flex flex-col items-start leading-tight">
                <span className="text-[13px] font-medium text-ink flex items-center gap-1.5">
                  {currentUser.name}
                  {isGoogleUser && <GoogleLogo className="size-3 shrink-0" />}
                </span>
                <span className="text-[11.5px] text-ink-subtle">{ROLE_META[currentRole].label}</span>
              </span>
              <ChevronDown className="hidden lg:block size-3.5 text-ink-subtle" />
            </button>
          )}
        >
          {(close) => (
            <>
              {authUser ? (
                <div className="px-2.5 py-2 mb-1.5 rounded-lg bg-surface-2 border border-line/60">
                  <div className="flex items-center gap-2.5">
                    {authUser.avatarUrl ? (
                      <img src={authUser.avatarUrl} alt={authUser.name} className="size-8 rounded-full object-cover" />
                    ) : (
                      <span className="size-8 rounded-full bg-accent text-accent-ink grid place-items-center text-xs font-semibold">
                        {authUser.name[0]}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-ink truncate">{authUser.name}</div>
                      <div className="text-[11.5px] text-ink-subtle truncate flex items-center gap-1">
                        <GoogleLogo className="size-3 shrink-0" />
                        <span className="truncate">{authUser.email}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    close();
                    void open({ kind: "auth" });
                  }}
                  className="w-full mb-1.5 h-10 px-2.5 rounded-lg border border-line bg-surface hover:bg-surface-2 text-ink text-[13px] font-medium flex items-center gap-2.5"
                >
                  <GoogleLogo className="size-4 shrink-0" />
                  <span>Sign in with Google</span>
                </button>
              )}

              <div className="px-2.5 pt-1.5 pb-2 nl-eyebrow">Switch Active Profile</div>
              {profiles.map((user) => {
                const active = currentUser.id === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => {
                      setCurrentUserId(user.id);
                      close();
                    }}
                    aria-label={`View as ${user.name}, ${ROLE_META[user.role].label}`}
                    className={cn("w-full min-h-11 text-left px-2.5 py-2 rounded-lg flex items-center gap-3", active ? "bg-accent-soft" : "hover:bg-surface-2")}
                  >
                    <span className="relative size-8 shrink-0 rounded-full bg-surface-3 grid place-items-center font-mono text-[11px] font-semibold text-ink overflow-visible">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="size-full rounded-full object-cover" />
                      ) : (
                        initials(user.name)
                      )}
                      <span className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface", ROLE_META[user.role].tone)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-ink flex items-center gap-1.5">
                        <span className="truncate">{user.name}</span>
                        {user.isGoogleUser && <GoogleLogo className="size-3 shrink-0" />}
                      </span>
                      <span className="block text-[12px] text-ink-subtle truncate">{ROLE_META[user.role].label} · {ROLE_META[user.role].hint}</span>
                    </span>
                    {active && <Check className="size-4 text-accent" strokeWidth={2.5} />}
                  </button>
                );
              })}
              <div className="mt-1.5 pt-1.5 border-t border-line space-y-0.5">
                {/* Panels the mobile bottom bar has no room for */}
                {NAV_ITEMS.filter((n) => (n.id === "help" || n.id === "responder") && (!n.roles || n.roles.includes(currentRole))).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => void open({ kind: n.id as "help" | "responder" })}
                    className="md:hidden w-full h-11 px-2.5 rounded-lg flex items-center gap-3 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
                  >
                    <n.icon className="size-4" strokeWidth={1.75} />
                    {n.label}
                  </button>
                ))}
                <button
                  onClick={() => void open({ kind: "settings" })}
                  className="w-full h-11 px-2.5 rounded-lg flex items-center gap-3 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink"
                >
                  <Settings2 className="size-4" strokeWidth={1.75} />
                  Settings
                </button>
                {authUser && (
                  <button
                    onClick={() => {
                      close();
                      void logout();
                    }}
                    className="w-full h-11 px-2.5 rounded-lg flex items-center gap-3 text-[13px] text-danger hover:bg-danger-soft transition-colors"
                  >
                    <LogOut className="size-4" strokeWidth={1.75} />
                    Sign Out
                  </button>
                )}
              </div>
            </>
          )}
        </Menu>
      </div>
    </header>
  );
}
