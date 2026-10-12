"use client"

import { I18nProvider, RouterProvider } from "@heroui/react"
import { GrammarRoot } from "@starci/grammar/common"
import { ThemeProvider, useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useSyncExternalStore } from "react"
import type { ReactNode } from "react"
import { LocaleProvider } from "@/i18n/client"
import { intlLocale, type Locale } from "@/i18n/core"

/** Props for {@link Providers}. */
export type ProvidersProps = { readonly children: ReactNode; readonly locale: Locale }

const subscribeNever = () => () => undefined

/**
 * Keeps the grammar root on the resolved theme: light until after hydration so server and client agree. The mode class sits on the
 * root itself, so the brand layer's light or dark values win over the grammar's layered defaults on the same element.
 */
const ThemedRoot = ({ children }: { readonly children: ReactNode }) => {
    const { resolvedTheme } = useTheme()
    const isHydrated = useSyncExternalStore(
        subscribeNever,
        () => true,
        () => false,
    )
    const mode = isHydrated && resolvedTheme === "dark" ? "dark" : "light"
    return (
        <GrammarRoot theme={mode} className={mode}>
            {children}
        </GrammarRoot>
    )
}

/**
 * Wave 3 shim (becomes `app/[locale]/providers.tsx`): client routing for grammar links (TextAction / Button / Link href go through the
 * Next router instead of a full page load), the theme (light by default) and the grammar root that scopes the brand palette.
 */
export const Providers = ({ children, locale }: ProvidersProps) => {
    const router = useRouter()
    return (
        <LocaleProvider locale={locale}>
            <I18nProvider locale={intlLocale(locale)}>
                <RouterProvider navigate={(href) => router.push(href)}>
                    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
                        <ThemedRoot>{children}</ThemedRoot>
                    </ThemeProvider>
                </RouterProvider>
            </I18nProvider>
        </LocaleProvider>
    )
}
