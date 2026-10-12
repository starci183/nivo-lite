import type { ReactNode } from "react"
import { APP_BODY_CLASS } from "./classNames"

/** Props for the pure app document. */
export type AppLayoutBaseProps = {
    readonly props: { readonly lang: string; readonly fontClass: string }
    readonly children: ReactNode
}

/** Draws the document: the html element in the reader's language and the body in the app font. */
export const AppLayoutBase = (props: AppLayoutBaseProps) => (
    <html lang={props.props.lang} suppressHydrationWarning>
        <body className={`${props.props.fontClass} ${APP_BODY_CLASS}`}>{props.children}</body>
    </html>
)
