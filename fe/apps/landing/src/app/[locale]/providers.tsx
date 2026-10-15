"use client"

import { I18nProvider } from "@heroui/react"
import { GrammarRoot } from "@starci/grammar/common"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { intlTagOf } from "@/modules/i18n"

/** What the provider stack takes from the locale layout. */
type LandingProvidersProps = {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly timeZone: string
    readonly children: ReactNode
}

/** The landing is light only and has no store, session or client routing: copy, React Aria and the grammar root. */
export const LandingProviders = (props: LandingProvidersProps) => (
    <NextIntlClientProvider locale={props.locale} messages={props.messages} timeZone={props.timeZone}>
        <I18nProvider locale={intlTagOf(props.locale)}>
            <GrammarRoot theme="light">{props.children}</GrammarRoot>
        </I18nProvider>
    </NextIntlClientProvider>
)
