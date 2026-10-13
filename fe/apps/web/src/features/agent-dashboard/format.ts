import { TIME_ZONE, intlLocale, type Locale } from "@/i18n/core";

/** "12/10 14:05" (Vietnam time): when a waiting item was raised or a task finished. */
export const formatWhen = (iso: string | null | undefined, locale: Locale): string =>
  iso
    ? new Intl.DateTimeFormat(intlLocale(locale), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(new Date(iso))
    : "";
