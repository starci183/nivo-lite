import "server-only";
import { addDays, localDate, utilisation, zonedMs } from "./module-booking-availability";
import { loadModel, type BookingRow, type Model } from "./module-booking";
import { supabaseAdmin } from "./supabase/admin";

/** What the booking workbench shows: plain serializable data for one date range (the client asks for another range through an action). */
export type BookingView = {
  readonly id: string; readonly customer: string; readonly phone: string | null; readonly serviceId: string; readonly service: string; readonly resourceId: string;
  readonly startMs: number; readonly endMs: number; readonly status: BookingRow["status"]; readonly holds: boolean; readonly party: number; readonly priceVnd: number | null;
  readonly depositVnd: number; readonly depositStatus: string; readonly feeVnd: number; readonly checkedIn: boolean; readonly note: string; readonly conflictNote: string; readonly source: string; readonly leadId: string | null; readonly reschedules: number;
};
export type WaitView = { readonly id: string; readonly customer: string; readonly phone: string | null; readonly service: string; readonly fromMs: number; readonly toMs: number; readonly party: number; readonly status: string; readonly createdAt: string };
export type StatView = { readonly resourceId: string; readonly name: string; readonly openMin: number; readonly bookedMin: number; readonly pct: number };
export type WorkbenchData = {
  readonly tz: string; readonly today: string; readonly nowMs: number; readonly from: string; readonly to: string;
  readonly model: Pick<Model, "settings" | "services" | "resources" | "hours" | "exceptions">;
  readonly bookings: ReadonlyArray<BookingView>;
  readonly waitlist: ReadonlyArray<WaitView>;
  readonly stats: { readonly byResource: ReadonlyArray<StatView>; readonly byStatus: Readonly<Record<string, number>>; readonly noShowPct: number; readonly doneRevenueVnd: number; readonly total: number };
  readonly exceptionList: ReadonlyArray<{ readonly id: string; readonly resourceId: string | null; readonly date: string; readonly closed: boolean; readonly start: string | null; readonly end: string | null; readonly note: string }>;
  readonly staff: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly waitingDecisions: number;
};

const view = (b: BookingRow, services: Model["services"]): BookingView => ({
  id: b.id, customer: b.customer_name, phone: b.customer_phone, serviceId: b.service_id, service: services.find((s) => s.id === b.service_id)?.name ?? "", resourceId: b.resource_id,
  startMs: Date.parse(b.start_at), endMs: Date.parse(b.end_at), status: b.status, holds: b.holds_slot, party: b.party_size, priceVnd: b.price_vnd, depositVnd: b.deposit_vnd, depositStatus: b.deposit_status,
  feeVnd: b.cancel_fee_vnd, checkedIn: b.checked_in_at !== null, note: b.note, conflictNote: b.conflict_note, source: b.source_channel, leadId: b.lead_id, reschedules: b.reschedule_count,
});

export const loadWorkbenchData = async (ws: string, from?: string, to?: string): Promise<WorkbenchData> => {
  const db = supabaseAdmin();
  const model = await loadModel(ws);
  const tz = model.settings.timezone;
  const nowMs = Date.now();
  const today = localDate(nowMs, tz);
  const f = from ?? addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7)); // Monday of this week
  const t = to ?? addDays(f, 6);
  const fromMs = zonedMs(f, "00:00", tz);
  const toMs = zonedMs(addDays(t, 1), "00:00", tz);
  const [rows, wait, decisions, exc, staff] = await Promise.all([
    db.from("bookings").select("*").eq("workspace_id", ws).lt("start_at", new Date(toMs).toISOString()).gt("end_at", new Date(fromMs).toISOString()).order("start_at"),
    db.from("booking_waitlist").select("*").eq("workspace_id", ws).in("status", ["waiting", "notified"]).order("created_at", { ascending: false }).limit(100),
    db.from("work_items").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("department", "booking").eq("status", "waiting_decision"),
    db.from("booking_exceptions").select("id, resource_id, on_date, closed, start_time, end_time, note").eq("workspace_id", ws).gte("on_date", addDays(today, -1)).order("on_date").limit(100),
    db.from("staff").select("id, name").eq("workspace_id", ws).eq("active", true).order("name"),
  ]);
  const all = (rows.data ?? []) as Array<BookingRow>;
  const byStatus: Record<string, number> = {};
  const booked = new Map<string, number>();
  let revenue = 0;
  for (const b of all) {
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
    if (["confirmed", "rescheduled", "done"].includes(b.status)) booked.set(b.resource_id, (booked.get(b.resource_id) ?? 0) + ((Date.parse(b.end_at) - Date.parse(b.start_at)) / 60_000) * b.party_size);
    if (b.status === "done") revenue += b.price_vnd ?? 0;
  }
  const finished = (byStatus.done ?? 0) + (byStatus.no_show ?? 0);
  const names = new Map(model.resources.map((r) => [r.id, r.name]));
  return {
    tz, today, nowMs, from: f, to: t, model,
    bookings: all.map((b) => view(b, model.services)),
    waitlist: ((wait.data ?? []) as Array<{ id: string; customer_name: string; customer_phone: string | null; service_id: string; window_start: string; window_end: string; party_size: number; status: string; created_at: string }>)
      .map((w) => ({ id: w.id, customer: w.customer_name, phone: w.customer_phone, service: model.services.find((s) => s.id === w.service_id)?.name ?? "", fromMs: Date.parse(w.window_start), toMs: Date.parse(w.window_end), party: w.party_size, status: w.status, createdAt: w.created_at })),
    stats: {
      byResource: utilisation(model.resources, model.hours, model.exceptions, booked, f, t, tz).map((u) => ({ ...u, name: names.get(u.resourceId) ?? "" })),
      byStatus, noShowPct: finished > 0 ? Math.round(((byStatus.no_show ?? 0) / finished) * 100) : 0, doneRevenueVnd: revenue, total: all.length,
    },
    exceptionList: ((exc.data ?? []) as Array<{ id: string; resource_id: string | null; on_date: string; closed: boolean; start_time: string | null; end_time: string | null; note: string }>).map((e) => ({ id: e.id, resourceId: e.resource_id, date: e.on_date, closed: e.closed, start: e.start_time?.slice(0, 5) ?? null, end: e.end_time?.slice(0, 5) ?? null, note: e.note })),
    staff: ((staff.data ?? []) as Array<{ id: string; name: string }>),
    waitingDecisions: decisions.count ?? 0,
  };
};
