import "server-only"
import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { cookies, headers } from "next/headers"
import { NAMESPACES } from "./namespaces"
import { LOCALE_COOKIE, PRODUCT_TIME_ZONE, routing } from "./routing"

/** The header the next-intl middleware sets on the request with the locale it negotiated. */
const LOCALE_HEADER = "x-next-intl-locale"

const loadCatalog = async (locale: string): Promise<Record<string, unknown>> => {
    const entries = await Promise.all(
        NAMESPACES.map(async (namespace) => [
            namespace,
            (await import(`./messages/${locale}/${namespace}.json`)).default,
        ]),
    )
    return Object.fromEntries(entries)
}

/**
 * The request config next-intl's plugin loads. The locale is the one the proxy negotiated; routes the proxy does not negotiate
 * (api handlers, server actions posted to them) fall back to the cookie, then to Vietnamese.
 */
export default getRequestConfig(async () => {
    const negotiated = (await headers()).get(LOCALE_HEADER)
    const stored = (await cookies()).get(LOCALE_COOKIE)?.value
    const candidate = hasLocale(routing.locales, negotiated) ? negotiated : stored
    const locale = hasLocale(routing.locales, candidate) ? candidate : routing.defaultLocale
    return {
        locale,
        timeZone: PRODUCT_TIME_ZONE,
        messages: await loadCatalog(locale),
        getMessageFallback: ({ namespace, key }) => `${namespace ?? ""}.${key}`,
    }
})
