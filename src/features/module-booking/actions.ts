"use server";

import { revalidatePath } from "next/cache";
import { logEvidence } from "@/lib/core";
import { runWork, type EngineCtx } from "@/lib/engine";
import { checkSlot, zonedMs } from "@/lib/module-booking-availability";
import {
  ACTIVE, addManual, cancelReminders, checkInNow, confirmNow, doneNow, factsOf, loadBooking, loadModel, loadTaken, moveNow, noShowNow, policyOf, specOf, bookingFacts, type BookingRow,
} from "@/lib/module-booking";
import { cancelText, rescheduleText, whenText } from "@/lib/module-booking-copy";
import { loadWorkbenchData, type WorkbenchData } from "@/lib/module-booking-view";
import { requireManager } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Outcome } from "@/lib/types";

/* Booking workbench commands. The owner/manager is the authority for what they click; whatever reaches a customer still goes through the gate (reply_customer). */

const ctxOf = async (): Promise<EngineCtx & { name: string }> => {
  const member = await requireManager();
  const session = await getSession();
  return { db: supabaseAdmin(), ws: session.workspace.id, actor: member.displayName, locale: "vi", name: member.displayName };
};

const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};
const refresh = () => revalidatePath("/", "layout");
const num = (v: unknown, d = 0): number => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Tell the customer what the owner just did, through the gate (the owner's rule for reply_customer decides: auto sends it, ask leaves a decision). */
const tellCustomer = async (c: EngineCtx, b: BookingRow, body: string, dedupe: string, summary: string): Promise<void> => {
  const conv = b.conversation_id ?? ((await c.db.from("agent_conversations").select("id").eq("workspace_id", c.ws).eq("lead_id", b.lead_id ?? "").eq("kind", "customer").order("created_at", { ascending: false }).limit(1)).data ?? [])[0]?.id;
  if (!conv) return;
  await runWork(c, {
    action: "reply_customer", subject_type: "conversation", subject_id: conv as string, lead_id: b.lead_id, origin: b.origin, dedupeKey: `reply_customer:booking:${dedupe}`, preset: true, noChain: true,
    seed: { summary, draft: body, outcome: "clear", fields: { conversation_id: conv as string, question: "" } },
  });
};

export async function loadRange(from: string, to: string): Promise<Outcome<WorkbenchData>> {
  return run(async () => {
    const c = await ctxOf();
    return loadWorkbenchData(c.ws, from, to);
  });
}

export type AddInput = { readonly name: string; readonly phone: string; readonly serviceId: string; readonly resourceId: string; readonly date: string; readonly time: string; readonly party: number; readonly note: string; readonly force: boolean };

/** "Thêm lịch hẹn": the owner adds one by hand. An empty resource means "pick a free one". A taken slot is refused unless the owner insists (force). */
export async function addBookingAction(i: AddInput): Promise<Outcome<{ ok: boolean; reason?: string; id?: string }>> {
  return run(async () => {
    const c = await ctxOf();
    const m = await loadModel(c.ws);
    const svc = m.services.find((s) => s.id === i.serviceId);
    if (!svc) return { ok: false, reason: "Chọn dịch vụ trước." };
    if (!i.name.trim()) return { ok: false, reason: "Nhập tên khách." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date) || !/^\d{2}:\d{2}$/.test(i.time)) return { ok: false, reason: "Chọn ngày và giờ." };
    const tz = m.settings.timezone;
    const startMs = zonedMs(i.date, i.time, tz);
    let resourceId = i.resourceId;
    if (!resourceId) {
      const taken = await loadTaken(c.ws, startMs - 86_400_000, startMs + 2 * 86_400_000);
      const r = checkSlot({ service: specOf(svc), resources: m.resources, hours: m.hours, exceptions: m.exceptions, taken, policy: { ...policyOf(m.settings), minLeadMin: 0, maxAdvanceDays: 365 }, nowMs: Date.now(), startMs, partySize: i.party });
      if (r.ok) resourceId = r.slot.resourceId;
      else if (!i.force) return { ok: false, reason: ({ closed: "Giờ này cơ sở đóng cửa hoặc ngoài giờ làm việc.", full: "Giờ này đã kín. Chọn giờ khác hoặc người khác.", no_resource: "Chưa có người hoặc phòng phù hợp dịch vụ này." } as Record<string, string>)[r.why] ?? "Giờ này không xếp được." };
      else resourceId = m.resources.find((x) => x.active && (!svc.resource_kind || x.kind === svc.resource_kind))?.id ?? "";
    }
    if (!resourceId) return { ok: false, reason: "Chưa có người hoặc phòng phù hợp dịch vụ này." };
    const r = await addManual(c, { serviceId: i.serviceId, startMs, partySize: i.party, resourceId, customer: { name: i.name.trim(), phone: i.phone.trim() || null }, channel: "manual", note: i.note, force: i.force });
    refresh();
    return { ok: r.ok, reason: r.reason, id: r.booking?.id };
  });
}

/** Drag in the calendar: move a booking to another time or column. Refuses a taken place (the card snaps back) unless force. */
export async function moveBookingAction(id: string, startMs: number, resourceId: string, force = false): Promise<Outcome<{ ok: boolean; reason?: string }>> {
  return run(async () => {
    const c = await ctxOf();
    const before = await loadBooking(c.ws, id);
    const r = await moveNow(c.ws, id, startMs, resourceId, force);
    if (r.ok && r.booking && before && before.start_at !== r.booking.start_at) {
      const f = await factsOf(r.booking);
      await logEvidence(c.db, c.ws, { lead_id: r.booking.lead_id, kind: "booking.moved", actor: c.actor, summary: `Dời lịch ${f.service.name} của ${r.booking.customer_name}: ${whenText(Date.parse(before.start_at), f.settings.timezone)} → ${whenText(startMs, f.settings.timezone)}` });
      await tellCustomer(c, r.booking, rescheduleText(bookingFacts(f), Date.parse(before.start_at)), `move:${id}:${startMs}`, `Báo khách đã đổi lịch ${f.service.name}`);
    }
    refresh();
    return { ok: r.ok, reason: r.reason };
  });
}

export type StatusAction = "confirm" | "checkin" | "done" | "no_show" | "cancel";

export async function bookingStatusAction(id: string, action: StatusAction): Promise<Outcome<{ message: string }>> {
  return run(async () => {
    const c = await ctxOf();
    const b = await loadBooking(c.ws, id);
    if (!b) throw new Error("Không tìm thấy lịch hẹn.");
    let message = "Đã cập nhật.";
    if (action === "confirm") {
      const next = await confirmNow(c.ws, id);
      const f = await factsOf(next);
      await tellCustomer(c, next, `Chào ${next.customer_name || "bạn"}, ${f.shop} đã xác nhận lịch ${f.service.name} lúc ${whenText(f.startMs, f.settings.timezone)}.`, `confirm:${id}`, `Báo khách đã xác nhận lịch ${f.service.name}`);
      message = "Đã xác nhận lịch hẹn.";
    } else if (action === "checkin") {
      await checkInNow(c.ws, id);
      message = "Đã check-in.";
    } else if (action === "done") {
      await doneNow(c, id);
      message = "Đã đánh dấu xong.";
    } else if (action === "no_show") {
      const r = await noShowNow(c, id);
      message = r.item ? "Đã ghi khách không đến. Phí không đến đang chờ bạn quyết trong Văn phòng." : "Đã ghi khách không đến.";
    } else if (ACTIVE.includes(b.status)) {
      const { error } = await c.db.from("bookings").update({ status: "cancelled", holds_slot: false, cancelled_at: new Date().toISOString(), cancel_reason: "Chủ hủy", updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", c.ws);
      if (error) throw new Error(error.message);
      await cancelReminders(id, "Chủ đã hủy lịch");
      const f = await factsOf(b);
      await logEvidence(c.db, c.ws, { lead_id: b.lead_id, kind: "booking.cancelled", actor: c.actor, summary: `Chủ hủy lịch ${f.service.name} của ${b.customer_name}` });
      await tellCustomer(c, b, cancelText(bookingFacts(f), 0), `cancel:${id}`, `Báo khách đã hủy lịch ${f.service.name}`);
      message = "Đã hủy lịch hẹn.";
    }
    refresh();
    return { message };
  });
}

/* ------------------------------------------------------------------ setup */

const db = () => supabaseAdmin();

export async function saveSettingsAction(f: { cancelWindowHours: number; depositPct: number; lateCancelFeePct: number; noShowFeeVnd: number; minLeadMin: number; maxAdvanceDays: number; slotStepMin: number; autoConfirm: boolean; handoffOrder: boolean; address: string; timezone: string }): Promise<Outcome<true>> {
  return run(async () => {
    const c = await ctxOf();
    const row = {
      workspace_id: c.ws, cancel_window_hours: Math.max(0, Math.round(f.cancelWindowHours)), deposit_pct: Math.min(100, Math.max(0, Math.round(f.depositPct))), late_cancel_fee_pct: Math.min(100, Math.max(0, Math.round(f.lateCancelFeePct))),
      no_show_fee_vnd: Math.max(0, Math.round(f.noShowFeeVnd)), min_lead_min: Math.max(0, Math.round(f.minLeadMin)), max_advance_days: Math.min(365, Math.max(1, Math.round(f.maxAdvanceDays))),
      slot_step_min: Math.min(240, Math.max(5, Math.round(f.slotStepMin))), auto_confirm: f.autoConfirm, handoff_order: f.handoffOrder, address: f.address.trim().slice(0, 300), timezone: f.timezone.trim() || "Asia/Ho_Chi_Minh", updated_at: new Date().toISOString(),
    };
    const { error } = await db().from("booking_settings").upsert(row, { onConflict: "workspace_id" });
    if (error) throw new Error(error.message);
    refresh();
    return true as const;
  });
}

export async function savePublicPageAction(f: { enabled: boolean; slug: string; note: string }): Promise<Outcome<true>> {
  return run(async () => {
    const c = await ctxOf();
    const slug = f.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (f.enabled && !/^[a-z0-9][a-z0-9-]{2,40}$/.test(slug)) throw new Error("Địa chỉ trang đặt lịch cần 3-40 ký tự: chữ thường không dấu, số và dấu gạch ngang.");
    const { error } = await db().from("booking_settings").upsert({ workspace_id: c.ws, public_enabled: f.enabled, public_slug: slug || null, public_note: f.note.trim().slice(0, 400), updated_at: new Date().toISOString() }, { onConflict: "workspace_id" });
    if (error) throw new Error(error.code === "23505" ? "Địa chỉ này đã có người dùng, chọn tên khác." : error.message);
    refresh();
    return true as const;
  });
}

export type ServiceInput = { readonly id?: string; readonly name: string; readonly durationMin: number; readonly bufferMin: number; readonly priceVnd: number | null; readonly resourceKind: string; readonly followupDays: number | null; readonly active: boolean; readonly description: string };

export async function saveServiceAction(s: ServiceInput): Promise<Outcome<true>> {
  return run(async () => {
    const c = await ctxOf();
    if (!s.name.trim()) throw new Error("Nhập tên dịch vụ.");
    const row = {
      workspace_id: c.ws, name: s.name.trim().slice(0, 160), description: s.description.trim().slice(0, 600), duration_min: Math.min(1440, Math.max(5, Math.round(num(s.durationMin, 30)))), buffer_min: Math.min(480, Math.max(0, Math.round(num(s.bufferMin)))),
      price_vnd: s.priceVnd === null ? null : Math.max(0, Math.round(s.priceVnd)), resource_kind: s.resourceKind.trim() || null, followup_days: s.followupDays ? Math.min(730, Math.max(1, Math.round(s.followupDays))) : null, active: s.active,
    };
    const r = s.id ? await db().from("booking_services").update(row).eq("id", s.id).eq("workspace_id", c.ws) : await db().from("booking_services").insert(row);
    if (r.error) throw new Error(r.error.message);
    refresh();
    return true as const;
  });
}

export async function deleteServiceAction(id: string): Promise<Outcome<true>> {
  return run(async () => {
    const c = await ctxOf();
    const used = await db().from("bookings").select("id", { count: "exact", head: true }).eq("workspace_id", c.ws).eq("service_id", id);
    if ((used.count ?? 0) > 0) {
      await db().from("booking_services").update({ active: false }).eq("id", id).eq("workspace_id", c.ws);
    } else {
      const { error } = await db().from("booking_services").delete().eq("id", id).eq("workspace_id", c.ws);
      if (error) throw new Error(error.message);
    }
    refresh();
    return true as const;
  });
}

export type ResourceInput = { readonly id?: string; readonly name: string; readonly kind: string; readonly capacity: number; readonly color: string; readonly active: boolean };

export async function saveResourceAction(r: ResourceInput): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    const c = await ctxOf();
    if (!r.name.trim()) throw new Error("Nhập tên.");
    const row = { workspace_id: c.ws, name: r.name.trim().slice(0, 120), kind: r.kind.trim().slice(0, 40) || "staff", capacity: Math.min(200, Math.max(1, Math.round(num(r.capacity, 1)))), color: r.color, active: r.active };
    if (r.id) {
      const { error } = await db().from("booking_resources").update(row).eq("id", r.id).eq("workspace_id", c.ws);
      if (error) throw new Error(error.message);
      refresh();
      return { id: r.id };
    }
    const { data, error } = await db().from("booking_resources").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    // a new resource starts with Monday to Saturday 09:00-18:00 so it can take bookings right away; the owner edits it next
    await db().from("booking_hours").insert([1, 2, 3, 4, 5, 6].map((weekday) => ({ workspace_id: c.ws, resource_id: (data as { id: string }).id, weekday, start_time: "09:00", end_time: "18:00" })));
    refresh();
    return { id: (data as { id: string }).id };
  });
}

export async function deleteResourceAction(id: string): Promise<Outcome<true>> {
  return run(async () => {
    const c = await ctxOf();
    const used = await db().from("bookings").select("id", { count: "exact", head: true }).eq("workspace_id", c.ws).eq("resource_id", id);
    if ((used.count ?? 0) > 0) await db().from("booking_resources").update({ active: false }).eq("id", id).eq("workspace_id", c.ws);
    else {
      const { error } = await db().from("booking_resources").delete().eq("id", id).eq("workspace_id", c.ws);
      if (error) throw new Error(error.message);
    }
    refresh();
    return true as const;
  });
}

/** Replace a resource's weekly hours: rows of { weekday 1-7, start "HH:MM", end "HH:MM" }. */
export async function saveHoursAction(resourceId: string, rows: ReadonlyArray<{ weekday: number; start: string; end: string }>): Promise<Outcome<true>> {
  return run(async () => {
    const c = await ctxOf();
    for (const r of rows) if (!(r.weekday >= 1 && r.weekday <= 7) || !/^\d{2}:\d{2}$/.test(r.start) || !/^\d{2}:\d{2}$/.test(r.end) || r.end <= r.start) throw new Error("Giờ làm việc chưa đúng: giờ kết thúc phải sau giờ bắt đầu.");
    const own = await db().from("booking_resources").select("id").eq("id", resourceId).eq("workspace_id", c.ws).maybeSingle();
    if (!own.data) throw new Error("Không tìm thấy nguồn lực.");
    await db().from("booking_hours").delete().eq("resource_id", resourceId).eq("workspace_id", c.ws);
    if (rows.length) {
      const { error } = await db().from("booking_hours").insert(rows.map((r) => ({ workspace_id: c.ws, resource_id: resourceId, weekday: r.weekday, start_time: r.start, end_time: r.end })));
      if (error) throw new Error(error.message);
    }
    refresh();
    return true as const;
  });
}

export async function addExceptionAction(e: { resourceId: string; date: string; closed: boolean; start: string; end: string; note: string }): Promise<Outcome<true>> {
  return run(async () => {
    const c = await ctxOf();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new Error("Chọn ngày.");
    if (!e.closed && (!e.start || !e.end || e.end <= e.start)) throw new Error("Nhập giờ mở và giờ đóng cho ngày này.");
    const { error } = await db().from("booking_exceptions").insert({ workspace_id: c.ws, resource_id: e.resourceId || null, on_date: e.date, closed: e.closed, start_time: e.closed ? null : e.start, end_time: e.closed ? null : e.end, note: e.note.trim().slice(0, 200) });
    if (error) throw new Error(error.message);
    refresh();
    return true as const;
  });
}

export async function deleteExceptionAction(id: string): Promise<Outcome<true>> {
  return run(async () => {
    const c = await ctxOf();
    const { error } = await db().from("booking_exceptions").delete().eq("id", id).eq("workspace_id", c.ws);
    if (error) throw new Error(error.message);
    refresh();
    return true as const;
  });
}

export async function cancelWaitAction(id: string): Promise<Outcome<true>> {
  return run(async () => {
    const c = await ctxOf();
    await db().from("booking_waitlist").update({ status: "cancelled" }).eq("id", id).eq("workspace_id", c.ws);
    refresh();
    return true as const;
  });
}
