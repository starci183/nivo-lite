import { NextResponse, type NextRequest } from "next/server";
import { ingestBankCredit } from "@/lib/bank-feed";
import { boundAgent, loadConnectionSecret, safeEqual, sha256 } from "@/lib/channels";
import type { SepayPayload } from "@/lib/sepay";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * A workspace's OWN SePay bank feed (not NIVO's billing: that is /api/sepay/webhook). The workspace owner pastes this URL and the
 * generated API key into SePay's webhook settings: POST with `Authorization: Apikey <key>` and the transaction as JSON.
 * Only an incoming credit on a connection bound to the workspace's active ACCOUNTING agent is fed into the normal payment
 * reconciliation (same pipeline as the bank route); otherwise it is acknowledged and ignored. SePay counts a delivery as
 * successful only on HTTP 200/201 with {"success": true}, so every accepted, duplicate or ignored payload answers exactly that.
 * Idempotency: the SePay transaction `id` is the inbound event id (`sepay:<id>`).
 */
export const dynamic = "force-dynamic";

const ok = (extra: Record<string, unknown> = {}) => NextResponse.json({ success: true, ...extra });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params;
  const presented = request.headers.get("authorization")?.match(/^\s*Apikey\s+(.+?)\s*$/i)?.[1];
  const conn = UUID.test(connectionId) && presented ? await loadConnectionSecret(connectionId, "sepay").catch(() => null) : null;
  if (!conn || !presented || !safeEqual(sha256(presented), conn.webhookSecret)) {
    return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as SepayPayload | null;
  const sepayId = Number(body?.id);
  if (!body || !Number.isSafeInteger(sepayId)) return NextResponse.json({ success: false, message: "missing id" }, { status: 400 });
  if (body.transferType !== "in") return ok({ ignored: "not_a_credit" });
  const amount = Number(body.transferAmount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return ok({ ignored: "no_amount" });

  const agent = await boundAgent(connectionId, "accounting", ["bank_feed"]).catch(() => null);
  if (!agent) return ok({ ignored: "no_agent" });

  const db = supabaseAdmin();
  const { data: meta } = await db.from("connections").select("name").eq("id", connectionId).maybeSingle<{ name: string }>();
  try {
    const result = await ingestBankCredit(db, conn.workspaceId, {
      amount, content: (body.content ?? body.description ?? body.code ?? "").trim(), sender: null,
      eventId: `sepay:${sepayId}`, bankName: meta?.name ?? body.gateway ?? "SePay", origin: "live",
    });
    return ok({ duplicate: result.duplicate });
  } catch (e) {
    console.error("sepay feed failed", e instanceof Error ? e.message : e);
    // 500 so SePay retries; the inbound event id keeps a retry from being applied twice.
    return NextResponse.json({ success: false, message: "failed" }, { status: 500 });
  }
}
