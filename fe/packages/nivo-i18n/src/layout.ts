import "server-only"
import { hasLocale } from "next-intl"
import { getMessages } from "next-intl/server"
import { notFound } from "next/navigation"
import { routing } from "./routing"

/**
 * What an app's `[locale]` layout resolves before it mounts the shell: the language the route states and its catalogue. An unknown
 * language is a route that does not exist, not a request to fall back silently.
 */
export const readLocaleSegment = async (params: Promise<{ readonly locale: string }>) => {
    const { locale } = await params
    if (!hasLocale(routing.locales, locale)) notFound()
    return { locale, messages: await getMessages({ locale }) }
}
