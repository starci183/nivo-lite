import { NextResponse, type NextRequest } from "next/server";
import { handleMetaEvents } from "@/lib/meta-inbound";
import { metaApp, parseWebhook, verifyChallenge, verifySignature } from "@/lib/meta-core";

/**
 * The ONE Meta webhook of the app (Facebook Pages and Instagram): /api/connections/meta/webhook. Meta cannot be given a URL per customer,
 * so the Page / Instagram account id inside each event finds the workspace connection that owns it (lib/meta-inbound).
 *   GET   verification: hub.mode=subscribe + hub.verify_token (META_WEBHOOK_VERIFY_TOKEN) -> echo hub.challenge, else 403.
 *   POST  X-Hub-Signature-256 = sha256 HMAC of the RAW body with META_APP_SECRET, compared in constant time; an unsigned or wrongly signed
 *         call is 401 and nothing is read. A valid call is parsed into normalised events and stored/dispatched. Answers 200 quickly;
 *         500 only when an event could not be stored, so Meta redelivers it (events are idempotent).
 */
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const challenge = verifyChallenge(request.nextUrl.searchParams, process.env.META_WEBHOOK_VERIFY_TOKEN);
  return challenge === null ? new NextResponse("forbidden", { status: 403 }) : new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
}

export async function POST(request: NextRequest) {
  const app = metaApp();
  const raw = Buffer.from(await request.arrayBuffer());
  if (!app || !verifySignature(request.headers.get("x-hub-signature-256"), raw, app.appSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return NextResponse.json({ ok: true, events: 0 });
  }
  const events = parseWebhook(body);
  if (events.length === 0) return NextResponse.json({ ok: true, events: 0 });
  try {
    const results = await handleMetaEvents(events);
    return NextResponse.json({ ok: true, events: events.length, handled: results.filter((r) => r.handled).length });
  } catch {
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
