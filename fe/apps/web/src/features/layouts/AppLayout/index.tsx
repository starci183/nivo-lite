import type { Metadata, Viewport } from "next"
import { getTranslations } from "next-intl/server"
import { Open_Sans } from "next/font/google"
import type { ReactNode } from "react"
import { AppLayoutBase } from "./component"

const openSans = Open_Sans({ subsets: ["latin", "vietnamese"], variable: "--font-open-sans" })

type AppLayoutProps = {
    readonly locale: string
    readonly content: ReactNode
}

/** The viewport of every page. */
export const appLayoutViewport: Viewport = { width: "device-width", initialScale: 1 }

/** The localized document title and description. */
export const appLayoutMetadata = async (locale: string): Promise<Metadata> => {
    const t = await getTranslations({ locale, namespace: "app" })
    return { title: t("title"), description: t("description") }
}

/** The server-resolved document around the routed body. */
export const AppLayout = (props: AppLayoutProps) => (
    <AppLayoutBase props={{ lang: props.locale, fontClass: openSans.variable }}>{props.content}</AppLayoutBase>
)
