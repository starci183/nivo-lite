import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

export { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, PRODUCT_TIME_ZONE, appLocaleOf, intlTagOf } from "./routing"

/** Locale-aware navigation for client components: the one navigation of the product, shared by both apps. */
export const navigation = createNavigation(routing)
