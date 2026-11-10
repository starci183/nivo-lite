import type { ReactNode } from "react"
import { ConnectionOpenHead } from "@/components/blocks/ConnectionOpenHead"

/** What the layout supplies: the routed tab. */
export interface ConnectionOpenLayoutBaseProps {
    readonly children?: ReactNode
}

/** Draws the page of a connection without a page of its own: the connected band (the one Page, with its tabs) around the routed tab body. */
export const ConnectionOpenLayoutBase = (props: ConnectionOpenLayoutBaseProps) => (
    <ConnectionOpenHead>{props.children}</ConnectionOpenHead>
)
