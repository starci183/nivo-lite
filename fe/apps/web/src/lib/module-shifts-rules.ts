import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEnv, loadSetup, nameOf, positionOf, toShift } from "./module-shifts-data";
import { addDays, instantOf, mondayOf, segOf, toMin, violationsForSegs, type Shift, type ShiftStaff, type Violation } from "./module-shifts-types";

/** Rule checks shared by the performers (after the gate) and the actions (before it). No engine import: performers must not depend on runWork. */
type R = Record<string, unknown>;
type Db = SupabaseClient;

export const VIOLATION_TEXT: Readonly<Record<Violation["kind"], string>> = {
  overlap: "trùng giờ với ca khác", unavailable: "ngoài giờ người đó báo rảnh", leave: "đang nghỉ phép", max_day: "quá giờ tối đa trong ngày",
  max_week: "quá giờ tối đa trong tuần", rest: "nghỉ giữa hai ca chưa đủ", position: "không làm vị trí này",
};

export type SwapInput = { kind: "swap" | "claim"; shiftId: string; fromStaffId: string | null; toStaffId: string };

/** What breaks if `toStaffId` takes the shift: empty list = inside the rules (same position, no rule broken, enough notice). */
export const swapFindings = async (db: Db, ws: string, req: SwapInput, now = new Date()): Promise<{ reasons: Array<string>; shift: Shift | null }> => {
  const { data } = await db.from("shifts_shifts").select("*").eq("id", req.shiftId).eq("workspace_id", ws).maybeSingle();
  if (!data) return { reasons: ["Không tìm thấy ca."], shift: null };
  const shift = toShift(data as R);
  const row = data as R;
  const reasons: Array<string> = [];
  if (!["published", "swapped"].includes(String(row.status))) reasons.push("Ca chưa được đăng.");
  if (req.kind === "swap" && shift.staffId !== req.fromStaffId) reasons.push("Ca không còn thuộc người xin đổi.");
  if (req.kind === "claim" && shift.staffId) reasons.push("Ca đã có người nhận.");
  const setup = await loadSetup(db, ws, { withPay: false });
  const to = setup.staff.find((p) => p.id === req.toStaffId);
  if (!to || !to.active) { reasons.push("Người nhận không còn làm việc."); return { reasons, shift }; }
  if (!to.positionIds.includes(shift.positionId)) reasons.push(`${to.name} không làm vị trí ${positionOf(setup, shift.positionId)?.name ?? "này"}.`);
  const startAt = instantOf(shift.date, toMin(shift.start));
  const noticeH = setup.settings.swapNoticeHours;
  if (startAt.getTime() < now.getTime()) reasons.push("Ca đã bắt đầu.");
  else if ((startAt.getTime() - now.getTime()) / 3_600_000 < noticeH) reasons.push(`Báo chưa đủ ${noticeH} giờ trước ca.`);
  const monday = mondayOf(shift.date);
  const env = await loadEnv(db, ws, monday, setup);
  const mine = (((await db.from("shifts_shifts").select("*").eq("workspace_id", ws).eq("staff_id", to.id).gte("shift_date", monday).lte("shift_date", addDays(monday, 6)).in("status", ["published", "swapped"])).data ?? []) as Array<R>).map(toShift);
  const segs = [...mine.map(segOf), segOf(shift)];
  const v = violationsForSegs(env, to.id, segs);
  const mineIdx = segs.length - 1;
  const kinds = new Set(v.flat().map((x) => x.kind));
  for (const k of kinds) if (k !== "position") reasons.push(`${to.name}: ${VIOLATION_TEXT[k]}.`);
  void mineIdx;
  return { reasons, shift };
};

export const affectedShifts = async (db: Db, ws: string, staffId: string, from: string, to: string): Promise<Array<Shift>> =>
  (((await db.from("shifts_shifts").select("*").eq("workspace_id", ws).eq("staff_id", staffId).gte("shift_date", from).lte("shift_date", to).in("status", ["draft", "published", "swapped"])).data ?? []) as Array<R>).map(toShift);

/** People who could cover `shift` right now (qualified, free, no rule broken), for the "who to ask" suggestion. */
export const coverCandidates = async (db: Db, ws: string, shift: Shift, exclude: ReadonlyArray<string> = []): Promise<Array<ShiftStaff>> => {
  const setup = await loadSetup(db, ws, { withPay: false });
  const monday = mondayOf(shift.date);
  const env = await loadEnv(db, ws, monday, setup);
  const sameWeek = (((await db.from("shifts_shifts").select("*").eq("workspace_id", ws).gte("shift_date", monday).lte("shift_date", addDays(monday, 6)).in("status", ["published", "swapped", "draft"]).not("staff_id", "is", null)).data ?? []) as Array<R>).map(toShift);
  const out: Array<ShiftStaff> = [];
  for (const p of setup.staff) {
    if (!p.active || exclude.includes(p.id) || !p.positionIds.includes(shift.positionId)) continue;
    const segs = [...sameWeek.filter((s) => s.staffId === p.id && s.id !== shift.id).map(segOf), segOf(shift)];
    if (!violationsForSegs(env, p.id, segs).some((x) => x.length)) out.push(p);
  }
  return out;
};

