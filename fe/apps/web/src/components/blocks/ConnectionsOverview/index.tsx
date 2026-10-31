import type { ReactNode } from "react"
import { ConnectionsBoardRegion } from "./component"
import type { ConnectionsOverviewProps } from "./component"

export type { ConnectionsBoard } from "./component"

/**
 * The body of the Connections page, drawn inside the `Page` of ConnectionsFrame: the board read from the workspace (the first connection that needs attention, and either the library or the
 * provider lists grouped by what they bring in) with the MCP gateway sections under it. The feature host reads the workspace and
 * registers the blocks the board draws (a block never imports a block), so this unit draws what it is handed.
 */
export const ConnectionsOverview = (props: ConnectionsOverviewProps) => (
    <>
        <ConnectionsBoardRegion overview={props} />
        {props.props.gateway}
    </>
)

/** The feature host supplies the registered drawers and their readiness. */
interface OverlayHostProps {
    readonly active: boolean
    readonly candidate: ReactNode
}

/** A pure host for the connection drawers; the feature owns their registration and lifecycle. */
export const OverlayHost = (props: OverlayHostProps) => <>{props.active ? props.candidate : null}</>
