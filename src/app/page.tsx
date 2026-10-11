"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { TopBar } from "@/components/layout/top-bar";
import { NavRail } from "@/components/layout/nav-rail";
import { MobileNav } from "@/components/layout/mobile-nav";
import { EmergencyDialog } from "@/components/modals/emergency-dialog";
import { OverlayHost } from "@/components/overlays/overlay-host";
import { OverlayProvider, useOverlay } from "@/context/overlay-context";

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

/**
 * Map-first shell: the map is the workspace; every feature opens on demand
 * as a single overlay (modal, drawer or bottom sheet) via OverlayProvider.
 */
function Shell() {
  const { overlay, open, picking } = useOverlay();
  // Call 112 is deliberately outside the overlay controller: it must never be
  // blocked by a draft prompt and may sit above any form.
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  // "R" opens the report form when nothing else is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "r" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target) || overlay || picking) return;
      e.preventDefault();
      void open({ kind: "report" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay, picking, open]);

  const openEmergency = () => setEmergencyOpen(true);

  return (
    <div className="flex h-dvh w-screen overflow-hidden nl-backdrop">
      <NavRail onOpenEmergency={openEmergency} />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onOpenEmergency={openEmergency} />
        <main className="flex-1 min-h-0 relative pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <GeospatialMap />
        </main>
      </div>

      <MobileNav />
      <OverlayHost />
      <EmergencyDialog open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
    </div>
  );
}

export default function Home() {
  return (
    <OverlayProvider>
      <Shell />
    </OverlayProvider>
  );
}
