"use client";

import { useMemo } from "react";
import { useDemo } from "@/context/demo-context";
import { INITIAL_OFFICIAL_HAZARDS } from "@/lib/demo-data";
import type { NavCountKey } from "@/lib/navigation";

/** Live counts for nav badges, derived from data rather than hardcoded. */
export function useNavCounts(): Record<NavCountKey, number> {
  const { incidents, sosRequests } = useDemo();

  return useMemo(
    () => ({
      hazards: INITIAL_OFFICIAL_HAZARDS.length,
      reports: incidents.filter((i) => i.status !== "RESOLVED").length,
      sos: sosRequests.filter((s) => s.status === "REQUESTED").length,
    }),
    [incidents, sosRequests]
  );
}
