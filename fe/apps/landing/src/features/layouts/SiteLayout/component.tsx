import type { ReactNode } from "react"
import { SITE_BODY_CLASS } from "./classNames"

/** Props for the pure app document. */
export type SiteLayoutBaseProps = {
    readonly props: { readonly lang: string; readonly fontClass: string }
    readonly children: ReactNode
}

/** Draws the document: the html element in the reader's language and the body in the app font. */
export const SiteLayoutBase = (props: SiteLayoutBaseProps) => (
    <html lang={props.props.lang} suppressHydrationWarning>
        <body className={`${props.props.fontClass} ${SITE_BODY_CLASS}`}>{props.children}</body>
    </html>
)
