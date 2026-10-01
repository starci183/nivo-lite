import { NextResponse, type NextRequest } from "next/server";
import { isValidApiKey, orderCodesIn, type SepayPayload } from "@/lib/sepay";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * SePay webhook (https://docs.sepay.vn): POST with `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>` and the transaction as
 * JSON. SePay counts a delivery as successful only on HTTP 200/201 with `{"success": true}` and retries otherwise (Fibonacci
 * back-off, up to 7 times), so every accepted or duplicate payload answers exactly that.
 * Idempotency: the SePay `id` is unique in `sepay_transactions`; a repeat is acknowledged and not applied twice.
 * Matching: only incoming transfers whose content (or SePay's `code`) names a pending, unexpired order and cover its amount
 * settle it, atomically in SQL (`settle_payment_order`); anything else is stored for manual review on /billing.
 */
export const dynamic = "force-dynamic";

const ok = () => NextResponse.json({ success: true });

type Outcome = "paid" | "underpaid" | "expired" | "unmatched" | "ignored";

export async function POST(request: NextRequest) {
  if (!isValidApiKey(request.headers.get("authorization"), process.env.SEPAY_WEBHOOK_API_KEY)) {
    return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  }
  let body: SepayPayload;
  try {
    body = (await request.json()) as SepayPayload;
  } catch {
    return NextResponse.json({ success: false, message: "invalid json" }, { status: 400 });
  }
  const sepayId = Number(body?.id);
  if (!Number.isSafeInteger(sepayId)) return NextResponse.json({ success: false, message: "missing id" }, { status: 400 });

  const db = supabaseAdmin();
  const amount = Number(body.transferAmount ?? 0);
  const inserted = await db
    .from("sepay_transactions")
    .upsert(
      { sepay_id: sepayId, payload: body, transfer_amount: Number.isFinite(amount) ? amount : null, content: body.content ?? body.code ?? null },
      { onConflict: "sepay_id", ignoreDuplicates: true },
    )
    .select("id");
  if (inserted.error) return NextResponse.json({ success: false, message: inserted.error.message }, { status: 500 });

  if (!inserted.data?.length) {
    // Already stored: a retry. Only a delivery that crashed before it was processed is worth another go.
    const { data: prior } = await db.from("sepay_transactions").select("status").eq("sepay_id", sepayId).maybeSingle<{ status: string }>();
    if (prior && prior.status !== "received") return ok();
  }

  let outcome: Outcome = "unmatched";
  if (body.transferType === "in") {
    for (const code of orderCodesIn(body.code, body.content, body.description)) {
      const res = await db.rpc("settle_payment_order", { p_order_code: code, p_amount: amount, p_sepay_id: sepayId });
      if (res.error) return NextResponse.json({ success: false, message: res.error.message }, { status: 500 });
      if (res.data !== "unmatched") {
        outcome = res.data as Outcome;
        break;
      }
    }
  } else {
    outcome = "ignored";
  }
  // A second transfer for an already-paid order ("ignored" in SQL) stays listed for review (status unmatched + the order).
  const status = body.transferType === "in" && outcome === "ignored" ? "unmatched" : outcome;
  const upd = await db.from("sepay_transactions").update({ status, processed_at: new Date().toISOString() }).eq("sepay_id", sepayId);
  if (upd.error) return NextResponse.json({ success: false, message: upd.error.message }, { status: 500 });
  return ok();
}
