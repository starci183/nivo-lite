import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

export { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, PRODUCT_TIME_ZONE, appLocaleOf, intlTagOf, routing } from "./routing"

/** Locale-aware navigation for client components. */
export const navigation = createNavigation(routing)
export { shiftDate, wallClockText, wallDate, wallInstant, wallMinutes, weekStartOf } from "./zoned-time"
