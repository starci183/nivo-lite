import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { loadConnectionSecret, safeEqual } from "@/lib/channels";
import { feedCredit } from "@/lib/connection-events";

/**
 * payOS webhook for one connection. payOS posts {code, desc, success, data{orderCode, amount, description, reference, ...}, signature};
 * `signature` is HMAC-SHA256 (hex) with the channel's Checksum Key over the `data` fields sorted by key, as `key=value` joined by `&`
 * (null/undefined as empty text). A paid order is an incoming credit fed into the same bank pipeline; idempotency is
 * `payos:<reference | orderCode>`. payOS's own webhook confirmation sends a sample (orderCode 123); it is acknowledged, never booked.
 * payOS counts any 2xx as delivered.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type PayosBody = { code?: string; success?: boolean; data?: Record<string, unknown> | null; signature?: string };

const text = (v: unknown): string => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
const payosSignature = (data: Record<string, unknown>, checksumKey: string): string =>
  createHmac("sha256", checksumKey).update(Object.keys(data).sort().map((k) => `${k}=${text(data[k])}`).join("&")).digest("hex");

export async function POST(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params;
  const body = (await request.json().catch(() => null)) as PayosBody | null;
  const conn = UUID.test(connectionId) ? await loadConnectionSecret(connectionId, "payos").catch(() => null) : null;
  if (!conn || !body?.data || typeof body.data !== "object") return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  // payOS's confirmation ping uses a sample order and may not be signed with the key yet: acknowledge it without booking anything.
  if (Number(body.data.orderCode) === 123) return NextResponse.json({ success: true, ignored: "sample" });

  let checksumKey = "";
  try {
    checksumKey = (JSON.parse(conn.credential) as { checksumKey?: string }).checksumKey ?? "";
  } catch {
    checksumKey = "";
  }
  if (!checksumKey || !body.signature || !safeEqual(payosSignature(body.data, checksumKey), body.signature)) {
    return NextResponse.json({ success: false, message: "bad signature" }, { status: 401 });
  }
  if (body.success === false || body.code !== "00") return NextResponse.json({ success: true, ignored: "not_paid" });
  const amount = Number(body.data.amount ?? 0);
  const ref = text(body.data.reference) || text(body.data.orderCode);
  if (!Number.isFinite(amount) || amount <= 0 || !ref) return NextResponse.json({ success: true, ignored: "no_amount" });

  try {
    const result = await feedCredit(connectionId, conn.workspaceId, {
      amount, content: text(body.data.description).trim(), eventId: `payos:${ref}`, fallbackBankName: "payOS",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("payos feed failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, message: "failed" }, { status: 500 });
  }
}
