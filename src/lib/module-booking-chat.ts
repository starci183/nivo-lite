import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvidence } from "./core";
import { runWork, type EngineCtx } from "./engine";
import { addDays, localDate, zonedMs } from "./module-booking-availability";
import {
  ACTIVE, cancelBooking, createBooking, findSlotsFor, holdMessage, joinWaitlist, loadModel, offerMessage, rescheduleBooking, resolveService, type BookingRow, type ServiceRow,
} from "./module-booking";
import { offerText, closedText } from "./module-booking-copy";
import type { AgentConversation } from "./types";

/**
 * The chatbot's door into booking, WITHOUT touching customer-turn.ts or the engine. Two ways in, one behaviour:
 *   handleBookingReply  the engine's proposed reply (chat.reply) carries a structured `booking_request` (the reply contract in module-booking-contract.ts);
 *                       engine-bridge.ts calls this right after the normal reply was applied.
 *   runBookingTool      the OpenClaw tool contract (booking.find_slots / booking.request): the same functions, callable as tools from the engine's tool bridge.
 * Everything that changes a booking or reaches the customer goes through the gate (createBooking / rescheduleBooking / cancelBooking run runWork); the
 * words the customer reads come from fixed Vietnamese templates filled with facts from the database, never from the model.
 */
type Req = {
  readonly intent: "book" | "reschedule" | "cancel" | "availability" | "waitlist";
  readonly service: string; readonly date: string | null; readonly time: string | null; readonly from: string | null; readonly to: string | null;
  readonly partySize: number; readonly name: string; readonly phone: string | null; readonly email: string | null; readonly note: string | null;
};

const text = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const hhmm = (v: unknown): string | null => (typeof v === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v.trim()) ? v.trim().padStart(5, "0") : null);
const ymd = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null);

export const readBookingRequest = (obj: Record<string, unknown> | null | undefined): Req | null => {
  const r = obj?.booking_request;
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  const o = r as Record<string, unknown>;
  const intent = o.intent;
  if (intent !== "book" && intent !== "reschedule" && intent !== "cancel" && intent !== "availability" && intent !== "waitlist") return null;
  const party = Number(o.party_size);
  return {
    intent, service: text(o.service, 160), date: ymd(o.date), time: hhmm(o.time), from: hhmm(o.from), to: hhmm(o.to), partySize: Number.isFinite(party) && party >= 1 ? Math.min(200, Math.round(party)) : 1,
    name: text(o.contact_name, 120), phone: text(o.phone, 40) || null, email: text(o.email, 120) || null, note: text(o.note, 400) || null,
  };
};

/** Loose JSON of the model's final message (same tolerance as the reply reader: fences and text around the object). */
export const parseModelJson = (raw: string): Record<string, unknown> | null => {
  const body = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const v: unknown = JSON.parse(s);
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const whole = tryParse(body);
  if (whole) return whole;
  const a = body.indexOf("{");
  const b = body.lastIndexOf("}");
  return a >= 0 && b > a ? tryParse(body.slice(a, b + 1)) : null;
};

const channelKey = (conv: AgentConversation): string => (conv.channel === "telegram" ? "telegram" : conv.channel === "zalo" ? "zalo" : "website");
const channelLabel = (conv: AgentConversation): string => (conv.channel === "telegram" ? "Telegram" : conv.channel === "zalo" ? "Zalo" : "Website chat");

/** A line to the customer, through the gate (reply_customer): auto by default, a waiting decision when the owner's rule says ask. */
const say = async (c: EngineCtx, conv: AgentConversation, body: string, dedupe: string, summary: string): Promise<void> => {
  await runWork(c, {
    action: "reply_customer", subject_type: "conversation", subject_id: conv.id, lead_id: conv.lead_id, origin: "live", dedupeKey: `reply_customer:booking:${dedupe}`, preset: true, noChain: true,
    seed: { summary, draft: body, outcome: "clear", fields: { conversation_id: conv.id, question: "" } },
  });
};

/** The customer's next active appointment: through the conversation's lead. */
const nextBooking = async (db: SupabaseClient, ws: string, conv: AgentConversation, svc: ServiceRow | null): Promise<BookingRow | null> => {
  let q = db.from("bookings").select("*").eq("workspace_id", ws).in("status", [...ACTIVE]).gt("start_at", new Date().toISOString()).order("start_at").limit(1);
  q = conv.lead_id ? q.eq("lead_id", conv.lead_id) : q.eq("conversation_id", conv.id);
  if (svc) q = q.eq("service_id", svc.id);
  return ((await q).data ?? [])[0] as BookingRow | null ?? null;
};

export type BookingChatResult = { readonly intent: string; readonly state: string; readonly booking_id: string | null; readonly work_item_id: string | null; readonly said: string | null };

/** Run one structured booking request of a conversation. `key` makes it idempotent (the engine job id or a tool call id). */
export const applyBookingRequest = async (c: EngineCtx, conv: AgentConversation, req: Req, key: string): Promise<BookingChatResult> => {
  const ws = c.ws;
  const m = await loadModel(ws);
  const tz = m.settings.timezone;
  const svc = req.service ? resolveService(m.services, req.service) : null;
  const done = (state: string, said: string | null, b?: { id: string } | null, itemId?: string | null): BookingChatResult => ({ intent: req.intent, state, booking_id: b?.id ?? null, work_item_id: itemId ?? null, said });

  if (req.intent === "reschedule" || req.intent === "cancel") {
    const b = await nextBooking(c.db, ws, conv, svc);
    if (!b) {
      const t = "Mình chưa thấy lịch hẹn sắp tới nào của bạn. Bạn cho mình xin số điện thoại đã đặt lịch để mình kiểm tra nhé.";
      await say(c, conv, t, `${key}:none`, "Khách đổi/hủy lịch nhưng chưa tìm thấy lịch hẹn");
      return done("not_found", t);
    }
    if (req.intent === "cancel") {
      const r = await cancelBooking(c, { bookingId: b.id, reason: req.note ?? "Khách yêu cầu hủy" });
      if (r.state === "waiting") {
        const t = `Mình đã chuyển yêu cầu hủy lịch cho cửa hàng xem${r.feeVnd > 0 ? " (hủy sát giờ có thể có phí theo chính sách)" : ""} và sẽ báo lại bạn sớm nhé.`;
        await say(c, conv, t, `${key}:cancel`, "Báo khách: yêu cầu hủy đang chờ cửa hàng");
        return done("waiting", t, b, r.item?.id);
      }
      return done(r.state, null, b, r.item?.id); // the performer already told the customer
    }
    if (!req.date || !req.time) {
      const t = "Bạn muốn đổi sang ngày và giờ nào ạ?";
      await say(c, conv, t, `${key}:ask`, "Hỏi khách giờ mới");
      return done("need_time", t, b);
    }
    const startMs = zonedMs(req.date, req.time, tz);
    const r = await rescheduleBooking(c, { bookingId: b.id, startMs });
    if (r.state === "waiting") {
      const t = r.free ? "Mình đã ghi nhận yêu cầu đổi lịch của bạn, cửa hàng sẽ xác nhận lại sớm nhé." : await offerMessage(ws, m.services.find((s) => s.id === b.service_id) as ServiceRow, r.alternatives, startMs);
      await say(c, conv, t, `${key}:resched`, "Báo khách về yêu cầu đổi lịch");
      return done("waiting", t, b, r.item?.id);
    }
    return done(r.state, null, b, r.item?.id);
  }

  if (!svc) {
    const t = `Bạn muốn đặt dịch vụ nào ạ? Bên mình có: ${m.services.filter((s) => s.active).map((s) => s.name).join(", ")}.`;
    await say(c, conv, t, `${key}:svc`, "Hỏi khách chọn dịch vụ");
    return done("need_service", t);
  }
  if (!req.date) {
    const t = `Bạn muốn đặt ${svc.name} vào ngày nào ạ?`;
    await say(c, conv, t, `${key}:date`, "Hỏi khách ngày hẹn");
    return done("need_date", t);
  }
  const shop = ((await c.db.from("workspaces").select("name").eq("id", ws).maybeSingle()).data as { name: string } | null)?.name ?? "";

  if (req.intent === "availability" || ((req.intent === "book" || req.intent === "waitlist") && !req.time)) {
    const from = req.from ?? "00:00";
    const to = req.to ?? "24:00";
    const dayStart = zonedMs(req.date, "00:00", tz);
    const fromMs = zonedMs(req.date, from, tz);
    const toMs = to === "24:00" ? zonedMs(addDays(req.date, 1), "00:00", tz) : zonedMs(req.date, to, tz);
    if (req.intent === "waitlist") {
      await joinWaitlist(ws, { serviceId: svc.id, windowStartMs: Math.max(fromMs, dayStart), windowEndMs: toMs, customer: { leadId: conv.lead_id, name: req.name || conv.visitor_name || "", phone: req.phone, email: req.email }, conversationId: conv.id, partySize: req.partySize });
      const t = `Bên mình đã ghi bạn vào danh sách chờ ${svc.name} ngày ${req.date.split("-").reverse().join("/")}. Có chỗ trống là mình báo bạn ngay nhé.`;
      await say(c, conv, t, `${key}:wl`, "Báo khách đã vào danh sách chờ");
      return done("waitlisted", t);
    }
    const found = await findSlotsFor(ws, { service: svc.id, fromMs, toMs, partySize: req.partySize, limit: 60 });
    const times = [...new Set(found.slots.map((s) => Date.parse(s.start)))].slice(0, 5);
    const t = found.reason === "closed" && !times.length ? closedText(shop, svc.name) : offerText(shop, svc.name, times, tz);
    await say(c, conv, t, `${key}:avail`, "Báo khách các giờ còn trống");
    return done("offered", t);
  }

  // book at an exact time
  const startMs = zonedMs(req.date, req.time as string, tz);
  const r = await createBooking(c, {
    serviceId: svc.id, startMs, partySize: req.partySize, customer: { leadId: conv.lead_id, name: req.name || conv.visitor_name || "", phone: req.phone, email: req.email }, channel: channelKey(conv), channelLabel: channelLabel(conv),
    conversationId: conv.id, note: req.note ?? "", idemKey: `chat:${key}`,
  });
  if (r.state === "waiting" && r.booking) {
    const t = r.free ? await holdMessage(r.booking) : offerText(shop, svc.name, r.alternatives.map((s) => s.startMs), tz, startMs) + " Mình cũng đã chuyển yêu cầu của bạn cho cửa hàng xem.";
    await say(c, conv, t, `${key}:hold`, r.free ? "Báo khách đã nhận yêu cầu đặt lịch" : "Báo khách giờ đã kín và các giờ gần nhất");
    return done("waiting", t, r.booking, r.item?.id);
  }
  if (r.state === "failed") {
    await logEvidence(c.db, ws, { lead_id: conv.lead_id, kind: "booking.chat_failed", actor: "Đặt lịch hẹn", summary: r.message ?? "Không tạo được lịch hẹn", evidence: key });
  }
  return done(r.state, null, r.booking, r.item?.id); // confirmed: the performer already sent the confirmation
};

/** The engine's proposed reply (raw text) may carry a booking_request: run it. Never throws into the reply path. */
export const handleBookingReply = async (db: SupabaseClient, job: { readonly id: string; readonly workspace_id: string; readonly payload: Record<string, unknown> }, raw: string): Promise<BookingChatResult | null> => {
  try {
    const req = readBookingRequest(parseModelJson(raw));
    if (!req) return null;
    const convId = String(job.payload.conversation_id ?? "");
    const conv = ((await db.from("agent_conversations").select("*").eq("id", convId).eq("workspace_id", job.workspace_id).maybeSingle()).data ?? null) as AgentConversation | null;
    if (!conv || conv.handled_by) return null;
    const agent = ((await db.from("agents").select("module").eq("id", conv.agent_id).maybeSingle()).data ?? null) as { module: string } | null;
    if (agent?.module !== "booking") return null; // only a booking agent may book
    const c: EngineCtx = { db, ws: job.workspace_id, actor: "OpenClaw", locale: "vi" };
    const out = await applyBookingRequest(c, conv, req, job.id);
    await logEvidence(db, job.workspace_id, { lead_id: conv.lead_id, kind: "booking.chat_request", actor: "OpenClaw", summary: `Yêu cầu đặt lịch từ chat: ${req.intent} → ${out.state}`, evidence: job.id });
    return out;
  } catch (e) {
    console.error("booking reply failed:", e instanceof Error ? e.message : e);
    return null;
  }
};

/* ------------------------------------------------------------------ the OpenClaw tool contract */

export const BOOKING_TOOL_NAMES = ["booking.find_slots", "booking.request"] as const;
export type BookingToolName = (typeof BOOKING_TOOL_NAMES)[number];

/** booking.find_slots {service, date, from?, to?, party_size?} -> free start times; booking.request {intent, service, date, time, ...} -> the same gated flow as the structured reply. */
export const runBookingTool = async (db: SupabaseClient, job: { readonly id: string; readonly workspace_id: string; readonly payload: Record<string, unknown> }, tool: BookingToolName, args: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const ws = job.workspace_id;
  const m = await loadModel(ws);
  const tz = m.settings.timezone;
  if (tool === "booking.find_slots") {
    const date = ymd(args.date) ?? localDate(Date.now(), tz);
    const from = hhmm(args.from) ?? "00:00";
    const to = hhmm(args.to);
    const r = await findSlotsFor(ws, {
      service: text(args.service, 160), fromMs: zonedMs(date, from, tz), toMs: to ? zonedMs(date, to, tz) : zonedMs(addDays(date, 1), "00:00", tz), partySize: Number(args.party_size) >= 1 ? Math.round(Number(args.party_size)) : 1, limit: 40,
    });
    return { ok: r.ok, service: r.service, reason: r.reason, slots: r.slots.map((s) => ({ start: s.start, resource: s.resource })) };
  }
  const req = readBookingRequest({ booking_request: args });
  if (!req) throw new Error("intent is required: book | reschedule | cancel | availability | waitlist");
  const convId = String(job.payload.conversation_id ?? "");
  const conv = ((await db.from("agent_conversations").select("*").eq("id", convId).eq("workspace_id", ws).maybeSingle()).data ?? null) as AgentConversation | null;
  if (!conv) throw new Error("no conversation for this job");
  const out = await applyBookingRequest({ db, ws, actor: "OpenClaw", locale: "vi" }, conv, req, `tool:${job.id}:${JSON.stringify(args).length}:${req.intent}:${req.date}:${req.time}`);
  return { ...out };
};
