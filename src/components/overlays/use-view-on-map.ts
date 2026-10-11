"use client";

import { useCallback } from "react";
import { useDemo } from "@/context/demo-context";
import { useOverlay } from "@/context/overlay-context";

/**
 * "View on map": centre on the item, mark it selected, and collapse the
 * mobile sheet so the marker is visible. The panel stays open (desktop) or
 * as a peek bar (mobile) so the user can return to the details.
 */
export function useViewOnMap() {
  const { requestMapFocus, setSelectedIncidentId } = useDemo();
  const { setSheetCollapsed } = useOverlay();
  return useCallback(
    (coords: { lat: number; lng: number }, id?: string) => {
      if (id) setSelectedIncidentId(id);
      requestMapFocus({ ...coords, zoom: 15 });
      setSheetCollapsed(true);
    },
    [requestMapFocus, setSelectedIncidentId, setSheetCollapsed]
  );
}
