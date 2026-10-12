import { NextResponse, type NextRequest } from "next/server";
import { verifyTick } from "@/lib/automation-tick";
import { runHiringTick } from "@/lib/module-hiring-tick";

/**
 * POST /api/hiring/tick: the 5-minute tick of Hiring (pg_cron -> hiring_tick() -> pg_net, migration 20261013100000). Public path in the proxy; authenticated by the
 * same HMAC as the automation tick (src/lib/automation-tick.ts). Idempotent: reminders, expiry and retention mark what they did.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!verifyTick(request.headers)) return NextResponse.json({ error: { code: "unauthorized", message: "Chữ ký không hợp lệ." } }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await runHiringTick()) });
  } catch (e) {
    console.error("hiring tick failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: { code: "tick_failed", message: "Lỗi khi chạy tuyển dụng tự động." } }, { status: 500 });
  }
}
