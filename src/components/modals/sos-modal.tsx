"use client";

import React, { useState } from "react";
import { LifeBuoy, PhoneCall, ShieldCheck, Minus, Plus } from "lucide-react";
import { Dialog, Field, SuccessState, fieldClass } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { LocationPin, useReportPosition } from "./location-pin";
import { cn } from "@/lib/utils";

const SOS_TYPES = [
  { value: "TRAPPED_FLOOD", label: "Stranded by water", hint: "Trapped or cut off by flooding" },
  { value: "MEDICAL", label: "Medical", hint: "Injury, illness or medical evacuation" },
  { value: "EVACUATION", label: "Evacuation", hint: "Elderly, infants or mobility needs" },
  { value: "SUPPLIES", label: "Supplies", hint: "Drinking water or food cut off" },
];
import { useDemo } from "@/context/demo-context";

interface SosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SosModal({ isOpen, onClose }: SosModalProps) {
  const { currentLocality, currentUser, submitSOS } = useDemo();
  const [category, setCategory] = useState("TRAPPED_FLOOD");
  const [peopleCount, setPeopleCount] = useState(1);
  const [phone, setPhone] = useState(currentUser.phone || "+91 ");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const position = useReportPosition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await submitSOS({
      category,
      peopleCount,
      contactPhone: phone,
      description,
      localityName: currentLocality.name,
      latitude: position.lat,
      longitude: position.lng,
    });

    setIsSubmitting(false);

    if (res.success) {
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setDescription("");
        onClose();
      }, 2500);
    } else {
      setErrorMsg(res.error || "Failed to broadcast SOS");
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      accent="danger"
      eyebrow={
        <span className="flex items-center gap-2 !text-danger">
          <span className="nl-live-dot" /> SOS request
        </span>
      }
      title="Request emergency help"
      description="Sent to registered rescue teams in your sector."
    >
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-3">
        <PhoneCall className="size-4 text-danger shrink-0" />
        <p className="flex-1 text-[13px] leading-snug text-ink">
          Life in immediate danger? <span className="font-semibold">Call 112 first.</span>
        </p>
        <a
          href="tel:112"
          className="h-8 px-3 rounded-lg bg-danger text-white text-[12.5px] font-semibold grid place-items-center shrink-0 hover:brightness-110"
        >
          Call 112
        </a>
      </div>

      {submitted ? (
        <SuccessState title="Help request sent">
          Assigned to the Kolkata Disaster Rapid Response Team. The public map shows only an
          approximate area; your exact location and number are visible to responders only.
        </SuccessState>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field label="What do you need?">
            <div className="grid grid-cols-2 gap-2">
              {SOS_TYPES.map((t) => {
                const active = category === t.value;
                return (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => setCategory(t.value)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-danger/60 bg-danger-soft ring-[3px] ring-danger-soft"
                        : "border-line hover:border-line-strong hover:bg-surface-2"
                    )}
                  >
                    <span className="block text-[13px] font-medium text-ink">{t.label}</span>
                    <span className="block mt-0.5 text-[12px] text-ink-subtle leading-snug">{t.hint}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          <LocationPin purpose="sos" />

          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4">
            <Field label="People">
              <div className="flex items-center h-[42px] rounded-lg border border-line bg-surface-2/50">
                <button
                  type="button"
                  aria-label="Fewer people"
                  onClick={() => setPeopleCount((n) => Math.max(1, n - 1))}
                  className="size-10 grid place-items-center text-ink-muted hover:text-ink"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-8 text-center font-mono text-[15px] font-medium text-ink tabular-nums">
                  {peopleCount}
                </span>
                <button
                  type="button"
                  aria-label="More people"
                  onClick={() => setPeopleCount((n) => Math.min(50, n + 1))}
                  className="size-10 grid place-items-center text-ink-muted hover:text-ink"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </Field>
            <Field label="Callback number" htmlFor="sos-phone">
              <input
                id="sos-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={cn(fieldClass, "font-mono")}
              />
            </Field>
          </div>

          <Field label="Situation and nearest landmark" htmlFor="sos-description">
            <textarea
              id="sos-description"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Ground-floor flat flooded, power off, 2 adults and 1 elderly person. Opposite the post office."
              className={cn(fieldClass, "resize-none")}
            />
          </Field>

          <p className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-subtle">
            <ShieldCheck className="size-4 shrink-0 text-ok" />
            Routed only to registered rescue organisations in {currentLocality.name}. Public viewers
            see an approximate circle, never your exact location.
          </p>

          {errorMsg && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
              {errorMsg}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={isSubmitting} className="flex-1 h-10">
              <LifeBuoy />
              {isSubmitting ? "Sending…" : "Send SOS request"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
