"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  ThumbsUp,
  Shield,
  Check,
  AlertOctagon,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Eye,
  LifeBuoy,
  TrendingUp,
  Building2,
  Maximize2,
  Camera,
} from "lucide-react";
import {
  INITIAL_OFFICIAL_HAZARDS,
  INITIAL_RISK_ESTIMATES,
  INITIAL_SOS_REQUESTS,
  INITIAL_HELP_CENTRES,
  type DemoIncident,
  type DemoHazardUpdate,
  type DemoRiskEstimate,
  type DemoSOS,
} from "@/lib/demo-data";
import { useDemo } from "@/context/demo-context";
import { Badge, humanize } from "@/components/ui/primitives";
import { HAZARD_TONE, INCIDENT_TONE, RISK_TONE } from "@/lib/status";

interface IncidentDetailsPanelProps {
  incidentId: string | null;
  onClose: () => void;
  onViewOnMap?: (coords: { lat: number; lng: number }) => void;
}

export function IncidentDetailsPanel({
  incidentId,
  onClose,
  onViewOnMap,
}: IncidentDetailsPanelProps) {
  const {
    currentRole,
    currentUser,
    incidents,
    sosRequests,
    corroborateIncident,
    disputeIncident,
    markIncidentResolved,
    setSelectedIncidentId,
  } = useDemo();

  const [corroborated, setCorroborated] = useState<Record<string, boolean>>({});
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Resolve target item from any ID type
  const targetData = useMemo(() => {
    if (!incidentId) return null;

    // 1. Community Incident
    const inc = incidents.find((i) => i.id === incidentId);
    if (inc) return { type: "INCIDENT" as const, data: inc };

    // 2. Official Hazard
    const haz = INITIAL_OFFICIAL_HAZARDS.find((h) => h.id === incidentId);
    if (haz) return { type: "OFFICIAL_HAZARD" as const, data: haz };

    // 3. Risk Estimate
    const risk = INITIAL_RISK_ESTIMATES.find((r) => r.id === incidentId);
    if (risk) return { type: "RISK_ESTIMATE" as const, data: risk };

    // 4. SOS
    const sos = sosRequests.find((s: any) => s.id === incidentId);
    if (sos) return { type: "SOS" as const, data: sos };

    return null;
  }, [incidentId, incidents, sosRequests]);

  // Find nearby incidents in the area (excluding current)
  const nearbyItems = useMemo(() => {
    if (!targetData) return [];

    let curLat = 22.57;
    let curLng = 88.36;

    if (targetData.type === "INCIDENT") {
      curLat = targetData.data.latitude;
      curLng = targetData.data.longitude;
    } else if (targetData.type === "OFFICIAL_HAZARD") {
      curLat = targetData.data.centerLat;
      curLng = targetData.data.centerLng;
    } else if (targetData.type === "RISK_ESTIMATE") {
      curLat = targetData.data.centerLat;
      curLng = targetData.data.centerLng;
    } else if (targetData.type === "SOS") {
      curLat = targetData.data.exactLatitude || targetData.data.latitude || 22.57;
      curLng = targetData.data.exactLongitude || targetData.data.longitude || 88.36;
    }

    const items: Array<{
      id: string;
      title: string;
      category: string;
      lat: number;
      lng: number;
      distanceKm: number;
      kind: "INCIDENT" | "HAZARD" | "SOS";
    }> = [];

    // Other community incidents
    incidents.forEach((i) => {
      if (i.id !== incidentId) {
        const d = calculateDistance(curLat, curLng, i.latitude, i.longitude);
        items.push({
          id: i.id,
          title: i.categoryLabel,
          category: i.status,
          lat: i.latitude,
          lng: i.longitude,
          distanceKm: d,
          kind: "INCIDENT",
        });
      }
    });

    // Official hazards
    INITIAL_OFFICIAL_HAZARDS.forEach((h) => {
      if (h.id !== incidentId) {
        const d = calculateDistance(curLat, curLng, h.centerLat, h.centerLng);
        items.push({
          id: h.id,
          title: h.headline,
          category: h.severity,
          lat: h.centerLat,
          lng: h.centerLng,
          distanceKm: d,
          kind: "HAZARD",
        });
      }
    });

    return items.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 4);
  }, [targetData, incidentId, incidents]);

  if (!incidentId || !targetData) return null;

  // Handler for "View on map"
  const handleViewOnMap = () => {
    let lat = 22.57;
    let lng = 88.36;
    if (targetData.type === "INCIDENT") {
      lat = targetData.data.latitude;
      lng = targetData.data.longitude;
    } else if (targetData.type === "OFFICIAL_HAZARD") {
      lat = targetData.data.centerLat;
      lng = targetData.data.centerLng;
    } else if (targetData.type === "RISK_ESTIMATE") {
      lat = targetData.data.centerLat;
      lng = targetData.data.centerLng;
    } else if (targetData.type === "SOS") {
      lat = targetData.data.exactLatitude || targetData.data.fuzzyLatitude || targetData.data.latitude;
      lng = targetData.data.exactLongitude || targetData.data.fuzzyLongitude || targetData.data.longitude;
    }

    if (onViewOnMap) {
      onViewOnMap({ lat, lng });
    }
  };

  // Corroborate Action
  const handleCorroborate = async () => {
    if (targetData.type !== "INCIDENT") return;
    const inc = targetData.data as DemoIncident;
    if (corroborated[inc.id] || isSubmitting) return;

    setIsSubmitting(true);
    const res = await corroborateIncident(inc.id);
    setIsSubmitting(false);

    if (res.success) {
      setCorroborated((prev) => ({ ...prev, [inc.id]: true }));
      setFeedbackMsg(res.message || "Your independent observation has been recorded.");
    } else {
      setFeedbackMsg(res.message || "Could not record observation.");
    }

    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Dispute Action
  const handleDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetData.type !== "INCIDENT") return;
    const inc = targetData.data as DemoIncident;
    if (!disputeReason.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const res = await disputeIncident(inc.id, disputeReason);
    setIsSubmitting(false);

    setDisputeModalOpen(false);
    setDisputeReason("");
    setFeedbackMsg(
      res.message ||
        "Dispute filed. Notice: Disputes do not delete the original report; status set to Disputed for community review."
    );
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // Resolve Action
  const handleMarkResolved = async () => {
    if (targetData.type !== "INCIDENT") return;
    const inc = targetData.data as DemoIncident;
    if (isSubmitting) return;

    setIsSubmitting(true);
    const res = await markIncidentResolved(inc.id);
    setIsSubmitting(false);

    setFeedbackMsg(res.message || "Conditions reported resolved. Verification logged.");
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  return (
    <>
      <aside
        className={`fixed z-40 bg-surface border-line shadow-[var(--shadow-float)] flex flex-col transition-all duration-300 ease-in-out
          /* Mobile: Bottom Sheet */
          inset-x-0 bottom-0 rounded-t-3xl max-h-[85vh] border-t
          /* Desktop: Collapsible Right Panel */
          md:top-16 md:bottom-0 md:right-0 md:left-auto md:w-[420px] md:max-h-full md:rounded-none md:border-l md:border-t-0
          ${isCollapsed ? "translate-y-[calc(100%-60px)] md:translate-y-0 md:translate-x-[calc(100%-52px)]" : "translate-y-0 md:translate-x-0"}
        `}
        aria-label="Incident details and coordination panel"
      >
        {/* Mobile Drag Handle */}
        <div
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="md:hidden flex flex-col items-center pt-2.5 pb-1 cursor-pointer"
        >
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Panel Header */}
        <div className="px-4 py-3 border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            {/* Desktop Collapse Toggle */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex p-1 rounded-lg text-ink-subtle hover:text-ink hover:bg-surface-2 transition-colors"
              title={isCollapsed ? "Expand Details Panel" : "Collapse Details Panel"}
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
              />
            </button>

            {/* Type & Badge */}
            {targetData.type === "INCIDENT" && (
              <>
                <Badge tone={INCIDENT_TONE[targetData.data.status]}>
                  {humanize(targetData.data.status)}
                </Badge>
                <span className="font-mono text-[11.5px] text-ink-subtle whitespace-nowrap truncate">
                  {targetData.data.trackingCode}
                </span>
              </>
            )}
            {targetData.type === "OFFICIAL_HAZARD" && (
              <Badge tone={HAZARD_TONE[targetData.data.severity]}>
                Official · {humanize(targetData.data.severity)}
              </Badge>
            )}
            {targetData.type === "RISK_ESTIMATE" && (
              <Badge tone={RISK_TONE[targetData.data.riskLevel]}>
                {humanize(targetData.data.riskLevel)} flood risk
              </Badge>
            )}
            {targetData.type === "SOS" && (
              <Badge tone="danger">SOS · {humanize(targetData.data.status)}</Badge>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleViewOnMap}
              id="panel-view-on-map-btn"
              className="h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink flex items-center gap-1.5 whitespace-nowrap"
              title="Show on map"
            >
              <MapPin className="size-3.5" />
              Map
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              id="close-incident-panel-btn"
              className="p-1.5 rounded-lg text-ink-subtle hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {feedbackMsg && (
            <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-200 text-[12.5px] leading-relaxed animate-rise">
              {feedbackMsg}
            </div>
          )}

          {/* 1. COMMUNITY INCIDENT DETAIL */}
          {targetData.type === "INCIDENT" && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-ink leading-snug">
                  {targetData.data.categoryLabel}
                </h2>
                <div className="flex items-center gap-1.5 text-[12.5px] text-ink-subtle mt-1">
                  <MapPin className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span>{targetData.data.localityName}</span>
                </div>
              </div>

              {/* Description & Impact */}
              <div className="p-3.5 rounded-2xl bg-surface-2 border border-line text-[12.5px] text-ink-muted space-y-2">
                <p className="leading-relaxed">{targetData.data.description}</p>
                <div className="pt-2 border-t border-line flex justify-between text-[12px] text-ink-subtle">
                  <span>
                    Reported Impact: <strong>{targetData.data.reportedImpact}</strong>
                  </span>
                </div>
              </div>

              {/* Observation Timeline & Verification Evidence */}
              <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                <div className="p-2.5 rounded-xl border border-line bg-surface-2">
                  <span className="text-[12px] text-ink-subtle uppercase tracking-wider block flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Observed Time
                  </span>
                  <span className="font-medium text-ink">
                    {new Date(targetData.data.observedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    IST
                  </span>
                </div>

                <div className="p-2.5 rounded-xl border border-line bg-surface-2">
                  <span className="text-[12px] text-ink-subtle uppercase tracking-wider block">
                    Independent Observers
                  </span>
                  <span className="font-semibold text-sky-600 dark:text-sky-400">
                    {targetData.data.observationCount} Citizen
                    {targetData.data.observationCount > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Evidence Section */}
              <div className="p-3 rounded-xl border border-line bg-slate-50/40 dark:bg-slate-800/20 text-[12.5px] space-y-1.5">
                <div className="flex items-center justify-between text-ink-subtle text-[12px]">
                  <span className="font-semibold uppercase tracking-wider text-ink-subtle flex items-center gap-1">
                    <Camera className="w-3 h-3 text-sky-500" /> Observation Evidence
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Verified Hash Log
                  </span>
                </div>
                <p className="text-[12px] text-ink-subtle leading-tight">
                  Filed by <strong>{targetData.data.reporterName}</strong> with geo-tagged coordinate validation.
                </p>
              </div>

              {/* Safety Warning */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-[12.5px] flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-tight text-[12px]">
                  <strong>Safety Advisory:</strong> Do not enter flooded road stretches or approach fallen utility cables merely to capture photos. Maintain safe distance.
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <h3 className="text-[12.5px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Community Verification Actions
                </h3>

                <button
                  onClick={handleCorroborate}
                  disabled={!!corroborated[targetData.data.id]}
                  id="corroborate-action-btn"
                  className={`w-full py-2.5 px-3 rounded-xl font-semibold text-[12.5px] flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    corroborated[targetData.data.id]
                      ? "bg-surface-3 text-ink-subtle cursor-not-allowed"
                      : "bg-ink text-canvas hover:opacity-90 shadow-md"
                  }`}
                >
                  {corroborated[targetData.data.id] ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>You have corroborated this hazard</span>
                    </>
                  ) : (
                    <>
                      <ThumbsUp className="w-4 h-4" />
                      <span>I Also Observed This (Corroborate)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setDisputeModalOpen(true)}
                  className="w-full py-2 px-3 rounded-xl border border-line hover:bg-surface-2 text-ink-muted font-medium text-[12.5px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Dispute Details (Logs non-destructive notice)</span>
                </button>

                <button
                  onClick={handleMarkResolved}
                  className="w-full py-2 px-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-medium text-[12.5px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Report Conditions Improved / Cleared</span>
                </button>
              </div>
            </>
          )}

          {/* 2. OFFICIAL HAZARD ADVISORY DETAIL */}
          {targetData.type === "OFFICIAL_HAZARD" && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-1.5 text-[12.5px] text-orange-600 dark:text-orange-400 font-semibold mb-1">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Official Meteorological Authority</span>
                </div>
                <h2 className="text-base font-semibold text-ink leading-snug">
                  {targetData.data.headline}
                </h2>
              </div>

              <div className="p-3.5 rounded-2xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/60 text-[12.5px] text-ink-muted space-y-2">
                <p className="leading-relaxed">{targetData.data.description}</p>
                <div className="pt-2 border-t border-orange-200/60 dark:border-orange-900/60 text-[12px] text-ink-subtle">
                  Affected Sector: <strong>{targetData.data.affectedArea}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                <div className="p-2.5 rounded-xl border border-line bg-surface-2">
                  <span className="text-[12px] text-ink-subtle uppercase tracking-wider block">
                    Issued At
                  </span>
                  <span className="font-medium text-ink">
                    {new Date(targetData.data.issuedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    IST
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border border-line bg-surface-2">
                  <span className="text-[12px] text-ink-subtle uppercase tracking-wider block">
                    Valid Until
                  </span>
                  <span className="font-medium text-ink">
                    {new Date(targetData.data.expiresAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    IST
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-line bg-surface text-[12.5px] flex items-center justify-between">
                <div>
                  <span className="text-[12px] text-ink-subtle uppercase tracking-wider block">
                    Issuing Authority
                  </span>
                  <span className="font-semibold text-ink text-[12.5px]">
                    {targetData.data.source}
                  </span>
                </div>
                {targetData.data.sourceUrl && (
                  <a
                    href={targetData.data.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg text-sky-500 hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors"
                    title="View Source Portal"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* 3. EXPERIMENTAL RISK ESTIMATE DETAIL */}
          {targetData.type === "RISK_ESTIMATE" && (
            <div className="space-y-3">
              <div>
                <span className="text-[12px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 inline-block mb-1">
                  Heuristic Rule Engine v1.0
                </span>
                <h2 className="text-base font-semibold text-ink">
                  {targetData.data.localityName}
                </h2>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60 text-[12.5px] text-ink-muted leading-relaxed">
                {targetData.data.explanation}
              </div>

              <div className="p-3 rounded-xl border border-line bg-surface grid grid-cols-3 gap-2 text-[12.5px] text-center">
                <div>
                  <span className="text-[12px] text-ink-subtle block">Rainfall (24h)</span>
                  <strong className="text-indigo-600 dark:text-indigo-400 text-sm">
                    {targetData.data.rainfallRecentMm}mm
                  </strong>
                </div>
                <div>
                  <span className="text-[12px] text-ink-subtle block">Forecast (24h)</span>
                  <strong className="text-indigo-600 dark:text-indigo-400 text-sm">
                    {targetData.data.rainfallForecastMm}mm
                  </strong>
                </div>
                <div>
                  <span className="text-[12px] text-ink-subtle block">Water Gauge</span>
                  <strong className="text-indigo-600 dark:text-indigo-400 text-sm">
                    {targetData.data.waterLevelMeters}m
                  </strong>
                </div>
              </div>

              <p className="text-[12px] text-ink-subtle italic leading-snug">
                Notice: Transparent rule-based flood-risk indicator calculated from local rainfall and tidal lock schedules — not an official meteorological warning.
              </p>
            </div>
          )}

          {/* 4. SOS EMERGENCY DETAIL */}
          {targetData.type === "SOS" && (
            <div className="space-y-3">
              <div>
                <span className="text-[12px] font-mono text-ink-subtle block">
                  {targetData.data.trackingCode}
                </span>
                <h2 className="text-base font-semibold text-ink">
                  {targetData.data.category === "TRAPPED_FLOOD"
                    ? "Citizen Stranded in Flood"
                    : "Emergency Aid Request"}{" "}
                  ({targetData.data.peopleCount} {targetData.data.peopleCount > 1 ? "people" : "person"})
                </h2>
              </div>

              <div className="p-3.5 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 text-[12.5px] text-ink-muted leading-relaxed">
                {currentRole === "RESPONDER" || currentRole === "ADMIN"
                  ? targetData.data.description
                  : "Emergency rescue assistance requested. Exact civilian coordinates fuzzed to protect requester privacy."}
              </div>

              {currentRole === "RESPONDER" || currentRole === "ADMIN" ? (
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-[12.5px] space-y-1">
                  <div className="font-semibold text-red-800 dark:text-red-300">
                    Dispatch Contact Coordinates:
                  </div>
                  <div className="text-red-700 dark:text-red-300">
                    Phone: <strong>{targetData.data.contactPhone}</strong>
                  </div>
                  <div className="text-red-700 dark:text-red-300">
                    Requester: <strong>{targetData.data.requesterName}</strong>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-surface-2 text-[12px] text-ink-subtle italic">
                  🛡️ Exact callback numbers and GPS coordinates restricted to verified disaster responders.
                </div>
              )}
            </div>
          )}

          {/* NEARBY INCIDENTS SECTION */}
          {nearbyItems.length > 0 && (
            <div className="pt-3 border-t border-line space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Nearby Incidents in Vicinity
                </span>
                <span className="text-[12px] text-ink-subtle">{nearbyItems.length} nearby</span>
              </div>

              <div className="space-y-1.5">
                {nearbyItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedIncidentId(item.id);
                      if (onViewOnMap) {
                        onViewOnMap({ lat: item.lat, lng: item.lng });
                      }
                    }}
                    className="w-full p-2.5 rounded-xl border border-line bg-slate-50/60 dark:bg-slate-800/40 hover:bg-sky-50 dark:hover:bg-slate-800 text-left transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div className="overflow-hidden pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded-sm bg-surface-3 text-ink-muted">
                          {item.category}
                        </span>
                        <span className="text-[12px] font-semibold text-ink truncate group-hover:text-sky-600 dark:group-hover:text-sky-400">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[12px] text-ink-subtle block mt-0.5">
                        ~{item.distanceKm.toFixed(1)} km away
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-ink-subtle group-hover:text-sky-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Dispute Modal */}
      {disputeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs p-4 flex items-center justify-center animate-rise">
          <form
            onSubmit={handleDispute}
            className="bg-surface rounded-2xl border border-line p-6 w-full max-w-sm shadow-[var(--shadow-float)] space-y-3"
          >
            <h4 className="font-semibold text-sm text-ink">
              Submit Observation Dispute
            </h4>
            <p className="text-[12px] text-ink-subtle leading-snug">
              Disputing flags the hazard for community re-verification. It preserves the record in the transparent audit trail.
            </p>
            <textarea
              required
              rows={3}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="e.g. Water has drained away, or road is open..."
              className="w-full p-2.5 rounded-xl border border-line bg-surface-2 text-[12.5px] text-ink focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[12.5px] transition-colors"
              >
                Submit Dispute
              </button>
              <button
                type="button"
                onClick={() => setDisputeModalOpen(false)}
                className="px-3 py-2 rounded-xl border border-line text-ink-muted text-[12.5px] hover:bg-surface-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

// Distance helper
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
