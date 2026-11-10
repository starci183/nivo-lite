import { createLocaleLayout } from "@nivo-lite/i18n/layout"
import type { LocaleLayoutProps } from "@nivo-lite/i18n/layout"
import type { Metadata } from "next"
import type { ReactElement } from "react"
import { AppLayout, appLayoutMetadata } from "@/features/layouts/AppLayout"
import { Providers } from "./providers"
import "../globals.css"
import "@/modules/brand"

/** The viewport of this route segment. */
export { appLayoutViewport as viewport } from "@/features/layouts/AppLayout"

/** The localized document title of this route segment. */
export const generateMetadata = async (props: LocaleLayoutProps): Promise<Metadata> =>
    appLayoutMetadata((await props.params).locale)

/** The locale segment's document, providers and app chrome. */
const Layout: (props: LocaleLayoutProps) => Promise<ReactElement> = createLocaleLayout({
    chrome: AppLayout,
    providers: Providers,
})

export default Layout
