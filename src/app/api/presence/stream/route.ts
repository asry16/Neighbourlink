import { connection } from "next/server";
import { PresenceService } from "@/services/presence-service";
import type { PresenceSnapshot } from "@/lib/presence-types";

/** Coalesce bursts of updates into at most ~7 snapshots a second. */
const THROTTLE_MS = 140;
/** Periodic snapshot keeps the connection alive and drops stale walkers. */
const HEARTBEAT_MS = 3000;

/** Server-Sent Events stream of everyone currently walking. */
export async function GET(request: Request) {
  await connection();
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let throttle: ReturnType<typeof setTimeout> | null = null;

      const send = () => {
        if (closed) return;
        const snapshot: PresenceSnapshot = { walkers: PresenceService.list(), serverNow: Date.now() };
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
        } catch {
          cleanup();
        }
      };

      const unsubscribe = PresenceService.subscribe(() => {
        if (throttle) return;
        throttle = setTimeout(() => {
          throttle = null;
          send();
        }, THROTTLE_MS);
      });
      const heartbeat = setInterval(send, HEARTBEAT_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        if (throttle) clearTimeout(throttle);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", cleanup);
      send();
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
