import type { ReactNode } from "react"
import { SepayConnectionHead } from "@/components/blocks/SepayConnectionHead"

/** What the layout supplies: the connection of the url and the routed tab. */
export interface SepayConnectionLayoutBaseProps {
    readonly children?: ReactNode
    readonly props: { readonly connectionId: string }
}

/** Draws the page of a SePay connection: the connected band (the one Page, with its tabs) around the routed tab's body. */
export const SepayConnectionLayoutBase = (props: SepayConnectionLayoutBaseProps) => (
    <SepayConnectionHead connectionId={props.props.connectionId}>{props.children}</SepayConnectionHead>
)
