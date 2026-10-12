import { intlLocale, TIME_ZONE, type Locale } from "@/i18n/core"

const DAY_MS = 86_400_000

/** Localised words for relative day labels. */
export type DayWords = { readonly today: string; readonly yesterday: string }

/** Time of day in Vietnam time so server and client render the same text. */
export const formatTime = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(new Date(iso))

/** Short date such as "29 Sep" or "29 thg 9", in Vietnam time. */
export const formatDay = (iso: string, locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: TIME_ZONE }).format(new Date(iso))

/** Time and date such as "10:00, 29 Sep". */
export const formatStamp = (iso: string, locale: Locale): string => `${formatTime(iso, locale)}, ${formatDay(iso, locale)}`

/** Calendar-day key (Vietnam time) used to group messages. */
export const dayKey = (iso: string): string => new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 10)

/** "Today", "Yesterday" or a short date for a day key, relative to `nowIso`. */
export const dayLabel = (key: string, nowIso: string, locale: Locale, words: DayWords): string => {
  const today = dayKey(nowIso)
  if (key === today) return words.today
  if (key === dayKey(new Date(new Date(nowIso).getTime() - DAY_MS).toISOString())) return words.yesterday
  return formatDay(`${key}T00:00:00Z`, locale)
}

/** List-row time: clock time today, otherwise "Yesterday" or a short date. */
export const listTime = (iso: string, nowIso: string, locale: Locale, words: DayWords): string => {
  const key = dayKey(iso)
  return key === dayKey(nowIso) ? formatTime(iso, locale) : dayLabel(key, nowIso, locale, words)
}
