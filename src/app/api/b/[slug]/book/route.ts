import { NextResponse, type NextRequest } from "next/server";
import { allow, loadPublicPage, publicBook, visitorKey } from "@/lib/module-booking-public";
import { withErrorReport } from "@/lib/errors";

/**
 * POST /api/b/<slug>/book  { service_id, start (ISO), name, phone, email?, party?, note?, token?, website? }
 * Public, no login. 8 requests per 10 minutes per visitor and 120 per hour per page. `website` is a honeypot: a filled value is dropped silently.
 * The request goes through the authority gate (confirm_booking): free and within policy = confirmed; otherwise it waits for the owner.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });

async function postHandler(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await loadPublicPage(slug);
  if (!page) return json({ error: "not_found" }, 404);
  const visitor = visitorKey(request.headers);
  if (!(await allow(`book:${visitor}`, 8, 600)) || !(await allow(`page:${page.workspaceId}`, 120, 3600))) return json({ error: "rate_limited", message: "Bạn thao tác hơi nhanh, thử lại sau ít phút nhé." }, 429);
  let body: Record<string, unknown>;
  try {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("not an object");
    body = raw as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  if (typeof body.website === "string" && body.website.trim()) return json({ ok: true, state: "waiting", message: "Cửa hàng đã nhận yêu cầu của bạn." }); // honeypot
  const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
  const r = await publicBook(page, {
    serviceId: s(body.service_id, 60), start: s(body.start, 40), name: s(body.name, 120), phone: s(body.phone, 40), email: s(body.email, 120), party: Number(body.party) || 1, note: s(body.note, 400), token: s(body.token, 64),
  });
  return json({ ok: r.ok, state: r.state, message: r.message, alternatives: r.alternatives, booking_id: r.bookingId }, r.state === "invalid" ? 400 : 200);
}

export const POST = withErrorReport("api.booking.public", postHandler);
