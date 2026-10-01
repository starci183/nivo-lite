import { intlLocale, TIME_ZONE, type Locale } from "@/i18n/core"

/** Short stamp such as "10:00, 29 Sep" or "10:00, 29 thg 9", in Vietnam time. */
export const formatStamp = (iso: string, locale: Locale): string => {
  const date = new Date(iso)
  const tag = intlLocale(locale)
  const time = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(date)
  const day = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: TIME_ZONE }).format(date)
  return `${time}, ${day}`
}

/** Human label of a module key. */
export const moduleLabel = (key: string): string => `${key.charAt(0).toUpperCase()}${key.slice(1)}`
