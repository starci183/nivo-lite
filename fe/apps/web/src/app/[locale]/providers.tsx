"use client"

import { NextIntlClientProvider } from "next-intl"
import { useEffect, type ReactNode } from "react"
import { toLocale } from "@/i18n/core"
import { Providers as ComponentProviders } from "@/components/providers/Providers"
import { subscribeToAuthRefresh } from "@/modules/db/browser"
import { navigation } from "@/modules/i18n"

/** What the provider stack takes from the locale layout. */
type ProvidersProps = {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly timeZone: string
    readonly children: ReactNode
}

/** What the auth-refresh subscriber wraps. */
type AuthRefreshProps = { readonly children: ReactNode }

/** Re-renders the server tree whenever the browser's Supabase session changes (sign-in, sign-out, token refresh). */
const AuthRefresh = (props: AuthRefreshProps) => {
    const router = navigation.useRouter()
    useEffect(() => subscribeToAuthRefresh(() => router.refresh()), [router])
    return props.children
}

/** The copy, theme, React Aria and auth-refresh contexts above every route. */
export const Providers = (props: ProvidersProps) => (
    <NextIntlClientProvider locale={props.locale} messages={props.messages} timeZone={props.timeZone}>
        <AuthRefresh>
            <ComponentProviders locale={toLocale(props.locale)}>{props.children}</ComponentProviders>
        </AuthRefresh>
    </NextIntlClientProvider>
)
