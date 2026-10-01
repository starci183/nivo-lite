import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { loadConnectionSecret, safeEqual } from "@/lib/channels";
import { feedCredit } from "@/lib/connection-events";

/**
 * Casso bank-feed webhook for one connection. Webhook V2: header `X-Casso-Signature: t=<ms>,v1=<hex>` where v1 is HMAC-SHA512 (hex) with
 * the integration's "Key bảo mật" over `t + "." + JSON.stringify(body with keys sorted A-Z at every level)`; body `{error, data}`.
 * Webhook V1 (header `secure-token` equal to the key, `data` an array) is accepted too. Positive amounts are credits; idempotency is
 * `casso:<Casso transaction id>`. Casso expects HTTP 200 within 5 seconds.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type CassoTx = { id?: number | string; tid?: string; reference?: string; description?: string; amount?: number | string; bankName?: string };

// Same as Casso's published sample (CassoHQ/casso-webhook-v2-verify-signature).
const sortKeys = (data: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(data).sort()) {
    const v = data[key];
    out[key] = typeof v === "object" && v !== null ? sortKeys(v as Record<string, unknown>) : v;
  }
  return out;
};
const cassoSignature = (body: Record<string, unknown>, t: string, key: string): string =>
  createHmac("sha512", key).update(`${t}.${JSON.stringify(sortKeys(body))}`).digest("hex");

export async function POST(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const conn = UUID.test(connectionId) ? await loadConnectionSecret(connectionId, "casso").catch(() => null) : null;
  let key = "";
  try {
    key = conn ? ((JSON.parse(conn.credential) as { secureKey?: string }).secureKey ?? "") : "";
  } catch {
    key = "";
  }
  const sig = request.headers.get("x-casso-signature")?.match(/t=(\d+),\s*v1=([a-f0-9]+)/i);
  const legacy = request.headers.get("secure-token");
  const valid = Boolean(conn && body && key && ((sig && safeEqual(cassoSignature(body, sig[1], key), sig[2].toLowerCase())) || (!sig && legacy && safeEqual(legacy, key))));
  if (!conn || !body || !valid) return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  if (Number(body.error ?? 0) !== 0) return NextResponse.json({ success: true, ignored: "error" });

  const rows = (Array.isArray(body.data) ? body.data : [body.data]).filter((r): r is CassoTx => typeof r === "object" && r !== null);
  try {
    let accepted = 0;
    for (const tx of rows) {
      const amount = Number(tx.amount ?? 0);
      const id = tx.id ?? tx.tid ?? tx.reference;
      if (!Number.isFinite(amount) || amount <= 0 || id === undefined || id === "") continue;
      await feedCredit(connectionId, conn.workspaceId, { amount, content: (tx.description ?? "").trim(), eventId: `casso:${id}`, fallbackBankName: tx.bankName ?? "Casso" });
      accepted += 1;
    }
    return NextResponse.json({ success: true, accepted });
  } catch (e) {
    console.error("casso feed failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, message: "failed" }, { status: 500 });
  }
}
