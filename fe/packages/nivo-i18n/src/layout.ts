import type { ComponentType, ReactElement, ReactNode } from "react"
import { createElement } from "react"
import { readLocaleSegment } from "./index"

/** What a locale layout receives from the router: its body and the awaited route parameters. */
export interface LocaleLayoutProps {
    readonly children: ReactNode
    readonly params: Promise<{ readonly locale: string }>
}

/** What the locale segment hands to the provider stack of an app. */
export interface LocaleProvidersProps {
    readonly locale: string
    readonly messages: Record<string, unknown>
    readonly timeZone: string
    readonly children: ReactNode
}

/** What the locale segment hands to the document chrome of an app. */
export interface LocaleChromeProps {
    readonly locale: string
    readonly content: ReactNode
}

/** The two parts an app brings to its locale layout: the document chrome and the provider stack. */
export interface LocaleLayoutParts {
    readonly chrome: ComponentType<LocaleChromeProps>
    readonly providers: ComponentType<LocaleProvidersProps>
}

/** Builds the locale layout of an app: reads the locale segment, then draws the chrome around the providers around the page. */
export const createLocaleLayout =
    (parts: LocaleLayoutParts): ((props: LocaleLayoutProps) => Promise<ReactElement>) =>
    async (props: LocaleLayoutProps): Promise<ReactElement> => {
        const { locale, messages, timeZone } = await readLocaleSegment(props.params)
        return createElement(parts.chrome, {
            locale,
            content: createElement(parts.providers, { locale, messages, timeZone, children: props.children }),
        })
    }
