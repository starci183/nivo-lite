import { NextResponse, type NextRequest } from "next/server";
import { allow, loadPublicPage, publicSlots, visitorKey } from "@/lib/module-booking-public";

/** GET /api/b/<slug>/slots?service=<id>&date=YYYY-MM-DD&party=1 : free start times of one service on one day (public, rate limited). */
export const dynamic = "force-dynamic";
const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await loadPublicPage(slug);
  if (!page) return json({ error: "not_found" }, 404);
  if (!(await allow(`slots:${visitorKey(request.headers)}`, 60, 60))) return json({ error: "rate_limited" }, 429);
  const q = request.nextUrl.searchParams;
  const service = q.get("service") ?? "";
  if (!page.services.some((s) => s.id === service)) return json({ error: "bad_service" }, 400);
  const party = Math.min(20, Math.max(1, Number(q.get("party")) || 1));
  return json({ ok: true, ...(await publicSlots(page, service, q.get("date") ?? "", party)) });
}
