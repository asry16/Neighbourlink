"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Focusable descendants that are actually visible. */
export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

/**
 * On open: remember the trigger and move focus into `ref` (to `[data-autofocus]`,
 * else the first field, else the container). On close: return focus to the trigger.
 */
export function useFocusOnOpen(ref: RefObject<HTMLElement | null>, open: boolean) {
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const root = ref.current;
    if (root) {
      const target =
        root.querySelector<HTMLElement>("[data-autofocus]") ??
        root.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select") ??
        root;
      target.focus({ preventScroll: true });
    }
    return () => {
      const trigger = triggerRef.current;
      if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    };
  }, [ref, open]);
}

/** Keep Tab / Shift+Tab inside `ref` while active (modal dialogs only). */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !ref.current) return;
      const items = focusables(ref.current);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ref, active]);
}

/** Prevent the page behind a modal from scrolling (incl. iOS overscroll). */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { body, documentElement } = document;
    const prev = [body.style.overflow, documentElement.style.overscrollBehavior];
    body.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "none";
    return () => {
      body.style.overflow = prev[0];
      documentElement.style.overscrollBehavior = prev[1];
    };
  }, [active]);
}

/*
 * Escape goes to the top-most open layer only (e.g. a discard prompt above a
 * form). Layers register in mount order; the last one wins.
 */
const escapeStack: { current: () => void }[] = [];
let escapeListening = false;

function onGlobalKey(e: KeyboardEvent) {
  if (e.key !== "Escape" || escapeStack.length === 0) return;
  e.preventDefault();
  escapeStack[escapeStack.length - 1].current();
}

export function useEscape(active: boolean, onEscape: () => void) {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });
  useEffect(() => {
    if (!active) return;
    const entry = { current: () => handler.current() };
    escapeStack.push(entry);
    if (!escapeListening) {
      document.addEventListener("keydown", onGlobalKey);
      escapeListening = true;
    }
    return () => {
      const i = escapeStack.indexOf(entry);
      if (i >= 0) escapeStack.splice(i, 1);
    };
  }, [active]);
}
