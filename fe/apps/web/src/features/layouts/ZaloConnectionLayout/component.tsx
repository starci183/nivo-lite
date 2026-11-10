import type { ReactNode } from "react"
import { ZaloConnectionHead } from "@/components/blocks/ZaloConnectionHead"

/** What the layout supplies: the connection of the url and the routed tab. */
export interface ZaloConnectionLayoutBaseProps {
    readonly children?: ReactNode
    readonly props: { readonly connectionId: string }
}

/** Draws the page of a Zalo OA connection: the connected band (the one Page, with its tabs) around the routed tab's body. */
export const ZaloConnectionLayoutBase = (props: ZaloConnectionLayoutBaseProps) => (
    <ZaloConnectionHead connectionId={props.props.connectionId}>{props.children}</ZaloConnectionHead>
)
