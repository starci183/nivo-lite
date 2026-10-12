/** Locales of the app. Vietnamese first (Brand V1.1: Vietnamese first for customer-facing copy). */
export const LOCALES = ["vi", "en"] as const

/** The locale served when the reader has chosen none. */
export const DEFAULT_LOCALE = "vi" as const

/** The cookie that remembers the reader's choice; the URL never carries the locale. */
export const LOCALE_COOKIE = "NIVO_LOCALE"

/** The fixed product time zone used by the server and the hydrated client. */
export const PRODUCT_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The one locale-routing table of the web app: no prefix in the URL, the cookie decides. */
export const routing = {
    locales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    localePrefix: "never" as const,
    localeDetection: true,
    alternateLinks: false,
    localeCookie: { name: LOCALE_COOKIE, maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const, path: "/" },
}
