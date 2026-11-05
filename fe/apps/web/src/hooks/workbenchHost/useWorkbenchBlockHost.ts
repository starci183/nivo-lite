"use client"

import { useSearchParams } from "next/navigation"
import { createTranslator, useLocale, useMessages } from "next-intl"
import { useMemo } from "react"
import type { BlockHost } from "@nivo-lite/agent-sdk/block"
import { navigation } from "@/modules/i18n"
import { toast } from "@/modules/toast"
import { addressWithQuery, mergedQuery, reportDefect, specLocaleOf, spokenText } from "@/modules/workbench-host"

/**
 * The ports a block reaches, over the app: words through next-intl (a key reads the namespace, inline words pick the locale),
 * navigation through the locale-aware router and the search params, toasts through the app toast, defects to the page error
 * handlers. The object changes only when the language or the query does, which re-draws the blocks that read them.
 */
export const useWorkbenchBlockHost = (): BlockHost => {
    const appLocale = useLocale()
    const messages = useMessages()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const query = useSearchParams()
    const search = query.toString()
    return useMemo<BlockHost>(() => {
        const locale = specLocaleOf(appLocale)
        const setQueryValues = (entries: Readonly<Record<string, string | null>>): void => {
            const current = typeof window === "undefined" ? search : window.location.search
            router.replace(addressWithQuery(pathname, mergedQuery(current, entries)), { scroll: false })
        }
        return {
            text: (namespace) => {
                const translate = createTranslator({ locale: appLocale, messages, namespace })
                return (text) => spokenText((key) => translate(key), locale, text)
            },
            locale: () => locale,
            navigation: {
                href: (path) => navigation.getPathname({ href: path, locale: appLocale }),
                queryValue: (key) => new URLSearchParams(search).get(key),
                setQueryValue: (key, value) => setQueryValues({ [key]: value }),
                setQueryValues,
            },
            notify: (tone, message) => {
                if (tone === "success") toast.success(message)
                else if (tone === "danger") toast.danger(message)
                else toast.info(message)
            },
            report: reportDefect,
        }
    }, [appLocale, messages, pathname, router, search])
}
