import { intlLocale, TIME_ZONE, type Locale } from "@/i18n/core";

/** Formats a timestamp as a fixed Vietnam-time date and time so server and client render the same text. */
export const formatDecisionTime = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso));

/** Fixed Vietnam-time clock (24h) such as "12:04". */
export const formatClock = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIME_ZONE }).format(new Date(iso));
