import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

export { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, PRODUCT_TIME_ZONE, routing } from "./routing"

/** Locale-aware navigation for client components. */
export const navigation = createNavigation(routing)
