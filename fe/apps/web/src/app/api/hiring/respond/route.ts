import { NextResponse, type NextRequest } from "next/server";
import { hashIp, hdb, rateLimited } from "@/lib/module-hiring-core";
import { answerOffer, pickInterviewSlot } from "@/lib/module-hiring-flow";

/**
 * POST /api/hiring/respond (JSON, no login): the candidate's own links.
 *   { kind: "slot",  token, start }   pick one of the proposed interview times (start = null: none fits)
 *   { kind: "offer", token, accept }  accept or decline a job offer
 * The token is the secret (32 hex, one per interview or offer); 30 calls per hour per address.
 */
export const dynamic = "force-dynamic";

const reply = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
const ipOf = (r: NextRequest): string => r.headers.get("x-nf-client-connection-ip") ?? r.headers.get("x-real-ip") ?? r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { kind?: unknown; token?: unknown; start?: unknown; accept?: unknown } | null;
  if (!body || typeof body.token !== "string") return reply(400, { ok: false, message: "Yêu cầu chưa đúng." });
  const db = hdb();
  if (await rateLimited(db, hashIp(ipOf(request)), null, 30, "respond")) return reply(429, { ok: false, message: "Bạn thao tác hơi nhiều lần. Vui lòng thử lại sau." });
  try {
    if (body.kind === "slot") {
      const r = await pickInterviewSlot(db, body.token, typeof body.start === "string" ? body.start : null);
      return reply(r.ok ? 200 : 409, { ok: r.ok, message: r.message });
    }
    if (body.kind === "offer" && typeof body.accept === "boolean") {
      const r = await answerOffer(db, body.token, body.accept);
      return reply(r.ok ? 200 : 409, { ok: r.ok, message: r.message });
    }
    return reply(400, { ok: false, message: "Yêu cầu chưa đúng." });
  } catch (e) {
    console.error("hiring respond failed:", e instanceof Error ? e.message : e);
    return reply(500, { ok: false, message: "Có lỗi, vui lòng thử lại sau ít phút." });
  }
}
