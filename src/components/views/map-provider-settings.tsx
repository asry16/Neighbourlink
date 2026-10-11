"use client";

import React, { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { fieldClass } from "@/components/ui/dialog";
import { getMapTilerKey } from "@/lib/map-styles";
import { setMapApiKeyOverride, useMapApiKeyOverride } from "@/lib/map-key";

/** Diagnostics: which basemap provider is active, with an optional per-browser override. */
export function MapProviderSettings({ embedded = false }: { embedded?: boolean }) {
  const override = useMapApiKeyOverride();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? override;
  const usingMapTiler = Boolean(getMapTilerKey(override));

  const Wrapper = embedded ? "div" : Card;
  return (
    <Wrapper className={embedded ? "" : "p-5"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!embedded && <h2 className="text-[16px] font-semibold text-ink">Map provider</h2>}
        <Badge tone={usingMapTiler ? "ok" : "warn"}>
          {usingMapTiler ? "MapTiler" : "Open fallback tiles (Esri)"}
        </Badge>
      </div>
      <p className="mt-1.5 text-[13px] text-ink-muted">
        The deployed key comes from <code className="font-mono text-[12px]">NEXT_PUBLIC_MAPTILER_API_KEY</code>.
        You can override it in this browser only, for testing — this never changes the deployment.
      </p>
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="MapTiler key or style.json URL (optional)"
          aria-label="Map provider key override"
          className={`${fieldClass} font-mono text-[13px]`}
        />
        <div className="flex gap-2 shrink-0">
          <Button
            variant="primary"
            className="h-11 sm:h-auto"
            disabled={draft === null || draft === override}
            onClick={() => {
              setMapApiKeyOverride(value);
              setDraft(null);
            }}
          >
            Apply
          </Button>
          {override && (
            <Button
              className="h-11 sm:h-auto"
              onClick={() => {
                setMapApiKeyOverride("");
                setDraft(null);
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>
      <a
        href="https://cloud.maptiler.com/account/keys/"
        target="_blank"
        rel="noreferrer"
        className="mt-2 min-h-11 inline-flex items-center gap-1 text-[12.5px] text-accent-ink hover:underline"
      >
        Manage MapTiler keys <ExternalLink className="size-3" />
      </a>
      <div className="mt-4 pt-3 border-t border-line flex items-center gap-2 text-[12.5px] text-ink-subtle">
        <span className="nl-live-dot text-ok" /> Data sync: local demo adapter (Prisma / SQLite)
      </div>
    </Wrapper>
  );
}
