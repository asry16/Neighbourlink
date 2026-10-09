"use client";

import { useEffect, type RefObject } from "react";

/**
 * Calls `onDismiss` on outside pointer-down or Escape while `active`. Pass
 * several refs when a popup is portalled outside its trigger's subtree.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
  active: boolean,
  onDismiss: () => void
) {
  useEffect(() => {
    if (!active) return;

    const refs = Array.isArray(ref) ? ref : [ref];
    const onPointerDown = (e: PointerEvent) => {
      const inside = refs.some((r) => r.current?.contains(e.target as Node));
      if (!inside) onDismiss();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, active, onDismiss]);
}
