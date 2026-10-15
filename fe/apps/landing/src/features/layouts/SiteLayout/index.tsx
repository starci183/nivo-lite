import type { Metadata, Viewport } from "next"
import { getTranslations } from "next-intl/server"
import { Open_Sans } from "next/font/google"
import type { ReactNode } from "react"
import { siteUrl } from "@/modules/config"
import { SiteLayoutBase } from "./component"

const openSans = Open_Sans({ subsets: ["latin", "vietnamese"], variable: "--font-open-sans" })

type SiteLayoutProps = {
    readonly locale: string
    readonly content: ReactNode
}

/** The viewport of every page. */
export const siteLayoutViewport: Viewport = { width: "device-width", initialScale: 1 }

/** The localized document title and description. */
export const siteLayoutMetadata = async (locale: string): Promise<Metadata> => {
    const t = await getTranslations({ locale, namespace: "app" })
    return { title: t("title"), description: t("description"), metadataBase: new URL(siteUrl()) }
}

/** The server-resolved document around the routed body. */
export const SiteLayout = (props: SiteLayoutProps) => (
    <SiteLayoutBase props={{ lang: props.locale, fontClass: openSans.variable }}>{props.content}</SiteLayoutBase>
)
