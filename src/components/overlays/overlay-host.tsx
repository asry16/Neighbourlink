"use client";

import React from "react";
import { useDemo, type Role } from "@/context/demo-context";
import { useOverlay, type ListKind } from "@/context/overlay-context";
import { ConfirmDialog, Drawer } from "@/components/ui/dialog";
import { ReportHazardModal } from "@/components/modals/report-hazard-modal";
import { SosModal } from "@/components/modals/sos-modal";
import { IncidentDetailsPanel } from "@/components/incidents/incident-details-panel";
import { ResponderView } from "@/components/views/responder-view";
import { HazardsPanel } from "./hazards-panel";
import { ReportsPanel } from "./reports-panel";
import { HelpPanel } from "./help-panel";
import { SettingsModal } from "./settings-modal";
import { AuthModal } from "@/components/modals/auth-modal";
import { useViewOnMap } from "./use-view-on-map";

const LIST_TITLES: Record<ListKind, string> = {
  hazards: "Hazard updates",
  reports: "Community reports",
  help: "Help centres",
  responder: "SOS queue",
};

const isResponder = (r: Role) => r === "RESPONDER" || r === "ADMIN";

/**
 * Renders the single active overlay. Drawers share one <Drawer> element so
 * list → details → back swaps content in place instead of stacking panels.
 */
export function OverlayHost() {
  const { overlay, open, close, sheetCollapsed, setSheetCollapsed, picking, confirm, answerConfirm } =
    useOverlay();
  const { currentRole, setSelectedIncidentId } = useDemo();
  const viewOnMap = useViewOnMap();
  const hiddenForPick = !!picking;

  const closeAll = () => {
    void close().then((ok) => ok && setSelectedIncidentId(null));
  };

  let drawer: React.ReactNode = null;
  if (
    overlay &&
    overlay.kind !== "report" &&
    overlay.kind !== "sos" &&
    overlay.kind !== "settings" &&
    overlay.kind !== "auth"
  ) {
    let title: string;
    let body: React.ReactNode;
    let onBack: (() => void) | undefined;
    if (overlay.kind === "details") {
      title = "Details";
      const from = overlay.from;
      onBack = from ? () => void open({ kind: from }) : undefined;
      body = (
        <IncidentDetailsPanel
          incidentId={overlay.id}
          onViewOnMap={viewOnMap}
          onSelect={(id) => void open({ kind: "details", id, from })}
        />
      );
    } else if (overlay.kind === "responder" && !isResponder(currentRole)) {
      title = LIST_TITLES.responder;
      body = <p className="p-4 text-[13px] text-ink-muted">The SOS queue is available to verified responders only.</p>;
    } else {
      title = LIST_TITLES[overlay.kind];
      body =
        overlay.kind === "hazards" ? <HazardsPanel /> :
        overlay.kind === "reports" ? <ReportsPanel /> :
        overlay.kind === "help" ? <HelpPanel /> :
        <ResponderView embedded />;
    }
    drawer = (
      <Drawer
        open
        onClose={closeAll}
        title={title}
        onBack={onBack}
        backLabel={overlay.kind === "details" && overlay.from ? LIST_TITLES[overlay.from] : "Back"}
        collapsed={sheetCollapsed}
        onCollapsedChange={setSheetCollapsed}
      >
        {/* key: reset scroll position when content changes */}
        <div key={overlay.kind === "details" ? overlay.id : overlay.kind}>{body}</div>
      </Drawer>
    );
  }

  return (
    <>
      {drawer && <div className={hiddenForPick ? "hidden" : undefined}>{drawer}</div>}
      {/* Mounted only while open: drafts live in component state, and nothing
          time-dependent runs during the server prerender. */}
      {overlay?.kind === "report" && <ReportHazardModal isOpen hidden={hiddenForPick} onClose={closeAll} />}
      {overlay?.kind === "sos" && <SosModal isOpen hidden={hiddenForPick} onClose={closeAll} />}
      {overlay?.kind === "settings" && <SettingsModal open onClose={closeAll} />}
      {overlay?.kind === "auth" && <AuthModal open onClose={closeAll} />}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        body={confirm?.body ?? ""}
        confirmLabel={confirm?.confirmLabel ?? "Discard"}
        onAnswer={answerConfirm}
      />
    </>
  );
}
