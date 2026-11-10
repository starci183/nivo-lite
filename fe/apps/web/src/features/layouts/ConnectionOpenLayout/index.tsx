import type { ReactNode } from "react"
import { ConnectionOpenLayoutBase } from "./component"

/** What the route hands the layout: the routed tab. */
type ConnectionOpenLayoutProps = {
    readonly children?: ReactNode
}

/** The frame of every tab of a connection without a page of its own: the band stays while the tab body changes. */
export const ConnectionOpenLayout = (props: ConnectionOpenLayoutProps) => (
    <ConnectionOpenLayoutBase>{props.children}</ConnectionOpenLayoutBase>
)
