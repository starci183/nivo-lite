import { NextResponse, type NextRequest } from "next/server";
import { loadConnectionSecret, safeEqual, sha256 } from "@/lib/channels";
import { feedCredit } from "@/lib/connection-events";
import type { SepayPayload } from "@/lib/sepay";
import { withErrorReport } from "@/lib/errors";

/**
 * A workspace's OWN SePay bank feed (not NIVO's billing: that is /api/sepay/webhook). The wizard shows the owner this URL and the
 * generated API key to paste into SePay's "Thêm Webhook" form: POST with `Authorization: Apikey <key>` and the transaction as JSON.
 * Every incoming credit marks the connection as working (pending -> connected); it is fed into payment reconciliation only when
 * the connection is bound to the workspace's active ACCOUNTING agent, as simulated when the connection is a test-mode one.
 * SePay counts a delivery as successful only on HTTP 200/201 with {"success": true}, so every accepted, duplicate or ignored
 * payload answers exactly that. Idempotency: the SePay transaction `id` is the inbound event id (`sepay:<id>`).
 */
export const dynamic = "force-dynamic";

const ok = (extra: Record<string, unknown> = {}) => NextResponse.json({ success: true, ...extra });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function postHandler(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
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

  try {
    const result = await feedCredit(connectionId, conn.workspaceId, {
      amount, content: (body.content ?? body.description ?? body.code ?? "").trim(), eventId: `sepay:${sepayId}`, fallbackBankName: body.gateway ?? "SePay",
    });
    return ok({ ...result });
  } catch (e) {
    console.error("sepay feed failed", e instanceof Error ? e.message : e);
    // 500 so SePay retries; the inbound event id keeps a retry from being applied twice.
    return NextResponse.json({ success: false, message: "failed" }, { status: 500 });
  }
}

export const POST = withErrorReport("api.connections.sepay", postHandler);
