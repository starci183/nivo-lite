import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { BANK_CONNECTION, bankEventId } from "@/lib/bank";
import { ingestBankCredit } from "@/lib/bank-feed";
import { publicConfig } from "@/lib/config";

/**
 * Bank connection webhook (SIMULATED "Vietcombank"): one credit to the workspace's account becomes a bank payment input and
 * runs the normal reconcile_payment work. A credit whose content names exactly one open payment record code with the same
 * amount completes by policy (below the limit); anything else waits for the owner's check with a written basis.
 * Security: the caller must send `x-nivo-bank-secret` = BANK_WEBHOOK_SECRET. No user session: the service-role client is
 * scoped to TELEGRAM_WORKSPACE_ID (the one workspace connected to the real channels).
 * Idempotency: `event_id` (the bank's own transaction id) is the inbound key; the same credit sent again is recorded once.
 * Body: { amount_vnd: number, content: string, sender_name?: string, event_id: string }
 */
type Credit = { amount_vnd?: unknown; content?: unknown; sender_name?: unknown; event_id?: unknown };

export async function POST(request: NextRequest) {
  const secret = process.env.BANK_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-nivo-bank-secret") !== secret) return NextResponse.json({ ok: false }, { status: 401 });
  const ws = process.env.TELEGRAM_WORKSPACE_ID;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!ws || !serviceKey) {
    console.error("bank webhook: TELEGRAM_WORKSPACE_ID or SUPABASE_SERVICE_ROLE_KEY is not set");
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as Credit;
  const amount = typeof body.amount_vnd === "number" ? body.amount_vnd : Number(body.amount_vnd);
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const sender = typeof body.sender_name === "string" && body.sender_name.trim() ? body.sender_name.trim() : null;
  const eventId = typeof body.event_id === "string" || typeof body.event_id === "number" ? String(body.event_id).trim() : "";
  if (!Number.isFinite(amount) || amount <= 0 || !eventId) {
    return NextResponse.json({ ok: false, error: "amount_vnd (> 0) and event_id are required" }, { status: 400 });
  }

  const db = createClient(publicConfig.supabaseUrl, serviceKey, { auth: { persistSession: false } });
  try {
    const r = await ingestBankCredit(db, ws, {
      amount, content, sender, eventId: bankEventId(eventId), bankName: BANK_CONNECTION.name, origin: "simulated",
    });
    if (r.duplicate) return NextResponse.json({ ok: true, duplicate: true, inbound_event_id: r.event.id });
    const item = r.item;
    return NextResponse.json({
      ok: true, duplicate: false, inbound_event_id: r.event.id,
      work_item: { id: item.id, status: item.status, reason: item.reason, summary: item.result?.summary ?? item.proposal?.summary ?? null },
    });
  } catch (e) {
    console.error("bank webhook failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
