"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { TopBar } from "@/components/layout/top-bar";
import { NavRail } from "@/components/layout/nav-rail";
import { MobileNav } from "@/components/layout/mobile-nav";
import { IncidentDrawer } from "@/components/incidents/incident-drawer";
import { ReportHazardModal } from "@/components/modals/report-hazard-modal";
import { SosModal } from "@/components/modals/sos-modal";
import { EmergencyDialog } from "@/components/modals/emergency-dialog";
import { ListView } from "@/components/views/list-view";
import { ResponderView } from "@/components/views/responder-view";
import { SettingsView } from "@/components/views/settings-view";
import { useDemo } from "@/context/demo-context";
import { FEED_SECTIONS, isFeedTab } from "@/lib/navigation";

// MapLibre touches window/canvas, so load it client-side only.
const GeospatialMap = dynamic(
  () => import("@/components/map/geospatial-map").then((mod) => mod.GeospatialMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full grid place-items-center nl-backdrop">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 rounded-full border-2 border-line-strong border-t-accent animate-spin" />
          <span className="nl-eyebrow">Loading map</span>
        </div>
      </div>
    ),
  }
);

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

export default function Home() {
  const {
    activeTab,
    setActiveTab,
    selectedIncidentId,
    setSelectedIncidentId,
    isDrawerOpen,
    setIsDrawerOpen,
    requestMapFocus,
  } = useDemo();

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  // "R" opens the report flow from anywhere (shown as a hint in the nav rail).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "r" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      e.preventDefault();
      setReportModalOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSelectIncident = (id: string) => {
    setSelectedIncidentId(id);
    setIsDrawerOpen(true);
  };

  const handleShowOnMap = (coords: { lat: number; lng: number }, id?: string) => {
    setActiveTab("map");
    requestMapFocus({ ...coords, zoom: 15 });
    if (id) handleSelectIncident(id);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedIncidentId(null);
  };

  const openReport = () => setReportModalOpen(true);
  const openSos = () => setSosModalOpen(true);
  const openEmergency = () => setEmergencyOpen(true);

  // The map stays mounted underneath other views so its camera, tiles and
  // markers survive tab switches (one map instance for the session).
  let stage: React.ReactNode = null;
  if (activeTab === "responder") stage = <ResponderView />;
  else if (activeTab === "settings") stage = <SettingsView />;
  else if (isFeedTab(activeTab))
    stage = (
      <ListView
        focusSection={FEED_SECTIONS[activeTab]}
        onSelectIncident={handleSelectIncident}
        onOpenReportModal={openReport}
        onOpenSosModal={openSos}
        onShowOnMap={handleShowOnMap}
      />
    );

  return (
    <div className="flex h-dvh w-screen overflow-hidden nl-backdrop">
      <NavRail
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenReportModal={openReport}
        onOpenSosModal={openSos}
        onOpenEmergency={openEmergency}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar activeTab={activeTab} onTabChange={setActiveTab} onOpenEmergency={openEmergency} />

        <div className="flex-1 flex overflow-hidden relative">
          <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            <div className={activeTab === "map" ? "flex-1 min-h-0 relative" : "hidden"}>
              <GeospatialMap onSelectIncident={handleSelectIncident} />
            </div>
            {stage}
          </main>

          {isDrawerOpen && (
            <IncidentDrawer
              incidentId={selectedIncidentId}
              onClose={handleCloseDrawer}
              onViewOnMap={(coords) => handleShowOnMap(coords)}
            />
          )}
        </div>
      </div>

      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} onOpenReportModal={openReport} />

      <ReportHazardModal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} />
      <SosModal isOpen={sosModalOpen} onClose={() => setSosModalOpen(false)} />
      <EmergencyDialog open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
    </div>
  );
}
