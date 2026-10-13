"use client"

import { I18nProvider, RouterProvider, ToastProvider } from "@heroui/react"
import { GrammarRoot } from "@starci/grammar/common"
import { NextIntlClientProvider } from "next-intl"
import { ThemeProvider, useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import type { ReactNode } from "react"
import { SideEffectsLayout } from "@/features/layouts/SideEffectsLayout"
import { intlTagOf, navigation } from "@/modules/i18n"
import { ReduxProvider } from "@/redux/ReduxProvider"

/** What the provider stack takes from the locale layout. */
type ProvidersProps = {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly timeZone: string
    readonly children: ReactNode
}

/** What a provider layer wraps. */
type LayerProps = { readonly children: ReactNode }

const subscribeNever = () => () => undefined

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

/** The copy, theme, React Aria and auth-refresh contexts above every route. */
export const Providers = (props: ProvidersProps) => (
    <NextIntlClientProvider locale={props.locale} messages={props.messages} timeZone={props.timeZone}>
        <ReduxProvider>
            <I18nProvider locale={intlTagOf(props.locale)}>
                <GrammarRouting>
                    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
                        <ThemedRoot>
                            {props.children}
                            <ToastProvider />
                            <SideEffectsLayout />
                        </ThemedRoot>
                    </ThemeProvider>
                </GrammarRouting>
            </I18nProvider>
        </ReduxProvider>
    </NextIntlClientProvider>
)
