import { createI18nNavigation } from "@starci/next-i18n/navigation"
import type { I18nNavigation } from "@starci/next-i18n/navigation"
import { i18n } from "./routing"
import type { AppI18n } from "./routing"

/** Locale-aware navigation for client components: the one navigation of the app. */
export const navigation: I18nNavigation<AppI18n["locales"], AppI18n["localePrefix"]> = createI18nNavigation(i18n)
