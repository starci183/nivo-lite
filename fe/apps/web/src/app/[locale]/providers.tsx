"use client"

import { I18nProvider, ToastProvider } from "@heroui/react"
import { GrammarRoot } from "@starci/grammar/common"
import { viewerCacheKey, viewerSwrConfig } from "@starci/next-data"
import { NextIntlClientProvider } from "next-intl"
import { ThemeProvider } from "next-themes"
import { SWRConfig, useSWRConfig } from "swr"
import type { ReactNode } from "react"
import { SideEffectsLayout } from "@/features/layouts/SideEffectsLayout"
import { i18n, navigation } from "@/modules/i18n"
import { viewerCache } from "@/modules/viewer-cache"
import { ReduxProvider, useAppSelector } from "@/redux"

/** What the provider stack takes from the locale layout. */
type ProvidersProps = {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly timeZone: string
    readonly children: ReactNode
}

/** What a provider layer wraps. */
type LayerProps = { readonly children: ReactNode }

/** Client routing for grammar links, so TextAction, Button and Link hrefs go through the locale-aware router. */
const GrammarRouting = (props: LayerProps) => {
    const router = navigation.useRouter()
    return (
        <GrammarRoot data-grammar-family="core" navigate={(href) => router.push(href)}>
            {props.children}
        </GrammarRoot>
    )
}

/**
 * Reads with a function `refreshInterval` start polling again when newer data makes it answer above zero after it stopped
 * (`pollingRestart` of `@starci/next-data`). A focus regain revalidates at most once per interval instead of on every tab switch. Reads that want to keep their last
 * answer while a new one is in flight opt in per read (useBookingRange, useBookingBoard, useQueryAgentChatPageSwr).
 */
const READ_DEFAULTS = { focusThrottleInterval: 30_000 } as const

/** Points the writes of every hook at the cache around it. */
const ViewerCacheBinding = () => {
    viewerCache.bind(useSWRConfig().mutate)
    return null
}

/** Each viewer gets their own SWR cache: a real identity change remounts the provider on a fresh Map, so nothing from the previous person can be drawn. */
const ViewerCache = (props: LayerProps) => {
    const viewerId = useAppSelector((state) => state.viewer.viewerId)
    return (
        <SWRConfig
            key={viewerCacheKey(viewerId)}
            value={viewerSwrConfig(READ_DEFAULTS)}
        >
            <ViewerCacheBinding />
            {props.children}
        </SWRConfig>
    )
}

/** The copy, theme, React Aria and auth-refresh contexts above every route. */
export const Providers = (props: ProvidersProps) => (
    <NextIntlClientProvider locale={props.locale} messages={props.messages} timeZone={props.timeZone}>
        <ReduxProvider>
            <I18nProvider locale={i18n.intlTagOf(props.locale)}>
                <GrammarRouting>
                    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
                        <ViewerCache>
                            {props.children}
                            <ToastProvider />
                            <SideEffectsLayout />
                        </ViewerCache>
                    </ThemeProvider>
                </GrammarRouting>
            </I18nProvider>
        </ReduxProvider>
    </NextIntlClientProvider>
)
