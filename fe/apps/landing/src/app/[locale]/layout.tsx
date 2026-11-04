import { readLocaleSegment } from "@nivo-lite/i18n"
import type { ReactElement, ReactNode } from "react"
import { SiteLayout, siteLayoutMetadata } from "@/features/layouts/SiteLayout"
import { LandingProviders } from "./providers"
import "../globals.css"
import "@/modules/brand"

import type { Metadata } from "next"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/** The viewport of this route segment. */
export { siteLayoutViewport as viewport } from "@/features/layouts/SiteLayout"

/** The localized document title of this route segment. */
export const generateMetadata = async (props: LayoutProps): Promise<Metadata> =>
    siteLayoutMetadata((await props.params).locale)

/** The locale segment's document, providers and app chrome. */
const Layout = async (props: LayoutProps): Promise<ReactElement> => {
    const { locale, messages, timeZone } = await readLocaleSegment(props.params)
    return (
        <SiteLayout
            locale={locale}
            content={
                <LandingProviders locale={locale} messages={messages} timeZone={timeZone}>
                    {props.children}
                </LandingProviders>
            }
        />
    )
}

export default Layout
