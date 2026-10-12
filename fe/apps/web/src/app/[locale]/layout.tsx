import type { Metadata, Viewport } from "next"
import { hasLocale, NextIntlClientProvider } from "next-intl"
import { getMessages, getTranslations } from "next-intl/server"
import { Open_Sans } from "next/font/google"
import { notFound } from "next/navigation"
import type { CSSProperties, ReactNode } from "react"
import { Providers } from "@/components/providers/Providers"
import { PRODUCT_TIME_ZONE, routing } from "@/modules/i18n"
import "../globals.css"

const openSans = Open_Sans({ subsets: ["latin", "vietnamese"] })

export const viewport: Viewport = { width: "device-width", initialScale: 1 }

type RootLayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/** The localized document title and description. */
export const generateMetadata = async (props: Pick<RootLayoutProps, "params">): Promise<Metadata> => {
    const { locale } = await props.params
    const t = await getTranslations({ locale, namespace: "app" })
    return { title: t("title"), description: t("description") }
}

/** Root document of the locale segment: Open Sans on the body, the next-intl catalog and the provider stack. */
const RootLayout = async (props: RootLayoutProps) => {
    const { locale } = await props.params
    if (!hasLocale(routing.locales, locale)) notFound()
    const messages = await getMessages({ locale })
    return (
        <html lang={locale} suppressHydrationWarning>
            <body
                className="min-h-dvh bg-background text-foreground antialiased"
                style={{ "--font-open-sans": openSans.style.fontFamily } as CSSProperties}
            >
                <NextIntlClientProvider locale={locale} messages={messages} timeZone={PRODUCT_TIME_ZONE}>
                    <Providers locale={locale}>{props.children}</Providers>
                </NextIntlClientProvider>
            </body>
        </html>
    )
}

export default RootLayout
