import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/channels";
import { cronSecret, refreshDueConnections } from "@/lib/zalo";

/**
 * Scheduled token refresh (pg_cron every 6 hours via public.zalo_refresh_tick(), no engine involved). Protected by a bearer derived
 * from the service key; refreshes every Zalo OA whose access token ends within 7 hours, which also keeps the 3-month refresh token rolling.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const given = request.headers.get("authorization")?.match(/^\s*Bearer\s+(.+?)\s*$/i)?.[1];
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !given || !safeEqual(given, cronSecret())) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await refreshDueConnections()) });
}
