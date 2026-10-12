import "server-only";
import { composeAndSend, customerConversation, loadLead, type Db, type Executor } from "./automation-runs";
import type { PipelineConfig, TemplateDef } from "./automation-shared";
import { findSlotsFor, loadBooking, loadModel, ACTIVE, type BookingRow } from "./module-booking";
import { whenText } from "./module-booking-copy";

/**
 * Booking automations (templates in resources/automation-templates/booking_*.json, default OFF). They only decide WHO to message and WHEN; the words come from the
 * approved body of the card and every send goes through the authority gate (composeAndSend). Scans run in the minute tick (automation-engine.ts calls scanBooking).
 *   booking_review           ask for feedback some hours after a finished appointment
 *   booking_comeback         invite a customer back N days after a service (N is per service: booking_services.followup_days)
 *   booking_waitlist_notice  tell a waiting customer when a slot in their window opens
 */
export const BOOKING_TEMPLATE_KEYS: ReadonlyArray<string> = ["booking_review", "booking_comeback", "booking_waitlist_notice"];

const skipped = (detail: string) => ({ status: "skipped" as const, steps: [{ label: "Bỏ qua", status: "skipped" as const, detail }] });
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const customerOf = async (x: Parameters<Executor>[0], b: BookingRow) => {
  const lead = b.lead_id ? await loadLead(x.db, x.ws, b.lead_id) : null;
  if (!lead) return { lead: null, conv: null } as const;
  return { lead, conv: await customerConversation(x.db, x.ws, lead.id) } as const;
};

/** Variables of the booking cards: the shared ones plus {dich_vu} and {gio_hen} (a missing value reads as a neutral word). */
const vars = (b: BookingRow, service: string, tz: string, extra: Record<string, string> = {}) =>
  ({ ten_khach: b.customer_name, dich_vu: service, gio_hen: whenText(Date.parse(b.start_at), tz), ...extra }) as unknown as Parameters<typeof composeAndSend>[1]["vars"];

export const bookingReview: Executor = async (x, p) => {
  const b = await loadBooking(x.ws, String(p.booking_id ?? ""));
  if (!b || b.status !== "done") return skipped("Lịch hẹn chưa xong hoặc không còn.");
  const m = await loadModel(x.ws);
  const svc = m.services.find((s) => s.id === b.service_id);
  const { lead, conv } = await customerOf(x, b);
  if (!lead || !conv) return skipped(`${b.customer_name || "Khách"} chưa có cuộc trò chuyện nào để NIVO nhắn lại.`);
  return composeAndSend(x, {
    action: "send_care", lead, conversationId: conv.id, dedupe: `bkreview:${b.id}`, summary: `Xin nhận xét của ${lead.contact_name} sau buổi ${svc?.name ?? "hẹn"}`,
    caseNote: `Khách vừa xong dịch vụ ${svc?.name ?? ""}.`, vars: vars(b, svc?.name ?? "dịch vụ", m.settings.timezone),
  });
};

export const bookingComeBack: Executor = async (x, p) => {
  const b = await loadBooking(x.ws, String(p.booking_id ?? ""));
  if (!b || b.status !== "done") return skipped("Lịch hẹn cũ không còn.");
  const m = await loadModel(x.ws);
  const svc = m.services.find((s) => s.id === b.service_id);
  const days = svc?.followup_days ?? 0;
  // the customer already has something coming up: no need to invite them
  const future = b.lead_id ? await x.db.from("bookings").select("id", { count: "exact", head: true }).eq("workspace_id", x.ws).eq("lead_id", b.lead_id).in("status", [...ACTIVE]).gt("start_at", new Date().toISOString()) : null;
  if ((future?.count ?? 0) > 0) return skipped("Khách đã có lịch hẹn sắp tới.");
  const { lead, conv } = await customerOf(x, b);
  if (!lead || !conv) return skipped(`${b.customer_name || "Khách"} chưa có cuộc trò chuyện nào để NIVO nhắn lại.`);
  return composeAndSend(x, {
    action: "send_follow_up", lead, conversationId: conv.id, dedupe: `bkback:${b.id}`, summary: `Mời ${lead.contact_name} quay lại sau ${days} ngày (${svc?.name ?? ""})`,
    caseNote: `Khách làm ${svc?.name ?? "dịch vụ"} khoảng ${days} ngày trước.`, vars: vars(b, svc?.name ?? "dịch vụ", m.settings.timezone, { so_ngay: String(days) }),
  });
};

export const bookingWaitlistNotice: Executor = async (x, p) => {
  const id = String(p.waitlist_id ?? "");
  const { data } = await x.db.from("booking_waitlist").select("*").eq("workspace_id", x.ws).eq("id", id).maybeSingle();
  const w = data as { id: string; status: string; lead_id: string | null; customer_name: string; service_id: string; party_size: number; window_end: string } | null;
  if (!w || w.status !== "waiting") return skipped("Khách đã được báo hoặc không còn chờ.");
  const m = await loadModel(x.ws);
  const svc = m.services.find((s) => s.id === w.service_id);
  const slotMs = Date.parse(String(p.slot_start ?? ""));
  if (!svc || !Number.isFinite(slotMs)) return skipped("Không còn thông tin chỗ trống.");
  // still free at this moment? (someone may have taken it since the scan)
  const still = await findSlotsFor(x.ws, { service: svc.id, fromMs: slotMs, toMs: slotMs + 1, partySize: w.party_size });
  if (!still.slots.length) return skipped("Chỗ trống đã có người đặt.");
  const lead = w.lead_id ? await loadLead(x.db, x.ws, w.lead_id) : null;
  const conv = lead ? await customerConversation(x.db, x.ws, lead.id) : null;
  if (!lead || !conv) return skipped(`${w.customer_name || "Khách"} chưa có cuộc trò chuyện nào để NIVO nhắn lại.`);
  const fake = { id: "", workspace_id: x.ws, customer_name: w.customer_name, start_at: new Date(slotMs).toISOString() } as unknown as BookingRow;
  const res = await composeAndSend(x, {
    action: "send_care", lead, conversationId: conv.id, dedupe: `bkwl:${w.id}:${slotMs}`, summary: `Báo ${lead.contact_name} có chỗ trống ${svc.name} lúc ${whenText(slotMs, m.settings.timezone)}`,
    caseNote: `Khách đang chờ lịch ${svc.name}; vừa có chỗ trống.`, vars: vars(fake, svc.name, m.settings.timezone),
  });
  if (res.status === "done" || res.status === "waiting_approval") await x.db.from("booking_waitlist").update({ status: "notified", notified_at: new Date().toISOString() }).eq("id", w.id);
  return res;
};

export const BOOKING_EXECUTORS: Readonly<Record<string, Executor>> = { booking_review: bookingReview, booking_comeback: bookingComeBack, booking_waitlist_notice: bookingWaitlistNotice };

type Trigger = (dedupe: string, ref: string, payload: Record<string, unknown>) => Promise<void>;
const BATCH = 8;

/** Look at the data on a clock and start a run for each customer who is due (a run is unique per dedupe key, so scanning every minute is safe). */
export const scanBooking = async (a: { readonly db: Db; readonly ws: string; readonly def: TemplateDef; readonly config: PipelineConfig; readonly now: Date; readonly trigger: Trigger; readonly pipelineId: string }): Promise<number> => {
  const { db, ws, def, config, now } = a;
  const used = new Set((((await db.from("automation_runs").select("dedupe_key").eq("pipeline_id", a.pipelineId).like("dedupe_key", "bk%").limit(5000)).data ?? []) as Array<{ dedupe_key: string }>).map((r) => r.dedupe_key));
  let started = 0;
  if (def.key === "booking_review") {
    const after = Number(config.afterHours) || 3;
    const { data } = await db.from("bookings").select("id, done_at").eq("workspace_id", ws).eq("status", "done").gte("done_at", new Date(now.getTime() - 14 * DAY).toISOString()).lte("done_at", new Date(now.getTime() - after * HOUR).toISOString()).order("done_at").limit(60);
    for (const b of (data ?? []) as Array<{ id: string }>) {
      if (started >= BATCH) break;
      if (used.has(`bkreview:${b.id}`)) continue;
      await a.trigger(`bkreview:${b.id}`, b.id, { booking_id: b.id });
      started += 1;
    }
    return started;
  }
  if (def.key === "booking_comeback") {
    const { data: svcs } = await db.from("booking_services").select("id, followup_days").eq("workspace_id", ws).not("followup_days", "is", null);
    for (const s of (svcs ?? []) as Array<{ id: string; followup_days: number }>) {
      if (started >= BATCH) break;
      const due = new Date(now.getTime() - s.followup_days * DAY).toISOString();
      const { data } = await db.from("bookings").select("id").eq("workspace_id", ws).eq("service_id", s.id).eq("status", "done").lte("done_at", due).gte("done_at", new Date(now.getTime() - (s.followup_days + 30) * DAY).toISOString()).limit(30);
      for (const b of (data ?? []) as Array<{ id: string }>) {
        if (started >= BATCH) break;
        if (used.has(`bkback:${b.id}`)) continue;
        await a.trigger(`bkback:${b.id}`, b.id, { booking_id: b.id });
        started += 1;
      }
    }
    return started;
  }
  if (def.key === "booking_waitlist_notice") {
    const { data } = await db.from("booking_waitlist").select("id, service_id, party_size, window_start, window_end").eq("workspace_id", ws).eq("status", "waiting").gt("window_end", now.toISOString()).order("created_at").limit(30);
    for (const w of (data ?? []) as Array<{ id: string; service_id: string; party_size: number; window_start: string; window_end: string }>) {
      if (started >= BATCH) break;
      const r = await findSlotsFor(ws, { service: w.service_id, fromMs: Math.max(Date.parse(w.window_start), now.getTime()), toMs: Date.parse(w.window_end), partySize: w.party_size, limit: 1, nowMs: now.getTime() });
      const slot = r.slots[0];
      if (!slot) continue;
      const dedupe = `bkwl:${w.id}:${Date.parse(slot.start)}`;
      if (used.has(dedupe)) continue;
      await a.trigger(dedupe, w.id, { waitlist_id: w.id, slot_start: slot.start, resource_id: slot.resource_id });
      started += 1;
    }
    return started;
  }
  return 0;
};
