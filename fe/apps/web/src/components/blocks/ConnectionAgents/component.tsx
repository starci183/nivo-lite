import { ConnectionGrantsBand } from "@/components/frames/ConnectionGrantsBand"
import type { ConnectionGrantsBandProps } from "@/components/frames/ConnectionGrantsBand"

/** The words, the read and the commands of the agents band of a connection. */
export interface ConnectionAgentsBaseProps {
    readonly props: ConnectionGrantsBandProps["props"]
    readonly on: ConnectionGrantsBandProps["on"]
}

/** Draws the agents that work through one connection, each with how far it may go, and the control that hands it to another agent. */
export const ConnectionAgentsBase = (props: ConnectionAgentsBaseProps) => (
    <ConnectionGrantsBand props={props.props} on={props.on} />
)
