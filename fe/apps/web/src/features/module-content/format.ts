import { pad2, vnParts, vnToIso } from "@/lib/module-content-shared";

/** "25/12/2026" for a Vietnam-time instant. */
export const dateText = (iso: string | null): string => {
  if (!iso) return "";
  const p = vnParts(new Date(iso));
  return `${pad2(p.day)}/${pad2(p.m)}/${p.y}`;
};
export const timeText = (iso: string | null): string => {
  if (!iso) return "";
  const p = vnParts(new Date(iso));
  return `${pad2(p.h)}:${pad2(p.min)}`;
};
export const dateTimeText = (iso: string | null): string => (iso ? `${timeText(iso)} ${dateText(iso)}` : "");

/** Parse "25/12/2026" (also 25-12-2026 and 25.12.2026) into parts, or null. */
export const parseDateText = (v: string): { y: number; m: number; day: number } | null => {
  const r = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(v);
  if (!r) return null;
  const day = Number(r[1]); const m = Number(r[2]); const y = Number(r[3]);
  if (m < 1 || m > 12 || day < 1 || y < 2020 || y > 2100) return null;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return day <= dim ? { y, m, day } : null;
};
export const parseTimeText = (v: string): { h: number; min: number } | null => {
  const r = /^\s*([01]?\d|2[0-3])[:h]([0-5]\d)\s*$/.exec(v);
  return r ? { h: Number(r[1]), min: Number(r[2]) } : null;
};

/** Date text + time text -> ISO (Vietnam time). Empty date = null (no date). Returns "invalid_date" / "invalid_time" for bad input. */
export const toIso = (date: string, time: string, fallbackTime = "09:00"): string | null | "invalid_date" | "invalid_time" => {
  if (!date.trim()) return null;
  const d = parseDateText(date);
  if (!d) return "invalid_date";
  const t = parseTimeText(time.trim() || fallbackTime);
  if (!t) return "invalid_time";
  return vnToIso(d.y, d.m, d.day, t.h, t.min);
};

/** The same wall-clock time on another calendar day. */
export const moveToDay = (iso: string | null, y: number, m: number, day: number, fallback = { h: 9, min: 0 }): string => {
  const p = iso ? vnParts(new Date(iso)) : null;
  return vnToIso(y, m, day, p?.h ?? fallback.h, p?.min ?? fallback.min);
};
