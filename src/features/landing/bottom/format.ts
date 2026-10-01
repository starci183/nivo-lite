import { intlLocale, TIME_ZONE, type Locale } from "@/i18n/core";

/** 499000 -> "499.000đ" (vi) / "499,000đ" (en). */
export const formatVnd = (amount: number, locale: Locale): string =>
  `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, locale === "vi" ? "." : ",")}đ`;

/** Short date in the Ho Chi Minh time zone, in the reader's language. */
export const formatDate = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(new Date(iso));
