import { NextResponse, type NextRequest } from "next/server";
import { runTick } from "@/lib/automation-engine";
import { loadAutomations } from "@/lib/automation-queries";
import { SAMPLE_VARS, fillBody } from "@/lib/automation-shared";
import { verifyTick } from "@/lib/automation-tick";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/automation/tick: the minute tick of the automations (pg_cron -> automation_tick() -> pg_net, see migration 20261005134000). Public path in the
 * proxy; authenticated by an HMAC (src/lib/automation-tick.ts). Idempotent: scheduled runs are unique per trigger, so a double tick does nothing twice.
 * With a body { "inspect": "<workspace id>" } (same signature) it instead returns what the gallery of that workspace would show (which templates apply, why
 * not, the preview text): a read-only operator check that needs no session.
 */
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (!verifyTick(request.headers)) return NextResponse.json({ error: { code: "unauthorized", message: "Chữ ký không hợp lệ." } }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as { inspect?: unknown };
    if (typeof body.inspect === "string" && UUID.test(body.inspect)) {
      const { cards, shop } = await loadAutomations(supabaseAdmin(), body.inspect);
      return NextResponse.json({
        ok: true, shop,
        cards: cards.map((c) => ({
          key: c.key, module: c.def.moduleKey, proposed: c.proposed, comingSoon: c.comingSoon, enabled: c.enabled, dismissed: c.dismissed, gate: c.gate,
          missing: c.missing.map((m) => `${m.kind}:${m.key}`), trust: c.trust, bodyStale: c.bodyStale,
          preview: c.def.defaultBody ? fillBody(c.body ?? c.def.defaultBody.vi, { ten_shop: shop.shop, gio_mo_cua: shop.hours, ...SAMPLE_VARS }) : null,
        })),
      });
    }
    const out = await runTick();
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    console.error("automation tick failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: { code: "tick_failed", message: "Lỗi khi chạy tự động hoá." } }, { status: 500 });
  }
}
