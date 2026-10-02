import "server-only";
import { normaliseContact, logEvidence, matchLead, ingest } from "./core";
import { runWork, startOrderWork, type EngineCtx } from "./engine";
import type { WorkItem } from "./flow-types";
import {
  checkSlot, findSlots, nearestSlots, type DateException, type Policy, type Resource, type ServiceSpec, type Slot, type Taken, type Why, type WeeklyHours, zonedMs, addDays, localDate,
} from "./module-booking-availability";
import { confirmText, holdText, offerText, whyText, whenText } from "./module-booking-copy";
import { supabaseAdmin } from "./supabase/admin";
import { sendWorkspaceEmail } from "./email/send";
import { deliverToChannel } from "./telegram";
import type { Lead } from "./types";

/**
 * Booking: the server-side functions of the module. Everything a customer can cause (a chat request, the public page) goes through here and through the authority
 * gate (runWork: confirm_booking / reschedule / cancel_booking / cancel_with_fee / remind_booking); the performers in module-booking-performers.ts do the real work
 * once the gate lets the action through. The owner's own clicks in the workbench use the *Now functions (the owner is the authority). The database refuses a
 * double booking (booking_reserve / booking_relocate), so even two requests at the same instant cannot take the same slot.
 */
const adm = () => supabaseAdmin();

/* ------------------------------------------------------------------ rows */

export type BookingSettings = {
  readonly workspace_id: string; readonly timezone: string; readonly slot_step_min: number; readonly min_lead_min: number; readonly max_advance_days: number;
  readonly cancel_window_hours: number; readonly deposit_pct: number; readonly late_cancel_fee_pct: number; readonly no_show_fee_vnd: number;
  readonly auto_confirm: boolean; readonly handoff_order: boolean; readonly reminder_hours: ReadonlyArray<number>;
  readonly public_enabled: boolean; readonly public_slug: string | null; readonly public_note: string; readonly address: string;
};
export type ServiceRow = {
  readonly id: string; readonly workspace_id: string; readonly name: string; readonly description: string; readonly duration_min: number; readonly buffer_min: number;
  readonly price_vnd: number | null; readonly resource_kind: string | null; readonly followup_days: number | null; readonly active: boolean; readonly sort_order: number;
};
export type ResourceRow = Resource & { readonly workspace_id: string; readonly color: string; readonly staff_id: string | null };
export type BookingStatus = "requested" | "confirmed" | "rescheduled" | "cancelled" | "no_show" | "done";
export type BookingRow = {
  readonly id: string; readonly workspace_id: string; readonly lead_id: string | null; readonly conversation_id: string | null; readonly customer_name: string;
  readonly customer_phone: string | null; readonly customer_email: string | null; readonly service_id: string; readonly resource_id: string;
  readonly start_at: string; readonly end_at: string; readonly block_end_at: string; readonly party_size: number; readonly status: BookingStatus; readonly holds_slot: boolean;
  readonly source_channel: string; readonly price_vnd: number | null; readonly deposit_vnd: number; readonly deposit_status: string; readonly cancel_fee_vnd: number;
  readonly note: string; readonly conflict_note: string; readonly checked_in_at: string | null; readonly done_at: string | null; readonly rescheduled_from: string | null;
  readonly reschedule_count: number; readonly cancelled_at: string | null; readonly cancel_reason: string | null; readonly work_item_id: string | null;
  readonly origin: "live" | "simulated"; readonly created_at: string;
};

export const ACTIVE: ReadonlyArray<BookingStatus> = ["requested", "confirmed", "rescheduled"];

export const DEFAULT_SETTINGS = {
  timezone: "Asia/Ho_Chi_Minh", slot_step_min: 15, min_lead_min: 60, max_advance_days: 60, cancel_window_hours: 24, deposit_pct: 0, late_cancel_fee_pct: 0, no_show_fee_vnd: 0,
  auto_confirm: true, handoff_order: false, reminder_hours: [24, 2], public_enabled: false, public_slug: null, public_note: "", address: "",
} as const;

export const loadSettings = async (ws: string): Promise<BookingSettings> => {
  const { data } = await adm().from("booking_settings").select("*").eq("workspace_id", ws).maybeSingle();
  return { workspace_id: ws, ...DEFAULT_SETTINGS, ...((data ?? {}) as Partial<BookingSettings>) } as BookingSettings;
};

export type Model = {
  readonly settings: BookingSettings; readonly services: ReadonlyArray<ServiceRow>; readonly resources: ReadonlyArray<ResourceRow>;
  readonly hours: ReadonlyArray<WeeklyHours>; readonly exceptions: ReadonlyArray<DateException>;
};

export const loadModel = async (ws: string): Promise<Model> => {
  const db = adm();
  const [settings, services, resources, hours, exceptions] = await Promise.all([
    loadSettings(ws),
    db.from("booking_services").select("*").eq("workspace_id", ws).order("sort_order").order("created_at"),
    db.from("booking_resources").select("*").eq("workspace_id", ws).order("sort_order").order("created_at"),
    db.from("booking_hours").select("resource_id, weekday, start_time, end_time").eq("workspace_id", ws),
    db.from("booking_exceptions").select("resource_id, on_date, closed, start_time, end_time").eq("workspace_id", ws),
  ]);
  return {
    settings,
    services: (services.data ?? []) as Array<ServiceRow>,
    resources: ((resources.data ?? []) as Array<ResourceRow & { sort_order?: number }>).map((r) => ({ ...r, sort: r.sort_order ?? 0 })),
    hours: ((hours.data ?? []) as Array<{ resource_id: string; weekday: number; start_time: string; end_time: string }>).map((h) => ({ resourceId: h.resource_id, weekday: h.weekday, start: h.start_time.slice(0, 5), end: h.end_time.slice(0, 5) })),
    exceptions: ((exceptions.data ?? []) as Array<{ resource_id: string | null; on_date: string; closed: boolean; start_time: string | null; end_time: string | null }>).map((e) => ({ resourceId: e.resource_id, date: e.on_date, closed: e.closed, start: e.start_time?.slice(0, 5) ?? null, end: e.end_time?.slice(0, 5) ?? null })),
  };
};

export const policyOf = (s: BookingSettings): Policy => ({ timezone: s.timezone, slotStepMin: s.slot_step_min, minLeadMin: s.min_lead_min, maxAdvanceDays: s.max_advance_days });
export const specOf = (s: ServiceRow): ServiceSpec => ({ id: s.id, durationMin: s.duration_min, bufferMin: s.buffer_min, resourceKind: s.resource_kind, active: s.active });

const fold = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** A service by id, exact name, or the name the customer wrote (accents and case do not matter). */
export const resolveService = (services: ReadonlyArray<ServiceRow>, ref: string): ServiceRow | null => {
  const r = ref.trim();
  if (!r) return null;
  const byId = services.find((s) => s.id === r);
  if (byId) return byId;
  const f = fold(r);
  const active = services.filter((s) => s.active);
  return active.find((s) => fold(s.name) === f) ?? active.find((s) => fold(s.name).includes(f) || f.includes(fold(s.name))) ?? null;
};

/** Bookings (and nothing else) that hold a resource in a time range. */
export const loadTaken = async (ws: string, fromMs: number, toMs: number): Promise<Array<Taken>> => {
  const { data } = await adm().from("bookings").select("id, resource_id, start_at, block_end_at, party_size")
    .eq("workspace_id", ws).eq("holds_slot", true).in("status", [...ACTIVE]).lt("start_at", new Date(toMs).toISOString()).gt("block_end_at", new Date(fromMs).toISOString());
  return ((data ?? []) as Array<{ id: string; resource_id: string; start_at: string; block_end_at: string; party_size: number }>)
    .map((b) => ({ id: b.id, resourceId: b.resource_id, startMs: Date.parse(b.start_at), blockEndMs: Date.parse(b.block_end_at), partySize: b.party_size }));
};

/** Optional: the staff directory's shifts lane. Not wired yet (the booking module keeps its own resource hours); returns external blocks when a source exists. */
const externalBlocks = async (_ws: string, _fromMs: number, _toMs: number): Promise<Array<Taken>> => [];

/* ------------------------------------------------------------------ findSlots */

export type FindSlotsArgs = { readonly service: string; readonly date?: string; readonly fromMs?: number; readonly toMs?: number; readonly partySize?: number; readonly resourceId?: string | null; readonly nowMs?: number; readonly limit?: number };
export type FoundSlot = { readonly start: string; readonly end: string; readonly resource_id: string; readonly resource: string };
export type FindSlotsResult = { readonly ok: boolean; readonly service: { readonly id: string; readonly name: string; readonly duration_min: number; readonly price_vnd: number | null } | null; readonly slots: Array<FoundSlot>; readonly reason: Why | "no_service_found" };

/** The tool OpenClaw and the public page use: free start times of a service on a date (or in a range). */
export const findSlotsFor = async (ws: string, a: FindSlotsArgs): Promise<FindSlotsResult> => {
  const m = await loadModel(ws);
  const svc = resolveService(m.services, a.service);
  if (!svc) return { ok: false, service: null, slots: [], reason: "no_service_found" };
  const policy = policyOf(m.settings);
  const fromMs = a.fromMs ?? zonedMs(a.date ?? localDate(Date.now(), policy.timezone), "00:00", policy.timezone);
  const toMs = a.toMs ?? zonedMs(addDays(a.date ?? localDate(fromMs, policy.timezone), 1), "00:00", policy.timezone);
  const taken = [...(await loadTaken(ws, fromMs, toMs + 86_400_000)), ...(await externalBlocks(ws, fromMs, toMs))];
  const nowMs = a.nowMs ?? Date.now();
  const slots = findSlots({ service: specOf(svc), resources: m.resources, hours: m.hours, exceptions: m.exceptions, taken, policy, fromMs, toMs, nowMs, partySize: a.partySize, resourceId: a.resourceId });
  const name = new Map(m.resources.map((r) => [r.id, r.name]));
  const out = slots.slice(0, a.limit ?? 200).map((s) => ({ start: new Date(s.startMs).toISOString(), end: new Date(s.endMs).toISOString(), resource_id: s.resourceId, resource: name.get(s.resourceId) ?? "" }));
  let reason: Why = "free";
  if (!out.length) {
    const probe = checkSlot({ service: specOf(svc), resources: m.resources, hours: m.hours, exceptions: m.exceptions, taken, policy, nowMs, startMs: fromMs + 12 * 3_600_000, partySize: a.partySize, resourceId: a.resourceId });
    reason = probe.ok ? "free" : probe.why;
  }
  return { ok: true, service: { id: svc.id, name: svc.name, duration_min: svc.duration_min, price_vnd: svc.price_vnd }, slots: out, reason };
};

/* ------------------------------------------------------------------ people, channels, messages */

export type Customer = { readonly leadId?: string | null; readonly name: string; readonly phone?: string | null; readonly email?: string | null };

/** The customer's record: the lead the conversation already has, else a lead matched by phone/email, else a new one. */
export const ensureLead = async (ws: string, c: Customer & { readonly conversationId?: string | null; readonly channelLabel: string; readonly need: string }): Promise<Lead | null> => {
  const db = adm();
  if (c.leadId) {
    const { data } = await db.from("leads").select("*").eq("workspace_id", ws).eq("id", c.leadId).maybeSingle();
    if (data) return data as Lead;
  }
  const phone = normaliseContact(c.phone ?? null);
  const email = c.email?.trim().toLowerCase() || null;
  if (!phone && !email && !c.name.trim()) return null;
  let lead = await matchLead(db, ws, { phone, email, name: c.name, channel: c.channelLabel });
  if (!lead) {
    const ins = await db.from("leads").insert({ workspace_id: ws, contact_name: c.name.trim() || "Khách đặt lịch", company: "—", channel: c.channelLabel, need: c.need, phone, email, origin: "live" }).select().single();
    if (ins.error) throw new Error(ins.error.message);
    lead = ins.data as Lead;
    await logEvidence(db, ws, { lead_id: lead.id, kind: "lead.captured", actor: "Đặt lịch hẹn", summary: `Khách mới từ yêu cầu đặt lịch (${c.channelLabel})`, evidence: c.need });
  } else if ((phone && !lead.phone) || (email && !lead.email)) {
    await db.from("leads").update({ ...(phone && !lead.phone ? { phone } : {}), ...(email && !lead.email ? { email } : {}) }).eq("id", lead.id);
  }
  if (c.conversationId) await db.from("agent_conversations").update({ lead_id: lead.id }).eq("id", c.conversationId).is("lead_id", null);
  return lead;
};

export type Facts = { readonly shop: string; readonly customer: string; readonly service: ServiceRow; readonly resource: string; readonly startMs: number; readonly settings: BookingSettings };

const shopName = async (ws: string): Promise<string> => ((await adm().from("workspaces").select("name").eq("id", ws).maybeSingle()).data as { name: string } | null)?.name ?? "NIVO";

export const factsOf = async (b: BookingRow, m?: Model): Promise<Facts & { readonly deposit: number }> => {
  const model = m ?? (await loadModel(b.workspace_id));
  const service = model.services.find((s) => s.id === b.service_id);
  if (!service) throw new Error("service not found");
  return { shop: await shopName(b.workspace_id), customer: b.customer_name, service, resource: model.resources.find((r) => r.id === b.resource_id)?.name ?? "", startMs: Date.parse(b.start_at), settings: model.settings, deposit: b.deposit_vnd };
};

export const bookingFacts = (f: Facts & { readonly deposit?: number }) => ({
  shop: f.shop, customer: f.customer, service: f.service.name, resource: f.resource, startMs: f.startMs, tz: f.settings.timezone, address: f.settings.address || undefined,
  depositVnd: f.deposit ?? 0, cancelWindowHours: f.settings.cancel_window_hours,
});

/** The customer's latest real conversation (website, Telegram, Zalo): where a message to them leaves. */
const conversationOf = async (ws: string, b: Pick<BookingRow, "conversation_id" | "lead_id">): Promise<{ id: string; channel: string | null } | null> => {
  const db = adm();
  if (b.conversation_id) {
    const { data } = await db.from("agent_conversations").select("id, channel").eq("workspace_id", ws).eq("id", b.conversation_id).maybeSingle();
    if (data) return data as { id: string; channel: string | null };
  }
  if (!b.lead_id) return null;
  const { data } = await db.from("agent_conversations").select("id, channel").eq("workspace_id", ws).eq("lead_id", b.lead_id).eq("kind", "customer").order("created_at", { ascending: false }).limit(1);
  return ((data ?? [])[0] ?? null) as { id: string; channel: string | null } | null;
};

/**
 * Deliver one message to the booking's customer. ONLY called from a performer (the gate already allowed it): the conversation's own channel
 * (Telegram / Zalo for real, the website chat as a stored message), else email when the workspace has SMTP and the customer an address.
 */
export const deliverToCustomer = async (ws: string, b: BookingRow, text: string, workItemId: string, subject: string): Promise<{ sent: boolean; via: string }> => {
  const db = adm();
  const conv = await conversationOf(ws, b);
  if (conv) {
    await db.from("agent_messages").insert({ workspace_id: ws, conversation_id: conv.id, role: "agent", body: text });
    if (conv.channel === "telegram" || conv.channel === "zalo") return { sent: await deliverToChannel(db, conv.id, text), via: conv.channel };
    return { sent: true, via: "website" };
  }
  if (b.customer_email) {
    const r = await sendWorkspaceEmail({ workspaceId: ws, to: b.customer_email, subject, html: `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`, text, purpose: "booking", refs: { booking_id: b.id }, audience: "customer", workItemId });
    return { sent: r.status === "sent", via: "email" };
  }
  return { sent: false, via: "none" };
};

/* ------------------------------------------------------------------ create */

export type BookingAsk = {
  readonly serviceId: string; readonly startMs: number; readonly partySize?: number; readonly resourceId?: string | null; readonly customer: Customer;
  readonly channel: string; readonly channelLabel?: string; readonly conversationId?: string | null; readonly note?: string; readonly idemKey?: string | null; readonly nowMs?: number;
};
export type BookingOutcome = {
  readonly state: "confirmed" | "waiting" | "failed" | "rejected";
  readonly booking: BookingRow | null;
  readonly item: WorkItem | null;
  readonly free: boolean;
  readonly why: Why;
  readonly alternatives: ReadonlyArray<Slot>;
  readonly message?: string;
};

export const loadBooking = async (ws: string, id: string): Promise<BookingRow | null> =>
  ((await adm().from("bookings").select("*").eq("workspace_id", ws).eq("id", id).maybeSingle()).data ?? null) as BookingRow | null;

const contactOf = (c: Customer, channelLabel: string, hasConversation: boolean): string | null => normaliseContact(c.phone ?? null) || c.email?.trim() || (hasConversation ? channelLabel : null) || null;

/**
 * A customer asks for a time. Free and within policy: the booking is held and confirm_booking goes through the gate (auto: confirmed and told). Taken, outside hours or
 * outside policy: the request is recorded WITHOUT holding anyone's slot and waits for the owner (the nearest free times are returned to offer the customer).
 */
export const createBooking = async (c: EngineCtx, a: BookingAsk): Promise<BookingOutcome> => {
  const ws = c.ws;
  const db = adm();
  if (a.idemKey) {
    const dup = ((await db.from("bookings").select("*").eq("workspace_id", ws).eq("idempotency_key", a.idemKey).maybeSingle()).data ?? null) as BookingRow | null;
    if (dup) return { state: dup.status === "confirmed" ? "confirmed" : "waiting", booking: dup, item: null, free: dup.holds_slot, why: "free", alternatives: [] };
  }
  const m = await loadModel(ws);
  const svc = m.services.find((s) => s.id === a.serviceId);
  if (!svc) return { state: "failed", booking: null, item: null, free: false, why: "no_service", alternatives: [], message: "Không tìm thấy dịch vụ." };
  const policy = policyOf(m.settings);
  const nowMs = a.nowMs ?? Date.now();
  const party = Math.max(1, a.partySize ?? 1);
  const taken = await loadTaken(ws, a.startMs - 86_400_000, a.startMs + 2 * 86_400_000);
  const base = { service: specOf(svc), resources: m.resources, hours: m.hours, exceptions: m.exceptions, taken, policy, nowMs, partySize: party, resourceId: a.resourceId };
  const check = checkSlot({ ...base, startMs: a.startMs });
  const lead = await ensureLead(ws, { ...a.customer, conversationId: a.conversationId, channelLabel: a.channelLabel ?? a.channel, need: `Đặt lịch: ${svc.name}` });
  const dur = svc.duration_min * 60_000;
  const endMs = a.startMs + dur;
  const blockEndMs = endMs + svc.buffer_min * 60_000;
  const deposit = svc.price_vnd && m.settings.deposit_pct > 0 ? Math.round((svc.price_vnd * m.settings.deposit_pct) / 100) : 0;
  const row = (resourceId: string, holds: boolean, why: string) => ({
    workspace_id: ws, lead_id: lead?.id ?? "", conversation_id: a.conversationId ?? "", customer_name: a.customer.name.trim() || lead?.contact_name || "", customer_phone: normaliseContact(a.customer.phone ?? null) ?? lead?.phone ?? "",
    customer_email: a.customer.email?.trim() || lead?.email || "", service_id: svc.id, resource_id: resourceId, start_at: new Date(a.startMs).toISOString(), end_at: new Date(endMs).toISOString(),
    block_end_at: new Date(blockEndMs).toISOString(), party_size: party, status: "requested", holds_slot: holds, source_channel: a.channel, price_vnd: svc.price_vnd ?? "", deposit_vnd: deposit,
    deposit_status: deposit > 0 ? "due" : "none", note: a.note ?? "", conflict_note: why, idempotency_key: a.idemKey ?? "",
  });

  let free = check.ok;
  let id: string | null = null;
  if (check.ok) {
    const r = await db.rpc("booking_reserve", { p: row(check.slot.resourceId, true, "") });
    if (r.error) throw new Error(r.error.message);
    id = (r.data as string | null) ?? null;
    if (!id) free = false; // lost the race to another request
  }
  const why: Why = check.ok ? (free ? "free" : "full") : check.why;
  if (!id) {
    const fallbackResource = a.resourceId ?? m.resources.find((r) => r.active && (svc.resource_kind ? r.kind === svc.resource_kind : true))?.id;
    if (!fallbackResource) return { state: "failed", booking: null, item: null, free: false, why: "no_resource", alternatives: [], message: "Chưa có người hoặc phòng cho dịch vụ này." };
    const r = await db.rpc("booking_reserve", { p: row(fallbackResource, false, whyText(why)) });
    if (r.error) throw new Error(r.error.message);
    id = r.data as string;
  }
  const booking = (await loadBooking(ws, id)) as BookingRow;
  const alternatives = free ? [] : nearestSlots({ ...base, wantedMs: a.startMs, n: 3 });
  const contact = contactOf(a.customer, a.channelLabel ?? a.channel, !!a.conversationId) ?? lead?.phone ?? lead?.email ?? null;
  const f = { ...(await factsOf(booking, m)), resource: m.resources.find((r) => r.id === booking.resource_id)?.name ?? "" };
  const item = await runWork(c, {
    action: "confirm_booking", subject_type: "lead", subject_id: lead?.id ?? null, lead_id: lead?.id ?? null, origin: "live", dedupeKey: `confirm_booking:${booking.id}`, preset: true, noChain: true,
    ...(m.settings.auto_confirm ? {} : { forceAsk: "over_authority" as const }),
    seed: {
      summary: `${free ? "Xác nhận" : "Cần quyết"} lịch hẹn: ${booking.customer_name || "khách"} · ${svc.name} · ${whenText(a.startMs, policy.timezone)}${free ? "" : ` (${whyText(why)})`}`,
      outcome: free ? "clear" : "unclear", confidence: free ? 1 : 0.4,
      fields: { contact, booking_id: booking.id, service: svc.name, when: whenText(a.startMs, policy.timezone), resource: f.resource, customer: booking.customer_name, party_size: party, free: free ? "yes" : "no", why: whyText(why) },
    },
  });
  await db.from("bookings").update({ work_item_id: item.id }).eq("id", booking.id);
  const fresh = (await loadBooking(ws, booking.id)) as BookingRow;
  return { state: item.status === "done" ? "confirmed" : item.status === "waiting_decision" ? "waiting" : item.status === "rejected" ? "rejected" : "failed", booking: fresh, item, free, why, alternatives };
};

/* ------------------------------------------------------------------ reschedule / cancel (customer-caused: through the gate) */

export type RescheduleAsk = { readonly bookingId: string; readonly startMs: number; readonly resourceId?: string | null; readonly nowMs?: number };

export const rescheduleBooking = async (c: EngineCtx, a: RescheduleAsk): Promise<{ state: "done" | "waiting" | "failed" | "rejected"; item: WorkItem | null; free: boolean; why: Why; alternatives: ReadonlyArray<Slot>; booking: BookingRow | null }> => {
  const b = await loadBooking(c.ws, a.bookingId);
  if (!b || !ACTIVE.includes(b.status)) return { state: "failed", item: null, free: false, why: "no_service", alternatives: [], booking: b };
  const m = await loadModel(c.ws);
  const svc = m.services.find((s) => s.id === b.service_id) as ServiceRow;
  const policy = policyOf(m.settings);
  const nowMs = a.nowMs ?? Date.now();
  const taken = await loadTaken(c.ws, a.startMs - 86_400_000, a.startMs + 2 * 86_400_000);
  const base = { service: specOf(svc), resources: m.resources, hours: m.hours, exceptions: m.exceptions, taken, policy, nowMs, partySize: b.party_size, resourceId: a.resourceId ?? null, excludeId: b.id };
  const check = checkSlot({ ...base, startMs: a.startMs });
  const late = Date.parse(b.start_at) - nowMs < m.settings.cancel_window_hours * 3_600_000;
  const resourceId = check.ok ? check.slot.resourceId : (a.resourceId ?? b.resource_id);
  const endMs = a.startMs + svc.duration_min * 60_000;
  const blockEnd = endMs + svc.buffer_min * 60_000;
  const why: Why = check.ok ? "free" : check.why;
  const f = await factsOf(b, m);
  const item = await runWork(c, {
    action: "reschedule", subject_type: "lead", subject_id: b.lead_id, lead_id: b.lead_id, origin: b.origin, dedupeKey: `reschedule:${b.id}:${a.startMs}`, preset: true, noChain: true,
    ...(late ? { forceAsk: "over_authority" as const } : {}),
    seed: {
      summary: `Đổi lịch: ${b.customer_name || "khách"} · ${svc.name} từ ${whenText(Date.parse(b.start_at), policy.timezone)} sang ${whenText(a.startMs, policy.timezone)}${late ? ` (sát giờ, trong ${m.settings.cancel_window_hours} giờ)` : ""}${check.ok ? "" : ` (${whyText(why)})`}`,
      outcome: check.ok ? "clear" : "unclear", confidence: check.ok ? 1 : 0.4,
      fields: { contact: b.customer_phone ?? b.customer_email ?? "kênh chat", booking_id: b.id, new_start: new Date(a.startMs).toISOString(), new_end: new Date(endMs).toISOString(), new_block_end: new Date(blockEnd).toISOString(), new_resource_id: resourceId, free: check.ok ? "yes" : "no", late: late ? "yes" : "no", service: f.service.name },
    },
  });
  return { state: item.status === "done" ? "done" : item.status === "waiting_decision" ? "waiting" : item.status === "rejected" ? "rejected" : "failed", item, free: check.ok, why, alternatives: check.ok ? [] : nearestSlots({ ...base, wantedMs: a.startMs, n: 3 }), booking: await loadBooking(c.ws, b.id) };
};

export type CancelAsk = { readonly bookingId: string; readonly reason?: string; readonly nowMs?: number };

/** Free cancellation (outside the window, or a policy with no fee) is cancel_booking; a late cancel with a fee is cancel_with_fee, which always asks the owner. */
export const cancelBooking = async (c: EngineCtx, a: CancelAsk): Promise<{ state: "done" | "waiting" | "failed" | "rejected"; item: WorkItem | null; feeVnd: number; late: boolean; booking: BookingRow | null }> => {
  const b = await loadBooking(c.ws, a.bookingId);
  if (!b || !ACTIVE.includes(b.status)) return { state: "failed", item: null, feeVnd: 0, late: false, booking: b };
  const m = await loadModel(c.ws);
  const nowMs = a.nowMs ?? Date.now();
  const late = Date.parse(b.start_at) - nowMs < m.settings.cancel_window_hours * 3_600_000;
  const fee = late && b.price_vnd ? Math.round((b.price_vnd * m.settings.late_cancel_fee_pct) / 100) : 0;
  const f = await factsOf(b, m);
  const withFee = fee > 0;
  const item = await runWork(c, {
    action: withFee ? "cancel_with_fee" : "cancel_booking", subject_type: "lead", subject_id: b.lead_id, lead_id: b.lead_id, origin: b.origin, dedupeKey: `${withFee ? "cancel_with_fee" : "cancel_booking"}:${b.id}`, preset: true, noChain: true,
    seed: {
      summary: `Hủy lịch${withFee ? ` có thu phí ${fee.toLocaleString("vi-VN")} ₫` : ""}: ${b.customer_name || "khách"} · ${f.service.name} · ${whenText(Date.parse(b.start_at), m.settings.timezone)}${late ? " (sát giờ)" : ""}`,
      amount_vnd: withFee ? fee : null, outcome: "clear",
      fields: { contact: b.customer_phone ?? b.customer_email ?? "kênh chat", booking_id: b.id, kind: "late_cancel", late: late ? "yes" : "no", reason: a.reason ?? "", service: f.service.name, ...(withFee ? { amount_vnd: fee } : {}) },
    },
  });
  return { state: item.status === "done" ? "done" : item.status === "waiting_decision" ? "waiting" : item.status === "rejected" ? "rejected" : "failed", item, feeVnd: fee, late, booking: await loadBooking(c.ws, b.id) };
};

/* ------------------------------------------------------------------ reminders */

/** The reminder offsets in force: the owner's customised card when it is on, else the module policy (24 h and 2 h). */
export const reminderHoursFor = async (ws: string, s: BookingSettings): Promise<{ hours: ReadonlyArray<number>; body: string | null }> => {
  const { data } = await adm().from("automation_pipelines").select("config, body, enabled").eq("workspace_id", ws).eq("template_key", "appointment_reminder").eq("enabled", true).maybeSingle();
  const p = data as { config: Record<string, unknown> | null; body: string | null } | null;
  if (!p) return { hours: s.reminder_hours, body: null };
  const hs = [Number(p.config?.firstHours), Number(p.config?.secondHours)].filter((n) => Number.isFinite(n) && n > 0);
  return { hours: hs.length ? hs : s.reminder_hours, body: p.body?.trim() || null };
};

/** One reminder row per offset that is still in the future; re-run after a reschedule (rows are reset to the new time). */
export const scheduleReminders = async (b: BookingRow, nowMs = Date.now()): Promise<Array<{ kind: string; due_at: string }>> => {
  const s = await loadSettings(b.workspace_id);
  const { hours } = await reminderHoursFor(b.workspace_id, s);
  const out: Array<{ kind: string; due_at: string }> = [];
  const start = Date.parse(b.start_at);
  const db = adm();
  for (const h of [...new Set(hours)]) {
    const due = start - h * 3_600_000;
    if (due <= nowMs) continue;
    const row = { workspace_id: b.workspace_id, booking_id: b.id, kind: `h${h}`, due_at: new Date(due).toISOString(), status: "scheduled", work_item_id: null, sent_at: null, note: "" };
    const { error } = await db.from("booking_reminders").upsert(row, { onConflict: "booking_id,kind" });
    if (error) throw new Error(error.message);
    out.push({ kind: row.kind, due_at: row.due_at });
  }
  // an offset that was scheduled before but no longer applies (booking moved closer): cancel it
  await db.from("booking_reminders").update({ status: "cancelled", note: "Đã quá giờ nhắc sau khi đổi lịch" }).eq("booking_id", b.id).eq("status", "scheduled").lte("due_at", new Date(nowMs).toISOString());
  return out;
};

export const cancelReminders = async (bookingId: string, note: string): Promise<void> => {
  await adm().from("booking_reminders").update({ status: "cancelled", note }).eq("booking_id", bookingId).in("status", ["scheduled", "waiting"]);
};

/* ------------------------------------------------------------------ owner actions (the owner is the authority: no gate for the record itself) */

const patch = async (ws: string, id: string, p: Record<string, unknown>): Promise<BookingRow> => {
  const { data, error } = await adm().from("bookings").update({ ...p, updated_at: new Date().toISOString() }).eq("workspace_id", ws).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as BookingRow;
};

/** Move a booking now (drag in the calendar): refuses when the new place is taken unless `force`. */
export const moveNow = async (ws: string, id: string, startMs: number, resourceId: string, force = false): Promise<{ ok: boolean; reason?: string; booking?: BookingRow }> => {
  const b = await loadBooking(ws, id);
  if (!b || !ACTIVE.includes(b.status)) return { ok: false, reason: "Lịch này không còn đổi được." };
  const m = await loadModel(ws);
  const svc = m.services.find((s) => s.id === b.service_id) as ServiceRow;
  const endMs = startMs + svc.duration_min * 60_000;
  const r = await adm().rpc("booking_relocate", { p_booking: id, p_resource: resourceId, p_start: new Date(startMs).toISOString(), p_end: new Date(endMs).toISOString(), p_block_end: new Date(endMs + svc.buffer_min * 60_000).toISOString(), p_force: force });
  if (r.error) return { ok: false, reason: r.error.message };
  if (r.data !== true) return { ok: false, reason: "Chỗ này đã có lịch khác." };
  const moved = (await loadBooking(ws, id)) as BookingRow;
  if (ACTIVE.includes(moved.status)) await scheduleReminders(moved);
  return { ok: true, booking: moved };
};

export const confirmNow = async (ws: string, id: string): Promise<BookingRow> => {
  const b = await loadBooking(ws, id);
  if (!b) throw new Error("Không tìm thấy lịch hẹn.");
  if (b.status !== "requested") return b;
  const next = await patch(ws, id, { status: "confirmed", holds_slot: true });
  await scheduleReminders(next);
  return next;
};

export const checkInNow = async (ws: string, id: string): Promise<BookingRow> => patch(ws, id, { checked_in_at: new Date().toISOString(), status: "confirmed" });

/** Finished: reminders stop; with a price and the "hand-off" policy on, the sales order chain starts (confirm_order, then the invoice). */
export const doneNow = async (c: EngineCtx, id: string): Promise<BookingRow> => {
  const b = await loadBooking(c.ws, id);
  if (!b) throw new Error("Không tìm thấy lịch hẹn.");
  const done = await patch(c.ws, id, { status: "done", done_at: new Date().toISOString(), checked_in_at: b.checked_in_at ?? new Date().toISOString() });
  await cancelReminders(id, "Buổi hẹn đã xong");
  const m = await loadModel(c.ws);
  const svc = m.services.find((s) => s.id === b.service_id);
  await logEvidence(adm(), c.ws, { lead_id: b.lead_id, kind: "booking.done", actor: c.actor, summary: `Xong lịch hẹn: ${svc?.name ?? ""} · ${b.customer_name}` });
  if (m.settings.handoff_order && b.price_vnd && b.price_vnd > 0 && svc) {
    const { event, duplicate } = await ingest(adm(), c.ws, {
      channel: "manual", kind: "order", origin: b.origin, sender_name: b.customer_name, sender_contact: b.customer_phone ?? b.customer_email, body: `Dịch vụ ${svc.name}`, amount_vnd: b.price_vnd,
      external_ref: b.id, event_id: `booking:${b.id}:order`,
    }, (n) => `Đơn từ lịch hẹn đã được ghi ${n} lần`);
    if (!duplicate) await startOrderWork(c, event, { items: svc.name, amount_vnd: b.price_vnd, lead_id: b.lead_id });
  }
  return done;
};

/** Customer did not come: the booking closes and, when the policy has a no-show fee, the fee waits as a decision (cancel_with_fee always asks). */
export const noShowNow = async (c: EngineCtx, id: string): Promise<{ booking: BookingRow; item: WorkItem | null }> => {
  const b = await loadBooking(c.ws, id);
  if (!b) throw new Error("Không tìm thấy lịch hẹn.");
  const m = await loadModel(c.ws);
  const next = await patch(c.ws, id, { status: "no_show" });
  await cancelReminders(id, "Khách không đến");
  await logEvidence(adm(), c.ws, { lead_id: b.lead_id, kind: "booking.no_show", actor: c.actor, summary: `Khách không đến: ${b.customer_name}` });
  if (m.settings.no_show_fee_vnd <= 0) return { booking: next, item: null };
  const f = await factsOf(b, m);
  const item = await runWork(c, {
    action: "cancel_with_fee", subject_type: "lead", subject_id: b.lead_id, lead_id: b.lead_id, origin: b.origin, dedupeKey: `cancel_with_fee:noshow:${b.id}`, preset: true, noChain: true,
    seed: { summary: `Phí không đến ${m.settings.no_show_fee_vnd.toLocaleString("vi-VN")} ₫: ${b.customer_name} · ${f.service.name} · ${whenText(Date.parse(b.start_at), m.settings.timezone)}`, amount_vnd: m.settings.no_show_fee_vnd, outcome: "clear",
      fields: { contact: b.customer_phone ?? b.customer_email ?? "kênh chat", booking_id: b.id, kind: "no_show", amount_vnd: m.settings.no_show_fee_vnd, service: f.service.name } },
  });
  return { booking: next, item };
};

/** Owner adds a booking by hand: held and confirmed immediately (the owner decides), reminders scheduled. A taken slot is refused unless `force`. */
export const addManual = async (c: EngineCtx, a: BookingAsk & { readonly force?: boolean; readonly resourceId: string }): Promise<{ ok: boolean; reason?: string; booking?: BookingRow }> => {
  const m = await loadModel(c.ws);
  const svc = m.services.find((s) => s.id === a.serviceId);
  if (!svc) return { ok: false, reason: "Chưa chọn dịch vụ." };
  const lead = await ensureLead(c.ws, { ...a.customer, channelLabel: "Nhập tay", need: `Đặt lịch: ${svc.name}` });
  const endMs = a.startMs + svc.duration_min * 60_000;
  const deposit = svc.price_vnd && m.settings.deposit_pct > 0 ? Math.round((svc.price_vnd * m.settings.deposit_pct) / 100) : 0;
  const r = await adm().rpc("booking_reserve", {
    p: {
      workspace_id: c.ws, lead_id: lead?.id ?? "", customer_name: a.customer.name, customer_phone: normaliseContact(a.customer.phone ?? null) ?? "", customer_email: a.customer.email ?? "", service_id: svc.id, resource_id: a.resourceId,
      start_at: new Date(a.startMs).toISOString(), end_at: new Date(endMs).toISOString(), block_end_at: new Date(endMs + svc.buffer_min * 60_000).toISOString(), party_size: a.partySize ?? 1, status: "confirmed",
      source_channel: a.channel, price_vnd: svc.price_vnd ?? "", deposit_vnd: deposit, deposit_status: deposit > 0 ? "due" : "none", note: a.note ?? "",
    }, p_force: a.force ?? false,
  });
  if (r.error) return { ok: false, reason: r.error.message };
  if (!r.data) return { ok: false, reason: "Chỗ này đã có lịch khác (chọn giờ hoặc người khác)." };
  const booking = (await loadBooking(c.ws, r.data as string)) as BookingRow;
  await scheduleReminders(booking);
  await logEvidence(adm(), c.ws, { lead_id: booking.lead_id, kind: "booking.created", actor: c.actor, summary: `Thêm lịch hẹn: ${a.customer.name} · ${svc.name} · ${whenText(a.startMs, m.settings.timezone)}` });
  return { ok: true, booking };
};

/* ------------------------------------------------------------------ waitlist */

export const joinWaitlist = async (ws: string, w: { serviceId: string; windowStartMs: number; windowEndMs: number; customer: Customer; conversationId?: string | null; partySize?: number; note?: string }): Promise<string> => {
  const lead = await ensureLead(ws, { ...w.customer, conversationId: w.conversationId, channelLabel: "Danh sách chờ", need: "Chờ lịch hẹn" });
  const ins = await adm().from("booking_waitlist").insert({
    workspace_id: ws, lead_id: lead?.id ?? null, conversation_id: w.conversationId ?? null, customer_name: w.customer.name, customer_phone: normaliseContact(w.customer.phone ?? null), service_id: w.serviceId,
    window_start: new Date(w.windowStartMs).toISOString(), window_end: new Date(w.windowEndMs).toISOString(), party_size: w.partySize ?? 1, note: w.note ?? "",
  }).select("id").single();
  if (ins.error) throw new Error(ins.error.message);
  return (ins.data as { id: string }).id;
};

/* ------------------------------------------------------------------ the dynamic line OpenClaw gets every turn (today, services, hours) */

/** What the booking agent must know right now: today's date in the business's zone, the services it may book and the opening hours. Plain text for the system prompt. */
export const bookingContextLine = async (ws: string): Promise<string> => {
  const m = await loadModel(ws);
  if (!m.services.length) return "";
  const tz = m.settings.timezone;
  const now = Date.now();
  const today = localDate(now, tz);
  const DAYS = ["", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];
  const [y, mo, d] = today.split("-");
  const wd = (() => { const x = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay(); return x === 0 ? 7 : x; })();
  const dayHours = new Map<number, Set<string>>();
  for (const h of m.hours) {
    const set = dayHours.get(h.weekday) ?? new Set<string>();
    set.add(`${h.start}-${h.end}`);
    dayHours.set(h.weekday, set);
  }
  const hoursLine = [1, 2, 3, 4, 5, 6, 7].map((w) => `${DAYS[w]}: ${dayHours.get(w) ? [...(dayHours.get(w) as Set<string>)].sort().join(", ") : "nghỉ"}`).join("; ");
  return `\n\n[BOOKING DATA]\nHôm nay là ${DAYS[wd]} ${d}/${mo}/${y} (múi giờ ${tz}), bây giờ ${localTime(now, tz)}. Mọi ngày giờ trong booking_request tính theo múi giờ này.\nDịch vụ nhận đặt (dùng đúng tên): ${m.services.filter((s) => s.active).map((s) => `${s.name} (${s.duration_min} phút${s.price_vnd ? `, ${s.price_vnd.toLocaleString("vi-VN")} ₫` : ""})`).join("; ")}.\nGiờ làm việc: ${hoursLine}.\nChính sách: đổi/hủy miễn phí trước ${m.settings.cancel_window_hours} giờ; đặt trước tối thiểu ${m.settings.min_lead_min} phút.`;
};
const localTime = (ms: number, tz: string): string => new Intl.DateTimeFormat("vi-VN", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));

/* ------------------------------------------------------------------ customer messages built with facts (used by the chat hook and the public page) */

export const confirmMessage = async (b: BookingRow): Promise<string> => confirmText(bookingFacts(await factsOf(b)));
export const holdMessage = async (b: BookingRow): Promise<string> => holdText(bookingFacts(await factsOf(b)));
export const offerMessage = async (ws: string, service: ServiceRow, slots: ReadonlyArray<Slot>, wantedMs?: number): Promise<string> => {
  const s = await loadSettings(ws);
  return offerText(await shopName(ws), service.name, slots.map((x) => x.startMs), s.timezone, wantedMs);
};
