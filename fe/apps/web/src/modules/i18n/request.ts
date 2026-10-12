import "server-only"
import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { cookies } from "next/headers"
import { NAMESPACES } from "./namespaces"
import { LOCALE_COOKIE, PRODUCT_TIME_ZONE, routing } from "./routing"

type Catalog = Record<string, Record<string, string>>

const loadCatalog = async (locale: string): Promise<Catalog> => {
    const entries = await Promise.all(
        NAMESPACES.map(async (namespace) => {
            const loaded = (await import(`./messages/${locale}/${namespace}.json`)) as {
                default: Record<string, string>
            }
            return [namespace, loaded.default] as const
        }),
    )
    return Object.fromEntries(entries)
}

/**
 * The request config next-intl's plugin loads. The locale is the one the proxy negotiated; routes the proxy does not negotiate
 * (api handlers, server actions posted to them) fall back to the cookie, then to Vietnamese.
 */
export default getRequestConfig(async ({ requestLocale }) => {
    const requested = await requestLocale
    const stored = (await cookies()).get(LOCALE_COOKIE)?.value
    const candidate = hasLocale(routing.locales, requested) ? requested : stored
    const locale = hasLocale(routing.locales, candidate) ? candidate : routing.defaultLocale
    return {
        locale,
        timeZone: PRODUCT_TIME_ZONE,
        messages: await loadCatalog(locale),
        getMessageFallback: ({ namespace, key }) => `${namespace ?? ""}.${key}`,
    }
})
