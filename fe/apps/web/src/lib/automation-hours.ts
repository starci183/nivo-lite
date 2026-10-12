/** Opening hours: pure helpers (no I/O). The hours come as free text from the shop's information ("8h-21h", "08:00 - 20:30"). */

const toMinutes = (h: string, m?: string): number | null => {
  const hh = Number(h);
  const mm = m ? Number(m) : 0;
  return Number.isInteger(hh) && hh >= 0 && hh <= 24 && mm >= 0 && mm < 60 ? hh * 60 + mm : null;
};

/**
 * The first two clock times in a free text ("8h-21h", "08:00 - 20:30", "từ 8h đến 17h30", "8:00–21:00"), in minutes since midnight.
 * Null when the text has fewer than two.
 */
export const parseHours = (text: string | null | undefined): { readonly from: number; readonly to: number } | null => {
  const times = [...(text ?? "").matchAll(/(\d{1,2})\s*(?:[:h]\s*(\d{2})?|giờ\s*(\d{2})?)/gi)]
    .map((m) => toMinutes(m[1], m[2] ?? m[3]))
    .filter((v): v is number => v !== null);
  return times.length >= 2 && times[0] !== times[1] ? { from: times[0], to: times[1] } : null;
};

export const hhmmToMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":");
  return toMinutes(h, m) ?? 0;
};

export const minutesToHhmm = (min: number): string => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** True when `minuteOfDay` is outside [from, to). A window that crosses midnight (from > to) is handled. */
export const isOutsideHours = (minuteOfDay: number, hours: { readonly from: number; readonly to: number }): boolean =>
  hours.from < hours.to ? minuteOfDay < hours.from || minuteOfDay >= hours.to : !(minuteOfDay >= hours.from || minuteOfDay < hours.to);

/** Minutes since midnight and calendar day (yyyy-mm-dd) in Vietnam time. */
export const vnClock = (d = new Date()): { readonly minute: number; readonly day: string } => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return { minute: Number(get("hour")) * 60 + Number(get("minute")), day: `${get("year")}-${get("month")}-${get("day")}` };
};
