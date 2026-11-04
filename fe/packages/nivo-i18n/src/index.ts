import { createReadLocaleSegment } from "@starci/next-i18n/layout"
import type { ReadLocaleSegment } from "@starci/next-i18n/layout"
import { i18n } from "./routing"
import type { AppI18n } from "./routing"

export { DEFAULT_LOCALE, i18n } from "./routing"
export { navigation } from "./navigation"

/** Reads the locale, the catalogue and the time zone of a locale route segment, for the locale layout of either app. */
export const readLocaleSegment: ReadLocaleSegment<AppI18n["locales"][number]> = createReadLocaleSegment(i18n)
