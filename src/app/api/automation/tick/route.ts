import { NextResponse, type NextRequest } from "next/server";
import { runTick } from "@/lib/automation-engine";
import { verifyTick } from "@/lib/automation-tick";

/**
 * POST /api/automation/tick: the minute tick of the automations (pg_cron -> automation_tick() -> pg_net, see migration 20261005134000). Public path in the
 * proxy; authenticated by an HMAC (src/lib/automation-tick.ts). Idempotent: scheduled runs are unique per trigger, so a double tick does nothing twice.
 */
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!verifyTick(request.headers)) return NextResponse.json({ error: { code: "unauthorized", message: "Chữ ký không hợp lệ." } }, { status: 401 });
  try {
    const out = await runTick();
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    console.error("automation tick failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: { code: "tick_failed", message: "Lỗi khi chạy tự động hoá." } }, { status: 500 });
  }
}
