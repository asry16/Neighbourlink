"use client";

import React, { useCallback, useId, useMemo, useRef, useState } from "react";
import { Search as SearchIcon, X, MapPin, Star, TriangleAlert, MessagesSquare, Building2 } from "lucide-react";
import { useDemo, DEMO_LOCALITIES } from "@/context/demo-context";
import { useOverlay } from "@/context/overlay-context";
import { INITIAL_OFFICIAL_HAZARDS, INITIAL_HELP_CENTRES } from "@/lib/demo-data";
import { SAVED_AREAS_KEY, useLocalPref } from "@/lib/local-prefs";
import { useDismiss } from "@/lib/use-dismiss";
import { cn } from "@/lib/utils";

/**
 * Locality-first search over data already in the app (areas, reports,
 * official warnings, help centres). Nothing typed here leaves the browser.
 */

interface Result {
  id: string;
  kind: "Saved area" | "Area" | "Report" | "Official warning" | "Help centre";
  title: string;
  subtitle: string;
  icon: typeof MapPin;
  onSelect: () => void;
}

export function Search() {
  const { incidents, currentLocality, setLocality, requestMapFocus, setSelectedIncidentId } = useDemo();
  const { open: openOverlay, close: closeOverlay } = useOverlay();
  const [saved] = useLocalPref<string[]>(SAVED_AREAS_KEY, []);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const focusOn = useCallback(
    (lat: number, lng: number, detailsId?: string) => {
      requestMapFocus({ lat, lng, zoom: 15 });
      if (detailsId) {
        setSelectedIncidentId(detailsId);
        void openOverlay({ kind: "details", id: detailsId });
      }
    },
    [requestMapFocus, setSelectedIncidentId, openOverlay]
  );

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const area = (l: (typeof DEMO_LOCALITIES)[number], isSaved: boolean): Result => ({
      id: `area-${l.id}`,
      kind: isSaved ? "Saved area" : "Area",
      title: l.name,
      subtitle: l.description,
      icon: isSaved ? Star : MapPin,
      onSelect: () => {
        setLocality(l);
        void closeOverlay();
      },
    });

    // Empty query: saved areas first, then the rest.
    if (q.length === 0) {
      const savedFirst = [...DEMO_LOCALITIES].sort(
        (a, b) => Number(saved.includes(b.id)) - Number(saved.includes(a.id))
      );
      return savedFirst.map((l) => area(l, saved.includes(l.id)));
    }
    if (q.length < 2) return [];

    const has = (...fields: string[]) => fields.some((f) => f.toLowerCase().includes(q));
    const out: Result[] = DEMO_LOCALITIES.filter((l) => has(l.name, l.description)).map((l) =>
      area(l, saved.includes(l.id))
    );
    INITIAL_OFFICIAL_HAZARDS.filter((h) => has(h.headline, h.affectedArea, h.source)).forEach((h) =>
      out.push({
        id: h.id,
        kind: "Official warning",
        title: h.headline,
        subtitle: h.affectedArea,
        icon: TriangleAlert,
        onSelect: () => focusOn(h.centerLat, h.centerLng, h.id),
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
          onSelect: () => focusOn(i.latitude, i.longitude, i.id),
        })
      );
    INITIAL_HELP_CENTRES.filter((c) => has(c.name, c.localityName, ...c.facilities)).forEach((c) =>
      out.push({
        id: c.id,
        kind: "Help centre",
        title: c.name,
        subtitle: c.localityName,
        icon: Building2,
        onSelect: () => {
          focusOn(c.latitude, c.longitude);
          void openOverlay({ kind: "help" });
        },
      })
    );
    return out.slice(0, 8);
  }, [query, incidents, saved, setLocality, closeOverlay, focusOn, openOverlay]);

  const choose = (r: Result) => {
    r.onSelect();
    setQuery("");
    setOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active]);
    }
  };

  const showPanel = open && (query.trim().length === 0 || query.trim().length >= 2);

  return (
    <div ref={ref} className="relative w-full md:max-w-md">
      <label className="h-11 md:h-10 flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-2.5 cursor-text focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft">
        <SearchIcon className="size-4 text-ink-subtle shrink-0" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={currentLocality.name}
          aria-label={`Search areas, reports and help centres. Current area: ${currentLocality.name}`}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && results[active] ? `${listId}-${active}` : undefined}
          className="flex-1 min-w-0 h-full bg-transparent text-[16px] md:text-[14px] text-ink placeholder:text-ink placeholder:font-medium outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Clear search" className="size-9 md:size-7 grid place-items-center rounded text-ink-subtle hover:text-ink">
            <X className="size-4" />
          </button>
        )}
      </label>

      {showPanel && (
        <div
          className="fixed md:absolute left-2 right-2 md:left-0 md:right-auto top-[calc(3.75rem+env(safe-area-inset-top))] md:top-full md:mt-2 md:w-[24rem] z-[55] rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)] animate-rise max-h-[70dvh] overflow-y-auto"
        >
          {query.trim().length === 0 && <div className="nl-eyebrow px-2.5 pt-1.5 pb-1">Choose an area</div>}
          <ul id={listId} role="listbox" aria-label="Search results">
            {results.length === 0 ? (
              <li className="px-3 py-6 text-center text-[13px] text-ink-subtle">No matching areas, reports or help centres.</li>
            ) : (
              results.map((r, i) => (
                <li
                  key={r.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(r)}
                  className={cn("min-h-11 px-2.5 py-2 rounded-lg flex items-start gap-3 cursor-pointer", i === active && "bg-surface-2")}
                >
                  <r.icon
                    className={cn("size-4 mt-0.5 shrink-0", r.kind === "Saved area" ? "text-amber-500 fill-amber-400" : "text-ink-subtle")}
                    strokeWidth={1.75}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink truncate">
                      {r.title}
                      {r.id === `area-${currentLocality.id}` && <span className="ml-1.5 text-[11.5px] font-normal text-accent-ink">Current</span>}
                    </span>
                    <span className="block text-[12px] text-ink-subtle truncate">
                      {r.kind} · {r.subtitle}
                    </span>
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
