import { readLocaleSegment } from "@nivo-lite/i18n/layout"
import type { ReactNode } from "react"
import { SiteLayout, siteLayoutMetadata } from "@/features/layouts/SiteLayout"
import { PRODUCT_TIME_ZONE } from "@/modules/i18n"
import { LandingProviders } from "./providers"
import "../globals.css"
import "@/modules/brand"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/** The viewport of this route segment. */
export { siteLayoutViewport as viewport } from "@/features/layouts/SiteLayout"

/** The localized document title of this route segment. */
export const generateMetadata = async (props: LayoutProps) => siteLayoutMetadata((await props.params).locale)

/** The locale segment's document, providers and app chrome. */
const Layout = async (props: LayoutProps) => {
    const { locale, messages } = await readLocaleSegment(props.params)
    return (
        <SiteLayout
            locale={locale}
            content={
                <LandingProviders locale={locale} messages={messages} timeZone={PRODUCT_TIME_ZONE}>
                    {props.children}
                </LandingProviders>
            }
        />
    )
}

export default Layout
