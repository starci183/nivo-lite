"use client"

import { I18nProvider, RouterProvider, ToastProvider } from "@heroui/react"
import { GrammarRoot } from "@starci/grammar/common"
import { NextIntlClientProvider } from "next-intl"
import { ThemeProvider, useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { SWRConfig, useSWRConfig } from "swr"
import type { ReactNode } from "react"
import { SideEffectsLayout } from "@/features/layouts/SideEffectsLayout"
import { intlTagOf, navigation } from "@/modules/i18n"
import { pollingRestart } from "@/modules/swr-polling"
import { bindViewerCache } from "@/modules/viewer-cache"
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

const unsubscribe = () => undefined

const subscribeNever = () => unsubscribe

/**
 * Keeps the grammar root on the resolved theme: light until after hydration so server and client agree. The mode class sits on the
 * root itself, so the brand layer's light or dark values win over the grammar's layered defaults on the same element.
 */
const ThemedRoot = (props: LayerProps) => {
    const { resolvedTheme } = useTheme()
    const isHydrated = useSyncExternalStore(
        subscribeNever,
        () => true,
        () => false,
    )
    const mode = isHydrated && resolvedTheme === "dark" ? "dark" : "light"
    return (
        <GrammarRoot theme={mode} className={mode}>
            {props.children}
        </GrammarRoot>
    )
}

/** Client routing for grammar links, so TextAction, Button and Link hrefs go through the locale-aware router. */
const GrammarRouting = (props: LayerProps) => {
    const router = navigation.useRouter()
    return <RouterProvider navigate={(href) => router.push(href)}>{props.children}</RouterProvider>
}

/**
 * Reads with a function `refreshInterval` start polling again when newer data makes it answer above zero after it stopped
 * (modules/swr-polling). A focus regain revalidates at most once per interval instead of on every tab switch. Reads that want to keep their last
 * answer while a new one is in flight opt in per read (useBookingRange, useBookingBoard, useQueryAgentChatPageSwr).
 */
const READ_DEFAULTS = { focusThrottleInterval: 30_000 } as const

/** Points the writes of every hook at the cache around it. */
const ViewerCacheBinding = () => {
    bindViewerCache(useSWRConfig().mutate)
    return null
}

/** Each viewer gets their own SWR cache: a real identity change remounts the provider on a fresh Map, so nothing from the previous person can be drawn. */
const ViewerCache = (props: LayerProps) => {
    const viewerId = useAppSelector((state) => state.viewer.viewerId)
    return (
        <SWRConfig
            key={viewerId === undefined ? "pending" : (viewerId ?? "signed-out")}
            value={{ ...READ_DEFAULTS, use: [pollingRestart], provider: () => new Map() }}
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
            <I18nProvider locale={intlTagOf(props.locale)}>
                <GrammarRouting>
                    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
                        <ThemedRoot>
                            <ViewerCache>
                                {props.children}
                                <ToastProvider />
                                <SideEffectsLayout />
                            </ViewerCache>
                        </ThemedRoot>
                    </ThemeProvider>
                </GrammarRouting>
            </I18nProvider>
        </ReduxProvider>
    </NextIntlClientProvider>
)
