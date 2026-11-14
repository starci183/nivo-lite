import type { Metadata, Viewport } from "next"
import { getTranslations } from "next-intl/server"
import { Inter } from "next/font/google"
import type { ReactNode } from "react"
import { adminSiteOrigin } from "@/modules/config"
import { AppLayoutBase } from "@nivo-lite/fe-shared/app-layout-base"

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-sans" })

type AdminRootLayoutProps = {
    readonly locale: string
    readonly content: ReactNode
}

/** The viewport of every page. */
export const adminRootViewport: Viewport = { width: "device-width", initialScale: 1 }

/** The localized document title; the admin is never indexed. */
export const adminRootMetadata = async (locale: string): Promise<Metadata> => {
    const t = await getTranslations({ locale, namespace: "app" })
    return {
        title: t("title"),
        description: t("description"),
        metadataBase: new URL(adminSiteOrigin()),
        robots: { index: false, follow: false },
    }
}

/** The server-resolved document around the routed body. */
export const AdminRootLayout = (props: AdminRootLayoutProps) => (
    <AppLayoutBase props={{ lang: props.locale, fontClass: inter.variable }}>{props.content}</AppLayoutBase>
)
