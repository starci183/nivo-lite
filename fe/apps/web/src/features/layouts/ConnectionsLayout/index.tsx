import type { ReactNode } from "react"
import { ConnectionsLayoutBase } from "./component"

/** What the route hands the layout: the routed page. */
type ConnectionsLayoutProps = {
    readonly children?: ReactNode
}

/** The frame of every Connections page except the Zalo return: the list of connections stays while the page beside it changes. */
export const ConnectionsLayout = (props: ConnectionsLayoutProps) => (
    <ConnectionsLayoutBase>{props.children}</ConnectionsLayoutBase>
)
