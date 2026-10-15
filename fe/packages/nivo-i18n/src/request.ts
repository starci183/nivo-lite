import "server-only"
import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { cookies, headers } from "next/headers"
import { LOCALE_COOKIE, PRODUCT_TIME_ZONE, routing } from "./routing"

/** The header the next-intl middleware sets on the request with the locale it negotiated. */
const LOCALE_HEADER = "x-next-intl-locale"

/** Loads one app's own catalogue for a served locale. */
type LoadMessages = (locale: string) => Promise<Record<string, unknown>>

/** The missing message next-intl asks a fallback for. */
type MissingMessage = { readonly namespace?: string; readonly key: string }

/**
 * The request config next-intl's plugin loads, written once for both apps. The locale is the one the proxy negotiated; routes the proxy does
 * not negotiate (api handlers, server actions posted to them) fall back to the cookie, then to Vietnamese. The app supplies only its own
 * catalogue; a key it lacks renders as `<app>:<namespace>.<key>`.
 */
export const createRequestConfig = (app: "web" | "landing", loadMessages: LoadMessages) =>
    getRequestConfig(async () => {
        const negotiated = (await headers()).get(LOCALE_HEADER)
        const stored = (await cookies()).get(LOCALE_COOKIE)?.value
        const candidate = hasLocale(routing.locales, negotiated) ? negotiated : stored
        const locale = hasLocale(routing.locales, candidate) ? candidate : routing.defaultLocale
        return {
            locale,
            timeZone: PRODUCT_TIME_ZONE,
            messages: await loadMessages(locale),
            getMessageFallback: ({ namespace, key }: MissingMessage) => `${app}:${namespace ?? ""}.${key}`,
        }
    })
