import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"
import type { LOCALES } from "./routing"

export { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, PRODUCT_TIME_ZONE, appLocaleOf, intlTagOf } from "./routing"

/** Locale-aware navigation for client components: the one navigation of the product, shared by both apps. */
export const navigation: ReturnType<typeof createNavigation<typeof LOCALES, "never">> = createNavigation<
    typeof LOCALES,
    "never"
>(routing)
