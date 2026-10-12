import type { NextRequest } from "next/server";
import { apiOk, handle } from "@/lib/api-v1";
import { listEvents } from "@/lib/api-v1-ops";

/** GET /api/v1/events?since=<ISO time>&limit=100: the workspace's evidence log after `since` (oldest first), a pull-based alternative to outgoing webhooks. Bearer key. */
export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) =>
  handle(request, "events:read", async (who) => {
    const url = request.nextUrl.searchParams;
    const limit = Math.min(500, Math.max(1, Number(url.get("limit")) || 100));
    const { events, next_since } = await listEvents(who, url.get("since"), limit);
    return apiOk({ events, next_since });
  });
