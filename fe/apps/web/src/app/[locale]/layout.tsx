import { readLocaleSegment } from "@nivo-lite/i18n"
import type { Metadata } from "next"
import type { ReactNode, ReactElement } from "react"
import { AppLayout, appLayoutMetadata } from "@/features/layouts/AppLayout"
import { Providers } from "./providers"
import "../globals.css"
import "@/modules/brand"

type LayoutProps = {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/** The viewport of this route segment. */
export { appLayoutViewport as viewport } from "@/features/layouts/AppLayout"

/** The localized document title of this route segment. */
export const generateMetadata = async (props: LayoutProps): Promise<Metadata> =>
    appLayoutMetadata((await props.params).locale)

/** The locale segment's document, providers and app chrome. */
const Layout = async (props: LayoutProps): Promise<ReactElement> => {
    const { locale, messages, timeZone } = await readLocaleSegment(props.params)
    return (
        <AppLayout
            locale={locale}
            content={
                <Providers locale={locale} messages={messages} timeZone={timeZone}>
                    {props.children}
                </Providers>
            }
        />
    )
}

export default Layout
