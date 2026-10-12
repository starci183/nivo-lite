import { intlLocale, TIME_ZONE, type Locale } from "@/i18n/core";

/** 5000000 -> "5.000.000đ" (vi) / "5,000,000đ" (en). */
export const formatVnd = (amount: number | null, locale: Locale): string =>
  amount === null ? "—" : `${new Intl.NumberFormat(intlLocale(locale)).format(amount)}đ`;

/** Short day + time in the Ho Chi Minh time zone. */
export const formatWhen = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(new Date(iso));

/** Short date in the Ho Chi Minh time zone. */
export const formatDay = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(new Date(iso));
