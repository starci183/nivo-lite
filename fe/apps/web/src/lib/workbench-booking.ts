import "server-only";
import { addDays, localDate, utilisation, zonedMs } from "./module-booking-availability";
import { loadModel, type BookingRow } from "./module-booking";
import { supabaseAdmin } from "./supabase/admin";

/**
 * Booking workbench figures for the agent dashboard ribbon. They are about fixed windows (today, 30 days, this week) and do not move when the
 * calendar below is paged to another week. Times follow the workspace timezone.
 *
 *   bookingsToday    bookings starting today that are not cancelled.
 *   noShowPct30d     no_show over (done + no_show) among bookings that started in the last 30 days; null when none has finished yet.
 *   utilisationPct   booked time over open time this week (Monday to Sunday) across active resources, weighted by each resource's open hours;
 *                    booked time counts confirmed, rescheduled and done bookings times their party size (the same rule as the Stats tab).
 *                    Null when no resource has open hours.
 *   depositsPending  bookings that are not cancelled, done or no-show whose deposit is still due (deposit_status "due"), with their total.
 *
 * With `installationId` (one Booking agent per branch) every figure counts that instance's bookings only (bookings.installation_id).
 */
export type BookingFigures = {
  readonly bookingsToday: number;
  readonly noShowPct30d: number | null;
  readonly finished30d: number;
  readonly utilisationPct: number | null;
  readonly depositsPending: number;
  readonly depositsPendingVnd: number;
};

type Row = Pick<BookingRow, "start_at" | "end_at" | "status" | "party_size" | "resource_id">;

export const loadBookingFigures = async (ws: string, installationId: string | null = null): Promise<BookingFigures> => {
  const db = supabaseAdmin();
  const model = await loadModel(ws);
  const tz = model.settings.timezone;
  const nowMs = Date.now();
  const today = localDate(nowMs, tz);
  const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const sunday = addDays(monday, 6);
  const dayStart = zonedMs(today, "00:00", tz);
  const dayEnd = zonedMs(addDays(today, 1), "00:00", tz);
  const weekStart = zonedMs(monday, "00:00", tz);
  const weekEnd = zonedMs(addDays(sunday, 1), "00:00", tz);
  const since30 = nowMs - 30 * 86_400_000;
  const iso = (ms: number) => new Date(ms).toISOString();

  // One instance's bookings when an installation is given; otherwise every booking of the workspace.
  let weekQ = db.from("bookings").select("start_at, end_at, status, party_size, resource_id").eq("workspace_id", ws).gte("start_at", iso(weekStart)).lt("start_at", iso(weekEnd));
  let pastQ = db.from("bookings").select("status").eq("workspace_id", ws).in("status", ["done", "no_show"]).gte("start_at", iso(since30)).lt("start_at", iso(nowMs));
  let depositQ = db.from("bookings").select("deposit_vnd").eq("workspace_id", ws).eq("deposit_status", "due").in("status", ["requested", "confirmed", "rescheduled"]);
  if (installationId) {
    weekQ = weekQ.eq("installation_id", installationId);
    pastQ = pastQ.eq("installation_id", installationId);
    depositQ = depositQ.eq("installation_id", installationId);
  }
  const [week, past, deposits] = await Promise.all([weekQ.limit(5000), pastQ.limit(5000), depositQ.limit(5000)]);
  if (week.error) throw new Error(week.error.message);
  if (past.error) throw new Error(past.error.message);
  if (deposits.error) throw new Error(deposits.error.message);

  const weekRows = (week.data ?? []) as Array<Row>;
  const bookingsToday = weekRows.filter((b) => b.status !== "cancelled" && Date.parse(b.start_at) >= dayStart && Date.parse(b.start_at) < dayEnd).length;

  const booked = new Map<string, number>();
  for (const b of weekRows) {
    if (["confirmed", "rescheduled", "done"].includes(b.status)) booked.set(b.resource_id, (booked.get(b.resource_id) ?? 0) + ((Date.parse(b.end_at) - Date.parse(b.start_at)) / 60_000) * b.party_size);
  }
  const perResource = utilisation(model.resources, model.hours, model.exceptions, booked, monday, sunday, tz);
  const open = perResource.reduce((n, r) => n + r.openMin, 0);
  const utilisationPct = open > 0 ? Math.round(perResource.reduce((n, r) => n + r.pct * r.openMin, 0) / open) : null;

  const finished = (past.data ?? []) as Array<{ status: string }>;
  const noShows = finished.filter((b) => b.status === "no_show").length;
  const dueRows = (deposits.data ?? []) as Array<{ deposit_vnd: number | string }>;

  return {
    bookingsToday,
    noShowPct30d: finished.length > 0 ? Math.round((noShows / finished.length) * 100) : null,
    finished30d: finished.length,
    utilisationPct,
    depositsPending: dueRows.length,
    depositsPendingVnd: dueRows.reduce((n, r) => n + Number(r.deposit_vnd || 0), 0),
  };
};
