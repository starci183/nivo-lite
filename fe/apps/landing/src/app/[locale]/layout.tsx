import { createLocaleLayout } from "@nivo-lite/i18n/layout"
import type { LocaleLayoutProps } from "@nivo-lite/i18n/layout"
import type { Metadata } from "next"
import type { ReactElement } from "react"
import { SiteLayout, siteLayoutMetadata } from "@/features/layouts/SiteLayout"
import { LandingProviders } from "./providers"
import "../globals.css"
import "@/modules/brand"

/** The viewport of this route segment. */
export { siteLayoutViewport as viewport } from "@/features/layouts/SiteLayout"

/** The localized document title of this route segment. */
export const generateMetadata = async (props: LocaleLayoutProps): Promise<Metadata> =>
    siteLayoutMetadata((await props.params).locale)

/** The locale segment's document, providers and app chrome. */
const Layout: (props: LocaleLayoutProps) => Promise<ReactElement> = createLocaleLayout({
    chrome: SiteLayout,
    providers: LandingProviders,
})

export default Layout
