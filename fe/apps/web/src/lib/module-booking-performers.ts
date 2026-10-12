import "server-only";
import type { EngineCtx, Performer } from "./engine";
import type { Proposal, WorkItem } from "./flow-types";
import { logEvidence } from "./core";
import {
  ACTIVE, bookingFacts, cancelReminders, deliverToCustomer, factsOf, loadBooking, loadModel, loadSettings, scheduleReminders, type BookingRow,
} from "./module-booking";
import { cancelText, confirmText, reminderText, rescheduleText, whenText } from "./module-booking-copy";
import { supabaseAdmin } from "./supabase/admin";
import { fillBody } from "./automation-shared";

/**
 * What really happens once the gate lets a booking action through (by itself or after the owner approved). These are the only places that touch a customer
 * or a fee: they run from runWork/resumeWork, never from a request handler. `prepare` is the identity (proposals are preset: no AI call here).
 */
const adm = () => supabaseAdmin();
const str = (v: unknown): string => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const human = (by: { name: string }): boolean => by.name !== "NIVO";

const bookingOf = async (c: EngineCtx, p: Proposal): Promise<BookingRow> => {
  const b = await loadBooking(c.ws, str(p.fields.booking_id));
  if (!b) throw new Error("Không tìm thấy lịch hẹn.");
  return b;
};

const tell = async (c: EngineCtx, item: WorkItem, b: BookingRow, text: string, subject: string): Promise<string> => {
  const r = await deliverToCustomer(c.ws, b, text, item.id, subject);
  await logEvidence(adm(), c.ws, { lead_id: b.lead_id, work_item_id: item.id, kind: "booking.notified", actor: "Đặt lịch hẹn", summary: r.sent ? `Đã nhắn khách qua ${r.via}` : "Không có kênh để nhắn khách", evidence: text });
  return r.sent ? `đã nhắn khách (${r.via})` : "chưa có kênh nhắn khách";
};

const confirmBooking: Performer = {
  prepare: async (_c, item) => ({ proposal: item.proposal }),
  perform: async (c, item, p, by) => {
    const b = await bookingOf(c, p);
    if (b.status === "cancelled") return { summary: "Lịch hẹn đã bị hủy trước đó, không xác nhận.", evidence: "captured", lead_id: item.lead_id };
    if (b.status !== "requested") return { summary: "Lịch hẹn này đã được xử lý rồi.", evidence: "captured", lead_id: item.lead_id };
    // A request that conflicted did not hold the slot: the owner approving it means "take it anyway" (they know the shop), so it is held by force.
    if (!b.holds_slot) {
      if (!human(by)) throw new Error("Lịch trùng chỉ do chủ duyệt mới nhận được.");
      const { error } = await adm().from("bookings").update({ holds_slot: true, conflict_note: "" }).eq("id", b.id);
      if (error) throw new Error(error.message);
    }
    const { error } = await adm().from("bookings").update({ status: "confirmed", work_item_id: item.id, updated_at: new Date().toISOString() }).eq("id", b.id).eq("status", "requested");
    if (error) throw new Error(error.message);
    const next = (await loadBooking(c.ws, b.id)) as BookingRow;
    const reminders = await scheduleReminders(next);
    const m = await loadModel(c.ws);
    const f = await factsOf(next, m);
    const told = await tell(c, item, next, confirmText(bookingFacts(f)), `Xác nhận lịch hẹn ${f.service.name}`);
    return { summary: `Đã xác nhận lịch ${f.service.name} của ${next.customer_name || "khách"} lúc ${whenText(f.startMs, m.settings.timezone)}; ${told}; hẹn nhắc ${reminders.length} lần.`, evidence: "captured", lead_id: item.lead_id, detail: confirmText(bookingFacts(f)) };
  },
  onReject: async (c, _item, p) => {
    const b = await loadBooking(c.ws, str(p.fields.booking_id));
    if (b && b.status === "requested") await adm().from("bookings").update({ status: "cancelled", holds_slot: false, cancelled_at: new Date().toISOString(), cancel_reason: "Chủ từ chối yêu cầu" }).eq("id", b.id);
  },
};

const reschedule: Performer = {
  prepare: async (_c, item) => ({ proposal: item.proposal }),
  perform: async (c, item, p, by) => {
    const b = await bookingOf(c, p);
    if (!ACTIVE.includes(b.status)) throw new Error("Lịch hẹn này không còn đổi được.");
    const from = Date.parse(b.start_at);
    const rpc = async (force: boolean) => adm().rpc("booking_relocate", {
      p_booking: b.id, p_resource: str(p.fields.new_resource_id), p_start: str(p.fields.new_start), p_end: str(p.fields.new_end), p_block_end: str(p.fields.new_block_end), p_force: force,
    });
    let r = await rpc(false);
    if (r.error) throw new Error(r.error.message);
    // Taken since it was proposed: only an owner's approval may stack it (they decided with the conflict in front of them).
    if (r.data !== true && human(by)) r = await rpc(true);
    if (r.data !== true) throw new Error("Giờ mới đã có lịch khác.");
    const next = (await loadBooking(c.ws, b.id)) as BookingRow;
    await scheduleReminders(next);
    const m = await loadModel(c.ws);
    const f = await factsOf(next, m);
    const text = rescheduleText(bookingFacts(f), from);
    const told = await tell(c, item, next, text, `Đổi lịch hẹn ${f.service.name}`);
    return { summary: `Đã đổi lịch ${f.service.name} của ${next.customer_name || "khách"} sang ${whenText(f.startMs, m.settings.timezone)}; ${told}.`, evidence: "captured", lead_id: item.lead_id, detail: text };
  },
};

/** Both cancel actions end the same way: the booking closes, its reminders stop, the fee (if any) is recorded on it, the customer is told, waiting customers become eligible. */
const cancelLike = (withFee: boolean): Performer => ({
  prepare: async (_c, item) => ({ proposal: item.proposal }),
  perform: async (c, item, p) => {
    const b = await bookingOf(c, p);
    const noShow = str(p.fields.kind) === "no_show";
    if (!noShow && !ACTIVE.includes(b.status)) return { summary: "Lịch hẹn này đã đóng rồi.", evidence: "captured", lead_id: item.lead_id };
    const fee = withFee ? (typeof p.amount_vnd === "number" ? p.amount_vnd : Number(p.fields.amount_vnd) || 0) : 0;
    const upd = noShow
      ? { cancel_fee_vnd: fee }
      : { status: "cancelled", holds_slot: false, cancelled_at: new Date().toISOString(), cancel_reason: str(p.fields.reason) || (fee > 0 ? "Hủy sát giờ" : "Khách hủy"), cancel_fee_vnd: fee, work_item_id: item.id };
    const { error } = await adm().from("bookings").update({ ...upd, updated_at: new Date().toISOString() }).eq("id", b.id);
    if (error) throw new Error(error.message);
    await cancelReminders(b.id, "Lịch đã hủy");
    const next = (await loadBooking(c.ws, b.id)) as BookingRow;
    const m = await loadModel(c.ws);
    const f = await factsOf(next, m);
    const text = noShow ? `Chào ${next.customer_name || "bạn"}, ${f.shop} ghi nhận bạn không đến lịch ${f.service.name} lúc ${whenText(f.startMs, m.settings.timezone)}. Theo chính sách, phí là ${fee.toLocaleString("vi-VN")} ₫. Bạn nhắn lại nếu có nhầm lẫn nhé.` : cancelText(bookingFacts(f), fee);
    const told = await tell(c, item, next, text, `Hủy lịch hẹn ${f.service.name}`);
    return { summary: `${noShow ? "Ghi phí không đến" : "Đã hủy lịch"} ${f.service.name} của ${next.customer_name || "khách"} (${whenText(f.startMs, m.settings.timezone)})${fee > 0 ? `, phí ${fee.toLocaleString("vi-VN")} ₫` : ""}; ${told}.`, evidence: "captured", lead_id: item.lead_id, detail: text };
  },
});

/** remind_booking: the reminder text itself is already in the proposal draft (fixed wording, or the owner's customised body); sending it is this performer. */
const remindBooking: Performer = {
  prepare: async (_c, item) => ({ proposal: item.proposal }),
  perform: async (c, item, p) => {
    const b = await bookingOf(c, p);
    if (!ACTIVE.includes(b.status) || Date.parse(b.start_at) <= Date.now()) return { summary: "Lịch đã đóng hoặc đã qua giờ, không nhắc.", evidence: "captured", lead_id: item.lead_id };
    const text = p.draft ?? "";
    if (!text) throw new Error("Không có nội dung nhắc.");
    const told = await tell(c, item, b, text, "Nhắc lịch hẹn");
    return { summary: `Nhắc lịch ${b.customer_name || "khách"} lúc ${whenText(Date.parse(b.start_at), (await loadSettings(c.ws)).timezone)}: ${told}.`, evidence: "captured", lead_id: item.lead_id, detail: text };
  },
};

export const BOOKING_PERFORMERS = {
  confirm_booking: confirmBooking,
  reschedule,
  cancel_booking: cancelLike(false),
  cancel_with_fee: cancelLike(true),
  remind_booking: remindBooking,
} as const;

/** The wording of a reminder: the owner's customised body (variables filled) or the fixed default. */
export const reminderBody = async (b: BookingRow, hoursBefore: number, customBody: string | null): Promise<string> => {
  const f = await factsOf(b);
  const facts = bookingFacts(f);
  if (!customBody) return reminderText(facts, hoursBefore);
  const when = whenText(f.startMs, f.settings.timezone);
  const vars = { ten_khach: b.customer_name, ten_shop: f.shop, dich_vu: f.service.name, gio_hen: when, nguoi_lam: f.resource, dia_chi: f.settings.address };
  return fillBody(customBody, vars as unknown as Parameters<typeof fillBody>[1]);
};

