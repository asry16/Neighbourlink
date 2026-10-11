"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

/**
 * Central controller for the map-first UI. Exactly one main overlay (form,
 * drawer or settings) can be open at a time; opening another replaces it.
 * Forms register unsaved drafts so switching away asks before discarding.
 */

export type ListKind = "hazards" | "reports" | "help" | "responder";

export type Overlay =
  | { kind: "report" }
  | { kind: "sos" }
  | { kind: "settings" }
  | { kind: ListKind }
  /** Details for any map item. `from` lets "Back" return to the list. */
  | { kind: "details"; id: string; from?: ListKind };

export type OverlayKind = Overlay["kind"];

export const DRAWER_KINDS: OverlayKind[] = ["hazards", "reports", "help", "responder", "details"];
export const isDrawer = (o: Overlay | null) => !!o && DRAWER_KINDS.includes(o.kind);

export interface LatLng {
  lat: number;
  lng: number;
}

interface PickRequest {
  purpose: string;
  initial: LatLng | null;
  resolve: (value: LatLng | null) => void;
}

interface PendingConfirm {
  title: string;
  body: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
}

interface OverlayContextValue {
  overlay: Overlay | null;
  /** Open (or replace with) an overlay. Resolves false if the user kept a draft. */
  open: (next: Overlay) => Promise<boolean>;
  /** Close the current overlay (asks first if it has an unsaved draft). */
  close: () => Promise<boolean>;
  /** Forms call this so navigation can protect unsaved input. */
  setDirty: (kind: OverlayKind, dirty: boolean, message?: string) => void;

  /** Mobile sheets: collapsed to a peek bar so the map is visible. */
  sheetCollapsed: boolean;
  setSheetCollapsed: (v: boolean) => void;

  /** Choose-on-map mode. The requesting form stays mounted (draft kept). */
  picking: PickRequest | null;
  pickLocation: (purpose: string, initial: LatLng | null) => Promise<LatLng | null>;
  finishPick: (value: LatLng | null) => void;

  /** Accessible confirm used for discard prompts. */
  confirm: PendingConfirm | null;
  answerConfirm: (ok: boolean) => void;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

const DEFAULT_DISCARD = {
  title: "Discard your draft?",
  body: "You have unsaved changes. If you leave now they will be lost.",
};

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [picking, setPicking] = useState<PickRequest | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const dirtyRef = useRef<Map<OverlayKind, string | undefined>>(new Map());
  const overlayRef = useRef<Overlay | null>(null);

  const ask = useCallback(
    (title: string, body: string, confirmLabel: string) =>
      new Promise<boolean>((resolve) => setConfirm({ title, body, confirmLabel, resolve })),
    []
  );

  const answerConfirm = useCallback((ok: boolean) => {
    setConfirm((c) => {
      c?.resolve(ok);
      return null;
    });
  }, []);

  /** Ask before leaving an overlay that holds an unsaved draft. */
  const guardLeave = useCallback(async () => {
    const current = overlayRef.current;
    if (!current || !dirtyRef.current.has(current.kind)) return true;
    const message = dirtyRef.current.get(current.kind);
    const ok = await ask(
      current.kind === "sos" ? "Your SOS has not been sent" : DEFAULT_DISCARD.title,
      message ?? DEFAULT_DISCARD.body,
      current.kind === "sos" ? "Discard SOS" : "Discard draft"
    );
    if (ok) dirtyRef.current.delete(current.kind);
    return ok;
  }, [ask]);

  const commit = useCallback((next: Overlay | null) => {
    overlayRef.current = next;
    setOverlay(next);
    setSheetCollapsed(false);
  }, []);

  /** Navigating elsewhere cancels a pending choose-on-map. */
  const cancelPick = useCallback(() => {
    setPicking((p) => {
      p?.resolve(null);
      return null;
    });
  }, []);

  const open = useCallback(
    async (next: Overlay) => {
      cancelPick();
      const current = overlayRef.current;
      const sameForm = current && current.kind === next.kind && (next.kind === "report" || next.kind === "sos");
      if (sameForm) return true; // already open — keep the draft
      if (!(await guardLeave())) return false;
      commit(next);
      return true;
    },
    [guardLeave, commit, cancelPick]
  );

  const close = useCallback(async () => {
    cancelPick();
    if (!(await guardLeave())) return false;
    commit(null);
    return true;
  }, [guardLeave, commit, cancelPick]);

  const setDirty = useCallback((kind: OverlayKind, dirty: boolean, message?: string) => {
    if (dirty) dirtyRef.current.set(kind, message);
    else dirtyRef.current.delete(kind);
  }, []);

  const pickLocation = useCallback(
    (purpose: string, initial: LatLng | null) =>
      new Promise<LatLng | null>((resolve) => setPicking({ purpose, initial, resolve })),
    []
  );

  const finishPick = useCallback((value: LatLng | null) => {
    setPicking((p) => {
      p?.resolve(value);
      return null;
    });
  }, []);

  const value = useMemo(
    () => ({
      overlay,
      open,
      close,
      setDirty,
      sheetCollapsed,
      setSheetCollapsed,
      picking,
      pickLocation,
      finishPick,
      confirm,
      answerConfirm,
    }),
    [overlay, open, close, setDirty, sheetCollapsed, picking, pickLocation, finishPick, confirm, answerConfirm]
  );

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlay() {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("useOverlay must be used within an OverlayProvider");
  return ctx;
}
