import { NextResponse, type NextRequest } from "next/server";
import { verifyTick } from "@/lib/automation-tick";
import { runContentTick } from "@/lib/module-content-tick";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/content/tick: the quarter-hour tick of the content automations (pg_cron -> content_tick() -> pg_net, migration 20261012100000).
 * Public path in the proxy; authenticated by the same HMAC as the automation tick (src/lib/automation-tick.ts). Idempotent: every automation
 * keeps a mark per day/week in content_settings.marks, so a double tick does nothing twice. A body { "workspace": "<id>", "force": true } runs the
 * switched-on automations of that one workspace now (operator check; it only writes Office messages and drafts, never posts anywhere).
 */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (!verifyTick(request.headers)) return NextResponse.json({ error: { code: "unauthorized", message: "Chữ ký không hợp lệ." } }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as { workspace?: unknown; force?: unknown };
    const only = typeof body.workspace === "string" && UUID.test(body.workspace) ? body.workspace : undefined;
    const done = await runContentTick(supabaseAdmin(), { only, force: body.force === true && !!only });
    return NextResponse.json({ ok: true, done });
  } catch (e) {
    console.error("content tick failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: { code: "tick_failed", message: "Lỗi khi chạy tự động hoá nội dung." } }, { status: 500 });
  }
}
