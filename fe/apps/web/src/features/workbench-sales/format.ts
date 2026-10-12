import { intlLocale, type Locale } from "@/i18n/core";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export type AgeParts = { unit: "now" | "minutes" | "hours" | "days"; n: number };

/** How long ago `sinceIso` was, measured against the server's `nowIso` so server and browser render the same text. */
export const ageParts = (sinceIso: string, nowIso: string): AgeParts => {
  const ms = Math.max(0, Date.parse(nowIso) - Date.parse(sinceIso));
  if (ms < MIN) return { unit: "now", n: 0 };
  if (ms < HOUR) return { unit: "minutes", n: Math.floor(ms / MIN) };
  if (ms < DAY) return { unit: "hours", n: Math.floor(ms / HOUR) };
  return { unit: "days", n: Math.floor(ms / DAY) };
};

/** True when the age is at least a day (rows turn urgent). */
export const isStale = (sinceIso: string, nowIso: string): boolean => Date.parse(nowIso) - Date.parse(sinceIso) >= DAY;

/** Vietnamese dong, or an em dash when there is no figure. */
export const formatVnd = (n: number | null | undefined, locale: Locale): string =>
  n === null || n === undefined ? "—" : new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);

/** Compact dong for lane headers and metrics: 1,2 tỷ / 45 triệu style via Intl compact notation. */
export const formatVndCompact = (n: number, locale: Locale): string =>
  `${new Intl.NumberFormat(intlLocale(locale), { notation: "compact", maximumFractionDigits: 1 }).format(n)} ₫`;

/** Short local date and time (Vietnam time). */
export const formatDateTime = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));

/** Short local date (Vietnam time). */
export const formatDate = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));

/** Digits of a typed amount ("45.000.000 ₫" becomes 45000000); null when empty. */
export const parseAmount = (value: string): number | null => {
  const only = value.replace(/[^\d]/g, "");
  return only ? Number(only) : null;
};
