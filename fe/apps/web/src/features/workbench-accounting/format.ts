import { TIME_ZONE, intlLocale, type Locale } from "@/i18n/core";

/** "1.250.000 ₫" in Vietnamese, "1,250,000 VND" in English. */
export const formatMoney = (n: number | null | undefined, locale: Locale): string =>
  n === null || n === undefined ? "—" : `${new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(n)} ${locale === "vi" ? "₫" : "VND"}`;

/** Day and month (and year) in Vietnam time. */
export const formatDay = (iso: string | null | undefined, locale: Locale, withYear = true): string =>
  iso ? new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "2-digit", ...(withYear ? { year: "numeric" } : {}), timeZone: TIME_ZONE }).format(new Date(iso)) : "—";

/** Day, month and clock time in Vietnam time. */
export const formatStamp = (iso: string | null | undefined, locale: Locale): string =>
  iso ? new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(new Date(iso)) : "—";

/** The month a period covers, e.g. "10/2026". */
export const formatMonth = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { month: "2-digit", year: "numeric", timeZone: TIME_ZONE }).format(new Date(new Date(iso).getTime() + 3_600_000));

/** Today as yyyy-mm-dd in Vietnam time (default of the date field). */
export const todayVn = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

/** Digits only to a number, or null. */
export const digitsToNumber = (raw: string): number | null => {
  const only = raw.replace(/[^\d]/g, "");
  return only ? Number(only) : null;
};
