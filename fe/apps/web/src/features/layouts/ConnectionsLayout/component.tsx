import type { ReactNode } from "react"
import { ConnectionsFrame } from "@/components/blocks/ConnectionsFrame"

/** What the layout supplies: the routed page. */
export interface ConnectionsLayoutBaseProps {
    /** The page drawn beside the list of connections. */
    readonly children?: ReactNode
}

/** Draws the frame of the Connections pages: the one connected block that holds the page band, the list and the routed page. */
export const ConnectionsLayoutBase = (props: ConnectionsLayoutBaseProps) => (
    <ConnectionsFrame>{props.children}</ConnectionsFrame>
)
