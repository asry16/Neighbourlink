"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  PhoneCall,
  CheckCircle,
  CheckCircle2,
} from "lucide-react";
import { Badge, humanize } from "@/components/ui/primitives";
import { SOS_CATEGORY_LABEL, SOS_TONE } from "@/lib/status";
import { useDemo } from "@/context/demo-context";

export function ResponderView({ embedded = false }: { embedded?: boolean }) {
  const { currentUser, sosRequests, acknowledgeSOS, resolveSOS } = useDemo();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAcknowledge = async (id: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    const res = await acknowledgeSOS(id);
    setIsProcessing(false);
    setFeedback(res.message || "Request ACKNOWLEDGED. Requester informed that KDRRT unit is responding.");
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleMarkResolved = async (id: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    const res = await resolveSOS(id);
    setIsProcessing(false);
    setFeedback(res.message || "Rescue mission marked RESOLVED. Incident archived to audit logs.");
    setTimeout(() => setFeedback(null), 4000);
  };

  const URGENCY: Record<string, number> = { REQUESTED: 0, ACKNOWLEDGED: 1, ASSISTANCE_REPORTED: 2, RESOLVED: 3 };
  const queue = [...sosRequests].sort(
    (a, b) =>
      (URGENCY[a.status] ?? 9) - (URGENCY[b.status] ?? 9) ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const counts = {
    REQUESTED: sosRequests.filter((s) => s.status === "REQUESTED").length,
    ACTIVE: sosRequests.filter((s) => s.status === "ACKNOWLEDGED" || s.status === "ASSISTANCE_REPORTED").length,
    RESOLVED: sosRequests.filter((s) => s.status === "RESOLVED").length,
  };

  return (
    <div className={embedded ? "" : "flex-1 overflow-y-auto"}>
     <div className={embedded ? "p-4 flex flex-col gap-5" : "px-4 md:px-8 py-6 md:py-10 max-w-4xl mx-auto w-full flex flex-col gap-8"}>
      <header>
        {!embedded && (<>
        <div className="nl-eyebrow flex items-center gap-2">
          <ShieldCheck className="size-3.5 text-ok" /> Authorised personnel · KDRRT
        </div>
        <h1 className="mt-2 text-[30px] md:text-[36px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
          Response station
        </h1>
        <p className="mt-2 text-[14px] text-ink-muted max-w-xl">
          Signed in as {currentUser.name}. Exact coordinates and callback numbers are unredacted
          here — handle them accordingly.
        </p>
        </>)}
        {embedded && (
          <p className="text-[12.5px] text-ink-subtle">
            Exact locations and callback numbers are visible to you as a verified responder.
          </p>
        )}
        <div className={`${embedded ? "mt-3" : "mt-6"} grid grid-cols-3 gap-px rounded-[var(--radius-card)] border border-line bg-line overflow-hidden`}>
          {[
            { label: "Awaiting response", value: counts.REQUESTED, danger: true },
            { label: "In progress", value: counts.ACTIVE },
            { label: "Resolved", value: counts.RESOLVED },
          ].map((s) => (
            <div key={s.label} className={embedded ? "bg-surface px-3 py-3" : "bg-surface px-5 py-4"}>
              <div
                className={`font-display ${embedded ? "text-[22px]" : "text-[28px]"} font-semibold tabular-nums leading-none ${
                  s.danger && s.value > 0 ? "text-danger" : "text-ink"
                }`}
              >
                {s.value}
              </div>
              <div className="mt-2 text-[12.5px] text-ink-subtle">{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-[12.5px] flex items-center gap-2 animate-rise">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Active Triage Queue */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[19px] font-semibold text-ink">Triage queue</h2>
          <span className="text-[12.5px] text-ink-subtle">Most urgent first</span>
        </div>

        <div className="space-y-3">
          {queue.map((sos) => (
            <div
              key={sos.id}
              className={`p-5 rounded-[var(--radius-card)] border bg-surface space-y-4 ${sos.status === "REQUESTED" ? "border-danger/40 shadow-[0_0_0_3px_var(--color-danger-soft)]" : "border-line"} ${sos.status === "RESOLVED" ? "opacity-70" : ""}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={SOS_TONE[sos.status as keyof typeof SOS_TONE] ?? "neutral"}>
                    {humanize(sos.status)}
                  </Badge>
                  <span className="text-[12.5px] font-mono font-semibold text-ink-subtle">
                    {sos.trackingCode}
                  </span>
                </div>

                <div className="text-[12.5px] text-ink-subtle">
                  Broadcasted {new Date(sos.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} IST
                </div>
              </div>

              <div>
                <h4 className="text-base font-semibold text-ink">
                  {SOS_CATEGORY_LABEL[sos.category as keyof typeof SOS_CATEGORY_LABEL] ?? "Emergency request"} · {sos.peopleCount} {sos.peopleCount > 1 ? "people" : "person"}
                </h4>
                <p className="text-[12.5px] text-ink-muted mt-1 leading-relaxed">
                  {sos.description}
                </p>
              </div>

              {/* Responder Details Box */}
              <div className="p-3 rounded-xl bg-surface-2 border border-line grid grid-cols-1 md:grid-cols-3 gap-3 text-[12.5px]">
                <div>
                  <span className="text-[12px] text-ink-subtle uppercase block font-semibold">
                    Precise GPS Coordinates
                  </span>
                  <span className="font-mono font-medium text-ink">
                    {sos.exactLatitude.toFixed(4)}° N, {sos.exactLongitude.toFixed(4)}° E
                  </span>
                </div>
                <div>
                  <span className="text-[12px] text-ink-subtle uppercase block font-semibold">
                    Requester Contact
                  </span>
                  <span className="font-semibold text-ink">
                    {sos.contactPhone} ({sos.requesterName})
                  </span>
                </div>
                <div>
                  <span className="text-[12px] text-ink-subtle uppercase block font-semibold">
                    Assigned Unit
                  </span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {sos.assignedOrgName || "Pending Assignment"}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-1">
                {sos.status === "REQUESTED" && (
                  <button
                    onClick={() => handleAcknowledge(sos.id)}
                    className="py-2 px-4 rounded-xl bg-ink text-canvas hover:opacity-90 font-semibold text-[12.5px] shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Acknowledge & Dispatch Boat Unit</span>
                  </button>
                )}

                {sos.status === "ACKNOWLEDGED" && (
                  <button
                    onClick={() => handleMarkResolved(sos.id)}
                    className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[12.5px] shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Evacuation / Mark Resolved</span>
                  </button>
                )}

                <a
                  href={`tel:${sos.contactPhone}`}
                  className="py-2 px-3 rounded-xl border border-line hover:bg-surface-2 text-ink-muted font-medium text-[12.5px] flex items-center gap-1.5 transition-colors"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Call Requester Directly</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
     </div>
    </div>
  );
}
