"use client"

import { I18nProvider, RouterProvider } from "@heroui/react"
import { useRouter } from "next/navigation"
import { ThemeProvider } from "next-themes"
import type { ReactNode } from "react"
import { NivoGrammarTheme } from "./NivoGrammarTheme"
import { LocaleProvider } from "@/i18n/client"
import { intlLocale, type Locale } from "@/i18n/core"

/** Props for {@link Providers}. */
export type ProvidersProps = { readonly children: ReactNode; readonly locale: Locale }

/**
 * Client provider stack: locale, client-side routing for Grammar links (TextAction / Button / Link href go through the Next router
 * instead of a full page load), theme (light by default) and the nivo palette.
 */
export const Providers = ({ children, locale }: ProvidersProps) => {
    const router = useRouter()
    return (
        <LocaleProvider locale={locale}>
            <I18nProvider locale={intlLocale(locale)}>
                <RouterProvider navigate={(href) => router.push(href)}>
                    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
                        <NivoGrammarTheme>{children}</NivoGrammarTheme>
                    </ThemeProvider>
                </RouterProvider>
            </I18nProvider>
        </LocaleProvider>
    )
}
