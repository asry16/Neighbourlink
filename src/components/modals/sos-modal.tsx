"use client";

import React, { useEffect, useId, useState } from "react";
import { Check, LifeBuoy, PhoneCall, ShieldCheck, Minus, Plus } from "lucide-react";
import { Dialog, Field, fieldClass } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { useDemo } from "@/context/demo-context";
import { useOverlay } from "@/context/overlay-context";
import { SOS_CATEGORY_LABEL, formatDateTime, timeAgo } from "@/lib/status";
import { cn } from "@/lib/utils";
import { LocationField, useDefaultPosition, type PickedLocation } from "./location-field";

const SOS_TYPES = [
  { value: "TRAPPED_FLOOD", label: "Stranded by water", hint: "Trapped or cut off by flooding" },
  { value: "MEDICAL", label: "Medical", hint: "Injury, illness or medical evacuation" },
  { value: "EVACUATION", label: "Evacuation", hint: "Elderly, infants or mobility needs" },
  { value: "SUPPLIES", label: "Supplies", hint: "Drinking water or food cut off" },
];

const STEPS = [
  { status: "REQUESTED", label: "Request received", hint: "Waiting for a responder to acknowledge" },
  { status: "ACKNOWLEDGED", label: "Acknowledged", hint: "A response team has accepted your request" },
  { status: "ASSISTANCE_REPORTED", label: "Help on the way", hint: "The team has posted an update" },
  { status: "RESOLVED", label: "Resolved", hint: "This request is closed" },
];

interface SosModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Hidden (draft kept) while the user picks a location on the map. */
  hidden?: boolean;
}

export function SosModal({ isOpen, onClose, hidden }: SosModalProps) {
  const { currentLocality, currentUser, submitSOS, sosRequests, refreshSOS, resolveSOS } = useDemo();
  const { setDirty } = useOverlay();
  const fallbackPosition = useDefaultPosition();
  const formId = useId();

  const [category, setCategory] = useState("TRAPPED_FLOOD");
  const [peopleCount, setPeopleCount] = useState(1);
  const [phone, setPhone] = useState(currentUser.phone || "+91 ");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmingSafe, setConfirmingSafe] = useState(false);

  // The requester's own open request (from this session or earlier).
  const myOpen = sosRequests
    .filter((s) => s.isExact && s.requesterName === currentUser.name && s.status !== "RESOLVED")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const tracked = sosRequests.find((s) => s.id === sentId) ?? (showForm ? undefined : myOpen);

  const dirty = !tracked && (description.trim() !== "" || location !== null || peopleCount !== 1);
  useEffect(() => {
    setDirty("sos", dirty, "Your SOS request has not been sent. If you leave now it will be discarded.");
  }, [dirty, setDirty]);
  useEffect(() => () => setDirty("sos", false), [setDirty]);

  // Keep the status fresh while it is on screen.
  useEffect(() => {
    if (!isOpen || !tracked || tracked.status === "RESOLVED") return;
    const t = setInterval(() => refreshSOS(), 15_000);
    return () => clearInterval(t);
  }, [isOpen, tracked, refreshSOS]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    const where = location ?? fallbackPosition;
    const res = await submitSOS({
      category,
      peopleCount,
      contactPhone: phone,
      description,
      localityName: currentLocality.name,
      latitude: where.lat,
      longitude: where.lng,
    });
    setIsSubmitting(false);
    if (res.success && res.data?.id) {
      setSentId(res.data.id);
      setShowForm(false);
      setDescription("");
      setLocation(null);
      setPeopleCount(1);
    } else {
      setErrorMsg(res.error || "Your SOS could not be sent. Please try again, or call 112.");
    }
  };

  const markSafe = async () => {
    if (!tracked) return;
    setIsSubmitting(true);
    const res = await resolveSOS(tracked.id, "Requester confirmed they are safe.");
    setIsSubmitting(false);
    setConfirmingSafe(false);
    if (!res.success) setErrorMsg(res.message || "Could not update the request.");
  };

  const call112 = (
    <div className="mb-5 flex items-center gap-3 rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-3">
      <PhoneCall className="size-4 text-danger shrink-0" />
      <p className="flex-1 text-[13px] leading-snug text-ink">
        Life in immediate danger? <span className="font-semibold">Call 112 first.</span>
      </p>
      <a href="tel:112" className="h-11 sm:h-9 px-3 rounded-lg bg-danger text-white text-[13px] font-semibold grid place-items-center shrink-0 hover:brightness-110">
        Call 112
      </a>
    </div>
  );

  /* ---------------------------------------------------------- Status -- */
  if (tracked) {
    const stepIndex = Math.max(0, STEPS.findIndex((s) => s.status === tracked.status));
    const updates: { id: string; message: string; createdAt: string }[] = tracked.updates ?? [];
    return (
      <Dialog
        open={isOpen}
        hidden={hidden}
        onClose={onClose}
        accent="danger"
        eyebrow={<span className="!text-danger">SOS · {tracked.trackingCode}</span>}
        title={tracked.status === "RESOLVED" ? "Request resolved" : "Your request has been sent"}
        description={`${SOS_CATEGORY_LABEL[tracked.category as keyof typeof SOS_CATEGORY_LABEL] ?? "Emergency request"} · sent ${timeAgo(tracked.createdAt)}`}
        footer={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="h-11" onClick={onClose}>
              Back to map
            </Button>
            {tracked.status !== "RESOLVED" && !confirmingSafe && (
              <Button className="h-11 flex-1" onClick={() => setConfirmingSafe(true)}>
                I&apos;m safe now
              </Button>
            )}
            {tracked.status === "RESOLVED" && (
              <Button className="h-11 flex-1" onClick={() => { setSentId(null); setShowForm(true); }}>
                Send a new request
              </Button>
            )}
            {tracked.status !== "RESOLVED" && (
              <button
                onClick={() => { setSentId(null); setShowForm(true); }}
                className="w-full h-10 text-[13px] font-medium text-ink-muted hover:text-ink underline underline-offset-2"
              >
                Need different help? Send another request
              </button>
            )}
          </div>
        }
      >
        {call112}
        <ol className="flex flex-col" aria-label="Request status">
          {STEPS.map((step, i) => {
            const done = i < stepIndex || tracked.status === "RESOLVED";
            const current = i === stepIndex && tracked.status !== "RESOLVED";
            return (
              <li key={step.status} className="flex gap-3" aria-current={current ? "step" : undefined}>
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "size-6 rounded-full grid place-items-center text-[11px] font-semibold border",
                      done ? "bg-ok border-ok text-white" : current ? "border-danger text-danger" : "border-line text-ink-subtle"
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  {i < STEPS.length - 1 && <span className="w-px flex-1 min-h-5 bg-line" />}
                </div>
                <div className="pb-4">
                  <div className={cn("text-[13.5px] font-medium", current || done ? "text-ink" : "text-ink-subtle")}>{step.label}</div>
                  <div className="text-[12px] text-ink-subtle">{step.hint}</div>
                </div>
              </li>
            );
          })}
        </ol>

        <dl className="mt-1 rounded-lg border border-line divide-y divide-line text-[13px]">
          <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-ink-subtle">Sent to</dt><dd className="text-ink text-right">{tracked.assignedOrgName ?? "Participating responders in your area"}</dd></div>
          <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-ink-subtle">Callback</dt><dd className="font-mono text-ink">{tracked.contactPhone}</dd></div>
          <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-ink-subtle">People</dt><dd className="text-ink">{tracked.peopleCount}</dd></div>
        </dl>

        {updates.length > 0 && (
          <div className="mt-4">
            <h3 className="nl-eyebrow mb-2">Updates from responders</h3>
            <ul className="flex flex-col gap-2">
              {updates.map((u) => (
                <li key={u.id} className="rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
                  <div className="text-ink">{u.message}</div>
                  <div className="text-[11.5px] text-ink-subtle mt-0.5">{formatDateTime(u.createdAt)}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-4 text-[12px] text-ink-subtle">
          Status refreshes automatically. In-app notifications tell you when it changes; they are
          separate from a responder acknowledging your request.
        </p>

        {confirmingSafe && (
          <div role="alert" className="mt-4 rounded-lg border border-line p-3 animate-rise">
            <p className="text-[13.5px] text-ink font-medium">Close this request?</p>
            <p className="text-[12.5px] text-ink-subtle mt-0.5">Responders will be told you no longer need help.</p>
            <div className="mt-3 flex gap-2">
              <Button variant="primary" className="h-11 flex-1" disabled={isSubmitting} onClick={markSafe}>
                Yes, I&apos;m safe
              </Button>
              <Button className="h-11" onClick={() => setConfirmingSafe(false)}>
                Keep open
              </Button>
            </div>
          </div>
        )}
        {errorMsg && <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger">{errorMsg}</p>}
      </Dialog>
    );
  }

  /* ------------------------------------------------------------ Form -- */
  return (
    <Dialog
      open={isOpen}
      hidden={hidden}
      onClose={onClose}
      accent="danger"
      eyebrow={<span className="flex items-center gap-2 !text-danger"><span className="nl-live-dot" /> SOS request</span>}
      title="Request emergency help"
      description="Sent to registered rescue teams in your area."
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="h-11" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="danger" disabled={isSubmitting} className="flex-1 h-11">
            <LifeBuoy />
            {isSubmitting ? "Sending…" : "Send SOS request"}
          </Button>
        </div>
      }
    >
      {call112}
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="What do you need?">
          <div role="radiogroup" aria-label="What do you need?" className="grid grid-cols-2 gap-2">
            {SOS_TYPES.map((t) => {
              const active = category === t.value;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-autofocus={active ? "" : undefined}
                  key={t.value}
                  onClick={() => setCategory(t.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left transition-colors",
                    active ? "border-danger/60 bg-danger-soft ring-[3px] ring-danger-soft" : "border-line hover:border-line-strong hover:bg-surface-2"
                  )}
                >
                  <span className="block text-[13px] font-medium text-ink">{t.label}</span>
                  <span className="block mt-0.5 text-[12px] text-ink-subtle leading-snug">{t.hint}</span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Your location">
          <LocationField value={location} onChange={setLocation} purpose="sos" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4">
          <Field label="People">
            <div className="flex items-center h-11 rounded-lg border border-line bg-surface-2/50 w-fit">
              <button type="button" aria-label="Fewer people" onClick={() => setPeopleCount((n) => Math.max(1, n - 1))} className="size-11 grid place-items-center text-ink-muted hover:text-ink">
                <Minus className="size-4" />
              </button>
              <span aria-live="polite" className="w-8 text-center font-mono text-[15px] font-medium text-ink tabular-nums">{peopleCount}</span>
              <button type="button" aria-label="More people" onClick={() => setPeopleCount((n) => Math.min(50, n + 1))} className="size-11 grid place-items-center text-ink-muted hover:text-ink">
                <Plus className="size-4" />
              </button>
            </div>
          </Field>
          <Field label="Callback number" htmlFor="sos-phone">
            <input id="sos-phone" type="tel" required autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={cn(fieldClass, "font-mono")} />
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

        <div className="rounded-lg bg-surface-2 p-3 text-[12.5px] leading-snug text-ink-muted">
          <div className="flex items-center gap-2 font-medium text-ink">
            <ShieldCheck className="size-4 text-ok" /> Who receives this
          </div>
          <ul className="mt-1.5 list-disc pl-5 space-y-0.5">
            <li>Registered rescue organisations participating in {currentLocality.name}.</li>
            <li>They see your exact location and callback number.</li>
            <li>Everyone else sees only an approximate ~1 km area — never your number.</li>
            <li>This is not a 112 call. Neighbourlink does not alert police or ambulance services.</li>
          </ul>
        </div>

        {errorMsg && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
            {errorMsg}
          </p>
        )}
      </form>
    </Dialog>
  );
}
