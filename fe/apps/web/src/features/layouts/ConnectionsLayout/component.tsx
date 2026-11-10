import type { ReactNode } from "react"
import { ConnectionsFrame } from "@/components/blocks/ConnectionsFrame"

/** What the layout supplies: the routed tab. */
export interface ConnectionsLayoutBaseProps {
    /** The tab's body drawn under the band. */
    readonly children?: ReactNode
}

/** Draws the Connections page: the connected band (title, summary, "Add connection", the tabs) around the routed tab. */
export const ConnectionsLayoutBase = (props: ConnectionsLayoutBaseProps) => (
    <ConnectionsFrame>{props.children}</ConnectionsFrame>
)
