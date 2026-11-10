"use client"

import { I18nProvider } from "@heroui/react"
import { GrammarRoot } from "@starci/grammar/common"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { AppProviders } from "@/components/providers/AppProviders"
import { i18n, navigation } from "@/modules/i18n"

/** What the provider stack takes from the locale layout. */
type ProvidersProps = {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly timeZone: string
    readonly children: ReactNode
}

/** What a provider layer wraps. */
type LayerProps = { readonly children: ReactNode }

/** Client routing for grammar links, so Button and Link hrefs go through the locale-aware router. */
const GrammarRouting = (props: LayerProps) => {
    const router = navigation.useRouter()
    return (
        <GrammarRoot data-grammar-family="core" navigate={(href) => router.push(href)}>
            {props.children}
        </GrammarRoot>
    )
}

/** The copy, React Aria, grammar and session contexts above every route, around the app's client providers (components/providers). */
export const Providers = (props: ProvidersProps) => (
    <NextIntlClientProvider locale={props.locale} messages={props.messages} timeZone={props.timeZone}>
        <I18nProvider locale={i18n.intlTagOf(props.locale)}>
            <GrammarRouting>
                <AppProviders>{props.children}</AppProviders>
            </GrammarRouting>
        </I18nProvider>
    </NextIntlClientProvider>
)
