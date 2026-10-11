"use client";

import React from "react";
import { Check, Star } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { ThemeSwitcher } from "@/components/theme-toggle";
import { GoogleLogo } from "@/components/modals/auth-modal";
import { MapProviderSettings } from "@/components/views/map-provider-settings";
import { useDemo, DEMO_LOCALITIES, type Role } from "@/context/demo-context";
import { useOverlay } from "@/context/overlay-context";
import {
  DEFAULT_NOTIFY_PREFS,
  NOTIFY_PREFS_KEY,
  SAVED_AREAS_KEY,
  useLocalPref,
  type NotificationPrefs,
} from "@/lib/local-prefs";
import { cn } from "@/lib/utils";

const NOTIFY_LABELS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: "SOS_UPDATE", label: "My SOS requests", hint: "Acknowledgements and rescue updates" },
  { key: "HAZARD_ALERT", label: "Official warnings", hint: "New advisories for your areas" },
  { key: "CORROBORATION", label: "Report activity", hint: "When neighbours confirm or dispute" },
  { key: "SOS_DISPATCH", label: "Dispatch alerts", hint: "Responders only" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-4 first:pt-0 border-b border-line last:border-0">
      <h3 className="nl-eyebrow mb-3">{title}</h3>
      {children}
    </section>
  );
}

const switchCls = (on: boolean) =>
  `relative shrink-0 w-9 h-5 rounded-full transition-colors ${on ? "bg-accent" : "bg-surface-3"}`;
const knobCls = (on: boolean) =>
  `absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${on ? "left-[18px]" : "left-0.5"}`;

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { authUser, logout, currentUser, currentRole, setRole, currentLocality, setLocality } = useDemo();
  const { open: openOverlay } = useOverlay();
  const [saved, setSaved] = useLocalPref<string[]>(SAVED_AREAS_KEY, []);
  const [notify, setNotify] = useLocalPref<NotificationPrefs>(NOTIFY_PREFS_KEY, DEFAULT_NOTIFY_PREFS);

  const toggleSaved = (id: string) =>
    setSaved(saved.includes(id) ? saved.filter((s) => s !== id) : [...saved, id]);

  return (
    <Dialog open={open} onClose={onClose} title="Settings" size="sm">
      <Section title="Account & Verification">
        {authUser ? (
          <div className="p-3 rounded-xl border border-line bg-surface-2 space-y-2.5">
            <div className="flex items-center gap-3">
              {authUser.avatarUrl ? (
                <img src={authUser.avatarUrl} alt={authUser.name} className="size-10 rounded-full object-cover ring-1 ring-line" />
              ) : (
                <div className="size-10 rounded-full bg-accent text-accent-ink font-semibold grid place-items-center text-sm">
                  {authUser.name[0]}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-ink flex items-center gap-1.5">
                  <span className="truncate">{authUser.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-ok-soft text-ok border border-ok/30">Verified</span>
                </div>
                <div className="text-[12px] text-ink-subtle truncate">{authUser.email}</div>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                void logout();
              }}
              className="w-full h-8.5 rounded-lg border border-danger/30 text-danger hover:bg-danger-soft text-[12px] font-medium transition-colors"
            >
              Sign out of Google
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-line bg-surface-2 space-y-2.5">
            <p className="text-[12px] text-ink-subtle leading-relaxed">
              Sign in with your Google account for verified civic contributions and emergency dispatches.
            </p>
            <button
              onClick={() => {
                onClose();
                void openOverlay({ kind: "auth" });
              }}
              className="w-full h-9 rounded-lg border border-line bg-surface hover:bg-surface-3 text-ink text-[12.5px] font-medium flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <GoogleLogo className="size-3.5 shrink-0" />
              <span>Connect Google Account</span>
            </button>
          </div>
        )}
      </Section>

      <Section title="Appearance">
        <ThemeSwitcher />
      </Section>

      <Section title="Saved areas">
        <p className="text-[12.5px] text-ink-subtle mb-2">
          Starred areas appear first in search. Saved on this device.
        </p>
        <ul className="flex flex-col">
          {DEMO_LOCALITIES.map((loc) => {
            const isSaved = saved.includes(loc.id);
            const isCurrent = currentLocality.id === loc.id;
            return (
              <li key={loc.id} className="flex items-center gap-1">
                <button
                  onClick={() => toggleSaved(loc.id)}
                  aria-pressed={isSaved}
                  aria-label={`${isSaved ? "Remove" : "Save"} ${loc.name}`}
                  className="size-11 md:size-9 grid place-items-center rounded-lg hover:bg-surface-2"
                >
                  <Star className={cn("size-4", isSaved ? "fill-amber-400 text-amber-500" : "text-ink-subtle")} />
                </button>
                <button
                  onClick={() => setLocality(loc)}
                  className="flex-1 min-h-11 md:min-h-9 text-left rounded-lg px-2 hover:bg-surface-2 flex items-center justify-between gap-2"
                >
                  <span className="text-[13px] text-ink">{loc.name}</span>
                  {isCurrent && (
                    <span className="text-[11.5px] text-accent-ink inline-flex items-center gap-1">
                      <Check className="size-3" /> Current
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Notifications">
        <p className="text-[12.5px] text-ink-subtle mb-2">
          Controls which in-app notifications are listed on this device. Neighbourlink does not
          send SMS or email. For emergencies always call 112.
        </p>
        {NOTIFY_LABELS.filter((n) => n.key !== "SOS_DISPATCH" || currentRole !== "RESIDENT").map((n) => (
          <button
            key={n.key}
            role="switch"
            aria-checked={notify[n.key]}
            onClick={() => setNotify({ ...notify, [n.key]: !notify[n.key] })}
            className="w-full min-h-11 flex items-center gap-3 px-1 text-left"
          >
            <span className="flex-1">
              <span className="block text-[13px] text-ink">{n.label}</span>
              <span className="block text-[12px] text-ink-subtle">{n.hint}</span>
            </span>
            <span className={switchCls(notify[n.key])}>
              <span className={knobCls(notify[n.key])} />
            </span>
          </button>
        ))}
      </Section>

      <Section title="Account">
        <dl className="text-[13px] space-y-1">
          <div className="flex justify-between gap-3"><dt className="text-ink-subtle">Name</dt><dd className="text-ink">{currentUser.name}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-ink-subtle">Email</dt><dd className="text-ink truncate">{currentUser.email}</dd></div>
        </dl>
        <div className="mt-3">
          <div className="text-[12.5px] text-ink-subtle mb-1.5">
            Demo role (local testing only — there is no sign-in yet)
          </div>
          <div role="radiogroup" aria-label="Demo role" className="grid grid-cols-3 gap-0.5 p-0.5 rounded-lg bg-surface-2 border border-line">
            {(["RESIDENT", "RESPONDER", "ADMIN"] as Role[]).map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={currentRole === r}
                onClick={() => setRole(r)}
                className={cn(
                  "h-11 md:h-8 rounded-md text-[12.5px] font-medium capitalize",
                  currentRole === r ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-subtle hover:text-ink"
                )}
              >
                {r.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Map provider (diagnostics)">
        <MapProviderSettings embedded />
      </Section>
    </Dialog>
  );
}
