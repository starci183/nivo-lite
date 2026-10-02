import "server-only";
import { runWork, type EngineCtx } from "./engine";
import { ACTIVE, loadBooking, reminderHoursFor, loadSettings, type BookingRow } from "./module-booking";
import { reminderBody } from "./module-booking-performers";
import { whenText } from "./module-booking-copy";
import { supabaseAdmin } from "./supabase/admin";

/**
 * The minute tick of the booking module (called by runTick in automation-engine.ts, which pg_cron triggers every minute).
 * It turns due booking_reminders rows into remind_booking work items: the gate decides (the default is auto: the reminder leaves by itself on the
 * conversation's channel, or by email when SMTP is set), and the row records what happened. It never talks to a customer directly.
 */
type ReminderRow = { id: string; workspace_id: string; booking_id: string; kind: string; due_at: string };

const BATCH = 40;

export const runBookingTick = async (nowMs = Date.now()): Promise<{ readonly reminders: number; readonly skipped: number }> => {
  const db = supabaseAdmin();
  const { data } = await db.from("booking_reminders").select("id, workspace_id, booking_id, kind, due_at").eq("status", "scheduled").lte("due_at", new Date(nowMs).toISOString()).order("due_at").limit(BATCH);
  let sent = 0;
  let skipped = 0;
  for (const r of (data ?? []) as Array<ReminderRow>) {
    // Claim the row first (guarded transition): two ticks never remind twice.
    const claim = await db.from("booking_reminders").update({ status: "waiting", note: "Đang gửi" }).eq("id", r.id).eq("status", "scheduled").select("id");
    if (!claim.data?.length) continue;
    try {
      const b = await loadBooking(r.workspace_id, r.booking_id);
      const stale = !b || !ACTIVE.includes(b.status) || !b.holds_slot || Date.parse(b.start_at) <= nowMs;
      if (stale) {
        await db.from("booking_reminders").update({ status: "skipped", note: "Lịch đã đóng hoặc đã qua giờ" }).eq("id", r.id);
        skipped += 1;
        continue;
      }
      await remindOne(r, b as BookingRow, nowMs);
      sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("booking reminder failed:", msg);
      await db.from("booking_reminders").update({ status: "failed", note: msg.slice(0, 300) }).eq("id", r.id);
    }
  }
  return { reminders: sent, skipped };
};

const remindOne = async (r: ReminderRow, b: BookingRow, nowMs: number): Promise<void> => {
  const db = supabaseAdmin();
  const s = await loadSettings(b.workspace_id);
  const { body } = await reminderHoursFor(b.workspace_id, s);
  const hours = Number(r.kind.slice(1)) || 0;
  const text = await reminderBody(b, hours, body);
  const c: EngineCtx = { db, ws: b.workspace_id, actor: "NIVO · Nhắc lịch hẹn", locale: "vi" };
  const item = await runWork(c, {
    action: "remind_booking", subject_type: "lead", subject_id: b.lead_id, lead_id: b.lead_id, origin: b.origin, dedupeKey: `remind_booking:${b.id}:${r.kind}:${Date.parse(r.due_at)}`, preset: true, noChain: true,
    seed: { summary: `Nhắc lịch ${b.customer_name || "khách"} (${hours} giờ trước) · ${whenText(Date.parse(b.start_at), s.timezone)}`, draft: text, outcome: "clear", fields: { booking_id: b.id, kind: r.kind, contact: b.customer_phone ?? b.customer_email ?? "kênh chat" } },
  });
  const status = item.status === "done" ? "sent" : item.status === "waiting_decision" ? "waiting" : item.status === "rejected" ? "skipped" : "failed";
  await db.from("booking_reminders").update({ status, work_item_id: item.id, sent_at: status === "sent" ? new Date(nowMs).toISOString() : null, note: item.result?.summary ?? item.error ?? "" }).eq("id", r.id);
};
