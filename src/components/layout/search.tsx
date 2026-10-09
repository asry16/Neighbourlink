"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Search as SearchIcon, X, MapPin, TriangleAlert, MessagesSquare, Building2 } from "lucide-react";
import { useDemo, DEMO_LOCALITIES } from "@/context/demo-context";
import { INITIAL_OFFICIAL_HAZARDS, INITIAL_HELP_CENTRES } from "@/lib/demo-data";
import { useDismiss } from "@/lib/use-dismiss";
import { cn } from "@/lib/utils";

/**
 * Searches data already loaded in the app (areas, reports, official warnings,
 * help centres). Nothing typed here leaves the browser.
 */

interface Result {
  id: string;
  kind: "Area" | "Report" | "Official warning" | "Help centre";
  title: string;
  subtitle: string;
  icon: typeof MapPin;
  onSelect: () => void;
}

export function Search({ onNavigate }: { onNavigate: () => void }) {
  const {
    incidents,
    setLocality,
    setActiveTab,
    requestMapFocus,
    setSelectedIncidentId,
    setIsDrawerOpen,
  } = useDemo();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setMobileOpen(false);
  }, []);
  useDismiss(ref, open || mobileOpen, close);

  const showOnMap = useCallback(
    (lat: number, lng: number, selectId?: string) => {
      setActiveTab("map");
      requestMapFocus({ lat, lng, zoom: 15 });
      if (selectId) {
        setSelectedIncidentId(selectId);
        setIsDrawerOpen(true);
      }
      onNavigate();
    },
    [setActiveTab, requestMapFocus, setSelectedIncidentId, setIsDrawerOpen, onNavigate]
  );

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const has = (...fields: string[]) => fields.some((f) => f.toLowerCase().includes(q));
    const out: Result[] = [];

    DEMO_LOCALITIES.filter((l) => has(l.name, l.description)).forEach((l) =>
      out.push({
        id: `area-${l.id}`,
        kind: "Area",
        title: l.name,
        subtitle: l.description,
        icon: MapPin,
        onSelect: () => {
          setLocality(l);
          setActiveTab("map");
          onNavigate();
        },
      })
    );
    INITIAL_OFFICIAL_HAZARDS.filter((h) => has(h.headline, h.affectedArea, h.source)).forEach((h) =>
      out.push({
        id: h.id,
        kind: "Official warning",
        title: h.headline,
        subtitle: h.affectedArea,
        icon: TriangleAlert,
        onSelect: () => showOnMap(h.centerLat, h.centerLng, h.id),
      })
    );
    incidents
      .filter((i) => has(i.categoryLabel, i.localityName, i.description, i.trackingCode))
      .forEach((i) =>
        out.push({
          id: i.id,
          kind: "Report",
          title: i.categoryLabel,
          subtitle: `${i.localityName} · ${i.trackingCode}`,
          icon: MessagesSquare,
          onSelect: () => showOnMap(i.latitude, i.longitude, i.id),
        })
      );
    INITIAL_HELP_CENTRES.filter((c) => has(c.name, c.localityName, ...c.facilities)).forEach((c) =>
      out.push({
        id: c.id,
        kind: "Help centre",
        title: c.name,
        subtitle: c.localityName,
        icon: Building2,
        onSelect: () => showOnMap(c.latitude, c.longitude),
      })
    );
    return out.slice(0, 8);
  }, [query, incidents, setLocality, setActiveTab, onNavigate, showOnMap]);

  const choose = (r: Result) => {
    r.onSelect();
    setQuery("");
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active]);
    }
  };

  const showPanel = (open || mobileOpen) && query.trim().length >= 2;

  return (
    <div ref={ref} className="relative min-w-0">
      {/* Mobile trigger */}
      <button
        onClick={() => {
          setMobileOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        aria-label="Search"
        className="lg:hidden size-11 md:size-9 grid place-items-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink"
      >
        <SearchIcon className="size-[18px]" strokeWidth={1.75} />
      </button>

      <div
        className={cn(
          "items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-2.5 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft transition-colors",
          mobileOpen
            ? "flex fixed left-2 right-2 top-[calc(0.5rem+env(safe-area-inset-top))] z-[55] h-12 bg-surface shadow-[var(--shadow-float)]"
            : "hidden lg:flex h-9 w-64 xl:w-80"
        )}
      >
        <SearchIcon className="size-4 text-ink-subtle shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search areas, reports, shelters"
          aria-label="Search areas, reports and help centres"
          aria-expanded={showPanel}
          aria-controls="search-results"
          role="combobox"
          className="flex-1 min-w-0 bg-transparent text-[14px] md:text-[13px] text-ink placeholder:text-ink-subtle outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {(query || mobileOpen) && (
          <button
            onClick={() => {
              setQuery("");
              if (mobileOpen) close();
            }}
            aria-label={mobileOpen ? "Close search" : "Clear search"}
            className="size-8 md:size-6 grid place-items-center rounded text-ink-subtle hover:text-ink"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {showPanel && (
        <div
          id="search-results"
          role="listbox"
          className={cn(
            "z-[55] rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)] animate-rise",
            mobileOpen
              ? "fixed left-2 right-2 top-[calc(3.75rem+env(safe-area-inset-top))] max-h-[70dvh] overflow-y-auto"
              : "absolute top-full left-0 mt-2 w-[22rem] max-h-96 overflow-y-auto"
          )}
        >
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-ink-subtle">
              No matching areas, reports or help centres.
            </p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.id}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r)}
                className={cn(
                  "w-full min-h-11 text-left px-2.5 py-2 rounded-lg flex items-start gap-3",
                  i === active ? "bg-surface-2" : ""
                )}
              >
                <r.icon className="size-4 mt-0.5 text-ink-subtle shrink-0" strokeWidth={1.75} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ink truncate">{r.title}</span>
                  <span className="block text-[12px] text-ink-subtle truncate">
                    {r.kind} · {r.subtitle}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
