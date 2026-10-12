import { addDays, weekdayOf } from "@/lib/module-shifts-types";

export const DAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;
export const DAY_LONG = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"] as const;

export const dm = (date: string): string => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
export const dayName = (date: string): string => DAY_SHORT[weekdayOf(date)];
export const dayFull = (date: string): string => `${DAY_LONG[weekdayOf(date)]} ${dm(date)}`;
export const weekRange = (monday: string): string => `${dm(monday)} – ${dm(addDays(monday, 6))}/${addDays(monday, 6).slice(0, 4)}`;
export const vnd = (n: number): string => `${Math.round(n).toLocaleString("vi-VN")}đ`;
export const hrs = (minutes: number): string => `${Math.round((minutes / 60) * 10) / 10}h`;
export const timeOptions = (from = 5, to = 24): Array<{ id: string; label: string }> => {
  const out: Array<{ id: string; label: string }> = [];
  for (let m = from * 60; m <= to * 60; m += 30) {
    const t = `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    out.push({ id: m === 24 * 60 ? "23:59" : t, label: m === 24 * 60 ? "24:00" : t });
  }
  return out;
};
export const dateOptions = (from: string, days = 60): Array<{ id: string; label: string }> =>
  Array.from({ length: days }, (_, i) => addDays(from, i)).map((d) => ({ id: d, label: dayFull(d) }));
export const weekdayOptions = DAY_LONG.map((label, i) => ({ id: String(i), label }));
