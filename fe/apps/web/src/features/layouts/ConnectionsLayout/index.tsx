import type { ReactNode } from "react"
import { ConnectionsLayoutBase } from "./component"

/** What the route hands the layout: the routed tab. */
type ConnectionsLayoutProps = {
    readonly children?: ReactNode
}

/** The frame of the Connections page: the band stays while the tab under it (Connected, Library) changes. */
export const ConnectionsLayout = (props: ConnectionsLayoutProps) => (
    <ConnectionsLayoutBase>{props.children}</ConnectionsLayoutBase>
)
