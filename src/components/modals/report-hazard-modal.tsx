"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  UploadCloud,
  Waves,
  Mountain,
  CloudLightning,
  Activity,
  CircleHelp,
} from "lucide-react";
import { Dialog, Field, SuccessState, fieldClass } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { LocationPin, useReportPosition } from "./location-pin";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "FLOOD_WATERLOGGING", label: "Flooding / waterlogging", icon: Waves },
  { value: "STORM_DAMAGE", label: "Storm damage", icon: CloudLightning },
  { value: "LANDSLIDE", label: "Landslide / bank erosion", icon: Mountain },
  { value: "EARTHQUAKE_OBSERVATION", label: "Felt a tremor", icon: Activity },
  { value: "OTHER_HAZARD", label: "Something else", icon: CircleHelp },
];
import { useDemo } from "@/context/demo-context";

interface ReportHazardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportHazardModal({
  isOpen,
  onClose,
}: ReportHazardModalProps) {
  const { currentLocality, createIncidentReport } = useDemo();
  const [category, setCategory] = useState("FLOOD_WATERLOGGING");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState("");
  const [photoSelected, setPhotoSelected] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "FLOOD_WATERLOGGING":
        return "Waterlogging / Flooding";
      case "LANDSLIDE":
        return "Landslide / Riverbank Scour";
      case "STORM_DAMAGE":
        return "Storm Damage / Fallen Tree";
      case "EARTHQUAKE_OBSERVATION":
        return "Earthquake Observation (Demo Record)";
      default:
        return "Environmental Hazard";
    }
  };

  const position = useReportPosition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await createIncidentReport({
      category,
      categoryLabel: getCategoryLabel(category),
      description,
      reportedImpact: impact,
      localityName: currentLocality.name,
      latitude: position.lat,
      longitude: position.lng,
      observedAt: new Date().toISOString(),
    });

    setIsSubmitting(false);

    if (res.success) {
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setDescription("");
        setImpact("");
        onClose();
      }, 1800);
    } else {
      setErrorMessage(res.error || "Failed to create report");
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      eyebrow="New community report"
      title="What are you seeing?"
      description="Neighbours nearby will be asked to independently confirm your report."
    >
      {submitted ? (
        <SuccessState title="Report submitted">
          A tracking code has been issued. Nearby residents will be alerted to corroborate it.
        </SuccessState>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field label="Type of hazard">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    type="button"
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-accent bg-accent-soft ring-[3px] ring-accent-soft"
                        : "border-line hover:border-line-strong hover:bg-surface-2"
                    )}
                  >
                    <c.icon
                      className={cn("size-4", active ? "text-accent-ink" : "text-ink-subtle")}
                      strokeWidth={1.75}
                    />
                    <span className="mt-2 block text-[12.5px] font-medium text-ink leading-tight">
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          <LocationPin purpose="report" />

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

          <Field label="Photo" hint="Optional · location metadata is stripped">
            <label className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong px-3 py-3 cursor-pointer hover:border-accent hover:bg-accent-soft/40 transition-colors">
              <span className="size-9 rounded-lg bg-surface-2 grid place-items-center shrink-0">
                <UploadCloud className="size-4 text-ink-subtle" />
              </span>
              <span className="min-w-0 text-[13px]">
                <span className="block font-medium text-ink truncate">
                  {photoSelected ?? "Attach a photo"}
                </span>
                <span className="block text-ink-subtle">JPG or PNG, up to 5 MB</span>
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.[0]) setPhotoSelected(e.target.files[0].name);
                }}
              />
            </label>
          </Field>

          {errorMessage && (
            <p className="rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger">{errorMessage}</p>
          )}

          <p className="flex items-start gap-2 text-[12.5px] text-ink-subtle">
            <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-warn" />
            Don&apos;t approach deep water or exposed wires to take photos. Stay somewhere safe.
          </p>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting} className="flex-1 h-10">
              {isSubmitting ? "Submitting…" : "Submit report"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
