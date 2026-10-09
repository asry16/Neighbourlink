"use client";

import React, { useEffect } from "react";
import { PhoneCall, X } from "lucide-react";

const HELPLINES = [
  { label: "National emergency", number: "112", primary: true },
  { label: "Disaster management cell (WB)", number: "1070" },
  { label: "WB control room", number: "033-2214-3526" },
  { label: "Ambulance", number: "102 / 108" },
];

export function EmergencyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/55 backdrop-blur-[3px] p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="emergency-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px] rounded-2xl bg-surface border border-line shadow-[var(--shadow-float)] animate-rise overflow-hidden"
      >
        <div className="h-1 bg-danger" />
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-4 size-8 grid place-items-center rounded-lg text-ink-subtle hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" />
        </button>

        <div className="p-6">
          <div className="nl-eyebrow !text-danger flex items-center gap-2">
            <span className="nl-live-dot" /> Immediate danger
          </div>
          <h2 id="emergency-title" className="mt-2 text-[22px] font-semibold text-ink leading-tight">
            Call emergency services first
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
            Neighbourlink is a community awareness tool and is not a substitute for official
            dispatch. If anyone is at risk right now, call 112.
          </p>

          <dl className="mt-5 rounded-xl border border-line divide-y divide-line">
            {HELPLINES.map((h) => (
              <div key={h.label} className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-[13px] text-ink-muted">{h.label}</dt>
                <dd
                  className={
                    h.primary
                      ? "font-mono text-[15px] font-semibold text-danger"
                      : "font-mono text-[13px] font-medium text-ink"
                  }
                >
                  {h.number}
                </dd>
              </div>
            ))}
          </dl>

          <a
            href="tel:112"
            className="mt-5 h-11 w-full rounded-xl bg-danger text-white font-semibold text-[14px] flex items-center justify-center gap-2 hover:brightness-110 transition"
          >
            <PhoneCall className="size-4" />
            Call 112 now
          </a>
        </div>
      </div>
    </div>
  );
}
