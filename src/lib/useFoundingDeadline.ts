import { useSyncExternalStore } from "react";
import { resolveFoundingDeadline, type FoundingDeadline } from "./foundingDeadline";

let snapshot: FoundingDeadline | null = null;

function sameDeadline(a: FoundingDeadline, b: FoundingDeadline): boolean {
  return (
    a.date === b.date &&
    a.closed === b.closed &&
    a.daysLeft === b.daysLeft &&
    a.overrideDate === b.overrideDate &&
    a.endsAtMs === b.endsAtMs
  );
}

function compute(): FoundingDeadline {
  const raw = new URLSearchParams(window.location.search).get("d");
  return resolveFoundingDeadline(new Date(), raw);
}

function getSnapshot(): FoundingDeadline {
  const next = compute();
  if (snapshot && sameDeadline(snapshot, next)) return snapshot;
  snapshot = next;
  return snapshot;
}

function getServerSnapshot(): FoundingDeadline | null {
  return null;
}

function subscribe(onStoreChange: () => void): () => void {
  const id = window.setInterval(onStoreChange, 30_000);
  window.addEventListener("popstate", onStoreChange);
  return () => {
    window.clearInterval(id);
    window.removeEventListener("popstate", onStoreChange);
  };
}

/**
 * Client deadline for the current URL. Null during server render and the
 * hydration pass so prerendered HTML does not bake in a build-time date.
 */
export function useFoundingDeadline(): FoundingDeadline | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
