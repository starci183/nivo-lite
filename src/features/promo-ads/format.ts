import { FOUNDING_OFFER } from "@/lib/promo"
import { intlLocale, TIME_ZONE, type Locale } from "@/i18n/core"

/** Offer end date in the reader's locale, such as "31 Oct 2026" / "31 thg 10, 2026". */
export const offerEndLabel = (locale: Locale): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(new Date(FOUNDING_OFFER.endsAt))

/** Offer end date in English ("31 Oct 2026"); prefer {@link offerEndLabel} with the reader's locale. */
export const OFFER_END_LABEL = offerEndLabel("en")

/** Storage key for a dismissed promo card. */
export const dismissKey = (id: string): string => `nivo.promo.dismissed.${id}`
