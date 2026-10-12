import "server-only";
import { createHash } from "node:crypto";
import { normaliseContact } from "./core";
import type { EngineCtx } from "./engine";
import { createBooking, findSlotsFor, loadModel, type ServiceRow } from "./module-booking";
import { offerText, whenText } from "./module-booking-copy";
import { supabaseAdmin } from "./supabase/admin";

/**
 * The public booking page /b/<slug>: no login, so everything here is defensive. The slug maps to one workspace whose owner switched the page on; the only
 * things a visitor can do are list that workspace's active services and free times, and ask for a booking (which goes through the authority gate like any
 * request: free and within policy is confirmed by itself, anything else waits for the owner). Rate limited per visitor and per page; a honeypot field drops bots.
 */
export type PublicPage = {
  readonly workspaceId: string; readonly shop: string; readonly slug: string; readonly note: string; readonly address: string; readonly tz: string;
  readonly services: ReadonlyArray<Pick<ServiceRow, "id" | "name" | "description" | "duration_min" | "price_vnd">>;
};

export const loadPublicPage = async (slug: string): Promise<PublicPage | null> => {
  if (!/^[a-z0-9][a-z0-9-]{2,40}$/.test(slug)) return null;
  const db = supabaseAdmin();
  const { data } = await db.from("booking_settings").select("workspace_id, public_note, address, timezone").eq("public_slug", slug).eq("public_enabled", true).maybeSingle();
  const s = data as { workspace_id: string; public_note: string; address: string; timezone: string } | null;
  if (!s) return null;
  const ws = await db.from("workspaces").select("name").eq("id", s.workspace_id).maybeSingle();
  const m = await loadModel(s.workspace_id);
  return {
    workspaceId: s.workspace_id, shop: (ws.data as { name: string } | null)?.name ?? "", slug, note: s.public_note, address: s.address, tz: s.timezone,
    services: m.services.filter((x) => x.active).map((x) => ({ id: x.id, name: x.name, description: x.description, duration_min: x.duration_min, price_vnd: x.price_vnd })),
  };
};

/** The visitor's key for the rate limit: a hash of the address the proxy saw (never stored raw). */
export const visitorKey = (headers: Headers): string => {
  const ip = (headers.get("x-forwarded-for") ?? headers.get("x-real-ip") ?? "unknown").split(",")[0].trim();
  return createHash("sha256").update(`booking:${ip}`).digest("hex").slice(0, 24);
};

/** true = allowed. Counters live in booking_rate (atomic upsert); a failure of the limiter itself refuses (fail closed). */
export const allow = async (key: string, limit: number, windowSec: number): Promise<boolean> => {
  const { data, error } = await supabaseAdmin().rpc("booking_rate_hit", { p_key: key, p_limit: limit, p_window_sec: windowSec });
  return !error && data === true;
};

export const publicSlots = async (page: PublicPage, serviceId: string, date: string, party: number): Promise<{ readonly times: ReadonlyArray<string> }> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { times: [] };
  const r = await findSlotsFor(page.workspaceId, { service: serviceId, date, partySize: party, limit: 200 });
  return { times: [...new Set(r.slots.map((s) => s.start))] };
};

export type PublicBookInput = { readonly serviceId: string; readonly start: string; readonly name: string; readonly phone: string; readonly email: string; readonly party: number; readonly note: string; readonly token: string };
export type PublicBookResult = { readonly ok: boolean; readonly state: "confirmed" | "waiting" | "invalid" | "failed"; readonly message: string; readonly alternatives: ReadonlyArray<string>; readonly bookingId: string | null };

export const publicBook = async (page: PublicPage, i: PublicBookInput): Promise<PublicBookResult> => {
  const bad = (message: string): PublicBookResult => ({ ok: false, state: "invalid", message, alternatives: [], bookingId: null });
  const name = i.name.trim().slice(0, 120);
  const phone = normaliseContact(i.phone);
  const digits = (phone ?? "").replace(/\D/g, "").length;
  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.email.trim()) ? i.email.trim().toLowerCase().slice(0, 120) : null;
  const startMs = Date.parse(i.start);
  if (!name) return bad("Bạn nhập giúp tên nhé.");
  if (!phone || digits < 8 || digits > 15) return bad("Số điện thoại chưa đúng, bạn kiểm tra lại giúp nhé.");
  if (!Number.isFinite(startMs)) return bad("Bạn chọn giờ hẹn giúp nhé.");
  if (!page.services.some((s) => s.id === i.serviceId)) return bad("Dịch vụ này không còn nhận đặt.");
  const ctx: EngineCtx = { db: supabaseAdmin(), ws: page.workspaceId, actor: "Trang đặt lịch", locale: "vi" };
  const r = await createBooking(ctx, {
    serviceId: i.serviceId, startMs, partySize: Math.min(20, Math.max(1, Math.round(i.party) || 1)), customer: { name, phone, email }, channel: "public_page", channelLabel: "Trang đặt lịch",
    note: i.note.trim().slice(0, 400), idemKey: /^[A-Za-z0-9-]{8,64}$/.test(i.token) ? `public:${i.token}` : null,
  });
  if (r.state === "failed" || !r.booking) return { ok: false, state: "failed", message: r.message ?? "Chưa đặt được lịch, bạn thử lại hoặc liên hệ cửa hàng nhé.", alternatives: [], bookingId: null };
  const svc = page.services.find((s) => s.id === i.serviceId) as PublicPage["services"][number];
  if (r.state === "confirmed") return { ok: true, state: "confirmed", message: `Đã xác nhận lịch ${svc.name} lúc ${whenText(startMs, page.tz)}. Hẹn gặp bạn!`, alternatives: [], bookingId: r.booking.id };
  return {
    ok: true, state: "waiting", bookingId: r.booking.id, alternatives: r.alternatives.map((a) => new Date(a.startMs).toISOString()),
    message: r.free
      ? `Cửa hàng đã nhận yêu cầu ${svc.name} lúc ${whenText(startMs, page.tz)} và sẽ xác nhận với bạn sớm.`
      : `${offerText(page.shop, svc.name, r.alternatives.map((a) => a.startMs), page.tz, startMs)} Yêu cầu của bạn đã được gửi cho cửa hàng xem.`,
  };
};
