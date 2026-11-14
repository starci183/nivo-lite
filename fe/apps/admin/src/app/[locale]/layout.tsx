import { createLocaleLayout, type LocaleLayoutProps } from "@nivo-lite/i18n/layout"
import type { Metadata } from "next"
import type { ReactElement } from "react"
import { AdminRootLayout, adminRootMetadata } from "@/features/layouts/AdminRootLayout"
import { Providers } from "./providers"
import "../globals.css"
import "@/modules/brand"

/** The viewport of this route segment. */
export { adminRootViewport as viewport } from "@/features/layouts/AdminRootLayout"

/** The localized document title of this route segment. */
export const generateMetadata = async (props: LocaleLayoutProps): Promise<Metadata> =>
    adminRootMetadata((await props.params).locale)

/** The locale segment's document, providers and app chrome. */
const Layout: (props: LocaleLayoutProps) => Promise<ReactElement> = createLocaleLayout({
    chrome: AdminRootLayout,
    providers: Providers,
})

export default Layout
