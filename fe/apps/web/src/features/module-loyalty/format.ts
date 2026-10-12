import { intlLocale, type Locale } from "@/i18n/core";

const DAY = 86_400_000;

/** Whole days between an ISO time and the server's `nowIso` (never negative). */
export const daysSince = (iso: string, nowIso: string): number => Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(iso)) / DAY));

/** Short date with year, Vietnam time. */
export const formatDate = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));

/** Short date and time, Vietnam time. */
export const formatDateTime = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));

/** A whole number with the locale's thousands separators. */
export const formatNumber = (n: number, locale: Locale): string => new Intl.NumberFormat(intlLocale(locale)).format(n);

/** Digits of a typed number ("45.000" becomes 45000); null when empty. */
export const parseDigits = (value: string): number | null => {
  const only = value.replace(/[^\d]/g, "");
  return only ? Number(only) : null;
};

/** A signed whole number typed as "+50", "-20" or "50"; null when it is not a number. */
export const parseSigned = (value: string): number | null => {
  const v = value.trim().replace(/\s+/g, "");
  if (!/^[+-]?\d+$/.test(v)) return null;
  return Number(v);
};
