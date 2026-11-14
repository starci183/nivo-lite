import { defineI18n, type I18n } from "@starci/next-i18n"

const LOCALES = ["vi", "en"] as const

/** The description of the app's languages: the locales and the `never` prefix mode that `defineI18n` types. */
export type AppI18n = I18n<typeof LOCALES, "never">

/** The locale served when the reader has chosen none. Vietnamese first (Brand V1.1: Vietnamese first for customer-facing copy). */
export const DEFAULT_LOCALE: AppI18n["defaultLocale"] = "vi"

/**
 * The one description of the app's languages, read by the proxy, the navigation, the request config and the locale layout:
 * no prefix in the URL (the NIVO_LOCALE cookie decides) and a fixed time zone so the server and the hydrated client format the
 * same instant the same way. The stack that reads it is `@starci/next-i18n`'s (FE-I18N-1).
 */
export const i18n: AppI18n = defineI18n({
    locales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    timeZone: "Asia/Ho_Chi_Minh",
    localePrefix: "never",
    localeCookie: { name: "NIVO_LOCALE", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" },
    intlTags: { vi: "vi-VN", en: "en-GB" },
    localeDetection: true,
    alternateLinks: false,
})
