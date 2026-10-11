"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  ImagePlus,
  Waves,
  Mountain,
  CloudLightning,
  Activity,
  CircleHelp,
  X,
} from "lucide-react";
import { Dialog, Field, SuccessState, fieldClass } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { useDemo } from "@/context/demo-context";
import { useOverlay } from "@/context/overlay-context";
import { reencodeImage, uploadEvidence } from "@/lib/photo-upload";
import { cn } from "@/lib/utils";
import { LocationField, useDefaultPosition, type PickedLocation } from "./location-field";

const CATEGORIES = [
  { value: "FLOOD_WATERLOGGING", label: "Flooding / waterlogging", stored: "Waterlogging / Flooding", icon: Waves },
  { value: "STORM_DAMAGE", label: "Storm damage", stored: "Storm Damage / Fallen Tree", icon: CloudLightning },
  { value: "LANDSLIDE", label: "Landslide / bank erosion", stored: "Landslide / Riverbank Scour", icon: Mountain },
  { value: "EARTHQUAKE_OBSERVATION", label: "Felt a tremor", stored: "Earthquake Observation", icon: Activity },
  { value: "OTHER_HAZARD", label: "Something else", stored: "Environmental Hazard", icon: CircleHelp },
];

const MAX_PHOTOS = 4;

/** `YYYY-MM-DDTHH:mm` in local time, for <input type="datetime-local">. */
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface Photo {
  id: string;
  file: File;
  preview: string;
}

interface ReportHazardModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Hidden (draft kept) while the user picks a location on the map. */
  hidden?: boolean;
}

export function ReportHazardModal({ isOpen, onClose, hidden }: ReportHazardModalProps) {
  const { currentLocality, createIncidentReport } = useDemo();
  const { setDirty } = useOverlay();
  const fallbackPosition = useDefaultPosition();
  const formId = useId();

  const [category, setCategory] = useState("FLOOD_WATERLOGGING");
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [observedAt, setObservedAt] = useState(() => toLocalInput(new Date()));
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [status, setStatus] = useState<"editing" | "uploading" | "submitting" | "done">("editing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dirty =
    status !== "done" && (description.trim() !== "" || impact.trim() !== "" || photos.length > 0 || location !== null);

  useEffect(() => {
    setDirty("report", dirty, "Your hazard report hasn't been submitted. Discard it?");
  }, [dirty, setDirty]);
  useEffect(() => () => setDirty("report", false), [setDirty]);

  // Release preview URLs on unmount (removal revokes its own URL below).
  const photosRef = useRef<Photo[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const accepted = [...files]
      .filter((f) => /^image\/(jpeg|png|webp|heic|heif)$/.test(f.type) || f.type === "")
      .slice(0, MAX_PHOTOS - photos.length)
      .map((file) => ({ id: `${file.name}-${file.lastModified}-${Math.random()}`, file, preview: URL.createObjectURL(file) }));
    setPhotos((p) => [...p, ...accepted]);
  };

  const removePhoto = (id: string) =>
    setPhotos((list) => {
      const gone = list.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return list.filter((p) => p.id !== id);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const when = new Date(observedAt);
    if (Number.isNaN(when.getTime()) || when.getTime() > Date.now() + 60_000) {
      setErrorMessage("The time observed can't be in the future.");
      return;
    }

    try {
      setStatus("uploading");
      const evidence = [];
      for (const p of photos) evidence.push(await uploadEvidence(await reencodeImage(p.file)));

      setStatus("submitting");
      const where = location ?? fallbackPosition;
      const res = await createIncidentReport({
        category,
        categoryLabel: CATEGORIES.find((c) => c.value === category)?.stored ?? "Environmental Hazard",
        description,
        reportedImpact: impact,
        localityName: currentLocality.name,
        latitude: where.lat,
        longitude: where.lng,
        observedAt: when.toISOString(),
        evidence,
      });
      if (!res.success) throw new Error(res.error || "Failed to submit report");
      setStatus("done");
    } catch (err) {
      setStatus("editing");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  const busy = status === "uploading" || status === "submitting";

  return (
    <Dialog
      open={isOpen}
      hidden={hidden}
      onClose={onClose}
      eyebrow="New community report"
      title={status === "done" ? "Report submitted" : "What are you seeing?"}
      description={status === "done" ? undefined : "Neighbours nearby will be asked to independently confirm your report."}
      footer={
        status === "done" ? (
          <Button variant="primary" className="w-full h-11" onClick={onClose}>
            Back to map
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="h-11" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form={formId} variant="primary" disabled={busy} className="flex-1 h-11">
              {status === "uploading" ? "Uploading photos…" : status === "submitting" ? "Submitting…" : "Submit report"}
            </Button>
          </div>
        )
      }
    >
      {status === "done" ? (
        <SuccessState title="Thanks — your report is on the map">
          A tracking code has been issued. Nearby residents can now confirm or dispute it.
        </SuccessState>
      ) : (
        <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field label="Type of hazard">
            <div role="radiogroup" aria-label="Type of hazard" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-autofocus={active ? "" : undefined}
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={cn(
                      "min-h-[4.25rem] rounded-lg border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-accent bg-accent-soft ring-[3px] ring-accent-soft"
                        : "border-line hover:border-line-strong hover:bg-surface-2"
                    )}
                  >
                    <c.icon className={cn("size-4", active ? "text-accent-ink" : "text-ink-subtle")} strokeWidth={1.75} />
                    <span className="mt-2 block text-[12.5px] font-medium text-ink leading-tight">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Location">
            <LocationField value={location} onChange={setLocation} purpose="report" />
          </Field>

          <Field label="When did you see it?" htmlFor="report-time">
            <input
              id="report-time"
              type="datetime-local"
              required
              value={observedAt}
              max={toLocalInput(new Date())}
              onChange={(e) => setObservedAt(e.target.value)}
              className={fieldClass}
            />
          </Field>

          <Field label="Describe it" htmlFor="report-description">
            <textarea
              id="report-description"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Water level, blockages, ground condition…"
              className={cn(fieldClass, "resize-none")}
            />
          </Field>

          <Field label="Immediate impact" htmlFor="report-impact">
            <input
              id="report-impact"
              required
              type="text"
              value={impact}
              onChange={(e) => setImpact(e.target.value)}
              placeholder="e.g. Road impassable, pole tilting, people stranded"
              className={fieldClass}
            />
          </Field>

          <Field label="Photos" hint={`Optional · up to ${MAX_PHOTOS}`}>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-line bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img src={p.preview} alt={`Selected photo ${i + 1}`} className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(p.id)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute top-1 right-1 size-8 grid place-items-center rounded-full bg-black/60 text-white"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className="aspect-square rounded-lg border border-dashed border-line-strong grid place-items-center text-ink-subtle hover:border-accent hover:text-accent-ink cursor-pointer focus-within:ring-[3px] focus-within:ring-accent-soft">
                  <span className="flex flex-col items-center gap-1 text-[11.5px]">
                    <ImagePlus className="size-5" /> Add
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    multiple
                    className="sr-only"
                    aria-label="Add photos"
                    onChange={(e) => {
                      addPhotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            <p className="mt-2 text-[12px] text-ink-subtle">
              Photos are re-encoded on your device before upload, which removes location metadata.
            </p>
          </Field>

          {errorMessage && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
              {errorMessage}
            </p>
          )}

          <p className="flex items-start gap-2 text-[12.5px] text-ink-subtle">
            <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-warn" />
            Don&apos;t approach deep water or exposed wires to take photos. Stay somewhere safe.
          </p>
        </form>
      )}
    </Dialog>
  );
}
